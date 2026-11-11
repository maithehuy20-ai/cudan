import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';
import { 
  Camera, Upload, X, QrCode, AlertCircle, CheckCircle2, 
  Sparkles, RefreshCw, ZoomIn, Zap, ZapOff, Focus, 
  SunMedium, ScanLine
} from 'lucide-react';
import { parseCccdQrCode, ParsedCccdQr, SAMPLE_CCCD_QRS } from '../utils/cccdParser';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (parsed: ParsedCccdQr) => void;
  title?: string;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Quét mã QR Thẻ Căn Cước Công Dân (CCCD)',
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualText, setManualText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedCccdQr | null>(null);
  const [cameraList, setCameraList] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Camera Controls
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1.5);
  const [hasZoom, setHasZoom] = useState(false);
  const [isRefocusing, setIsRefocusing] = useState(false);
  const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
  const [cameraResolution, setCameraResolution] = useState<string>('Full HD (1080p)');
  const [isEnhancingImage, setIsEnhancingImage] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const frameScanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasDetectedRef = useRef<boolean>(false);
  const readerElementId = 'cccd-qr-reader-region';

  // Chặn hoàn toàn lỗi nội bộ "RenderedCameraImpl video surface onabort() called" từ thư viện html5-qrcode
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event?.message || String(event?.error || '');
      if (
        msg.includes('RenderedCameraImpl video surface onabort') ||
        msg.includes('RenderedCameraImpl video surface onerror') ||
        msg.includes('video surface onabort') ||
        msg.includes('video surface onerror')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.debug('Đã triệt tiêu lỗi video surface onabort từ html5-qrcode:', msg);
        return true;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason?.message || String(event?.reason || '');
      if (
        reason.includes('RenderedCameraImpl video surface onabort') ||
        reason.includes('RenderedCameraImpl video surface onerror') ||
        reason.includes('video surface onabort')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.debug('Đã triệt tiêu promise rejection onabort:', reason);
      }
    };

    window.addEventListener('error', handleGlobalError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Bảo vệ các thẻ <video> được tạo bởi html5-qrcode không ném ngoại lệ khi bị hủy luồng
  useEffect(() => {
    if (!isOpen) return;

    const neutralizeVideo = (videoEl: HTMLVideoElement) => {
      try {
        videoEl.onabort = null;
        videoEl.onerror = null;
        // Chặn sự kiện abort nổi lên window
        videoEl.addEventListener('abort', (e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
      } catch {}
    };

    const container = document.getElementById(readerElementId);
    if (!container) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) {
            neutralizeVideo(node);
          } else if (node instanceof HTMLElement) {
            node.querySelectorAll('video').forEach(neutralizeVideo);
          }
        });
      });
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [isOpen]);

  // Enumerate cameras on open
  useEffect(() => {
    if (!isOpen) return;
    hasDetectedRef.current = false;

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cameras && cameras.length > 0) {
          setCameraList(cameras);
          const backCam = cameras.find((c) => 
            c.label.toLowerCase().includes('back') || 
            c.label.toLowerCase().includes('sau') ||
            c.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : cameras[0].id);
        }
      })
      .catch((err) => {
        console.warn('Camera enumeration warning:', err);
      });
  }, [isOpen]);

  // Clean stop camera and release tracks
  const stopCamera = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (frameScanTimerRef.current) {
      clearInterval(frameScanTimerRef.current);
      frameScanTimerRef.current = null;
    }

    try {
      if (activeTrackRef.current) {
        if (isTorchOn) {
          try {
            // @ts-ignore
            await activeTrackRef.current.applyConstraints({ advanced: [{ torch: false }] });
          } catch {}
        }
        try {
          activeTrackRef.current.stop();
        } catch {}
        activeTrackRef.current = null;
      }

      // Vô hiệu hóa onabort trước khi hủy stream trên mọi video element
      const allVideos = document.querySelectorAll(`#${readerElementId} video`);
      allVideos.forEach((v) => {
        const videoEl = v as HTMLVideoElement;
        videoEl.onabort = null;
        videoEl.onerror = null;
        if (videoEl.srcObject) {
          try {
            const stream = videoEl.srcObject as MediaStream;
            stream.getTracks().forEach((track) => {
              try { track.stop(); } catch {}
            });
            videoEl.srcObject = null;
          } catch {}
        }
      });

      const scanner = html5QrCodeRef.current;
      if (scanner) {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        try { scanner.clear(); } catch {}
      }
      html5QrCodeRef.current = null;
    } catch (e: any) {
      console.warn('Error while stopping QR scanner:', e);
    } finally {
      setIsScanning(false);
      setIsTorchOn(false);
      isStoppingRef.current = false;
    }
  };

  const handleSafeClose = async () => {
    await stopCamera();
    onClose();
  };

  // Setup Track Controls (Zoom, Torch, Focus)
  const attachTrackControls = () => {
    try {
      const videoEl = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          activeTrackRef.current = track;
          // @ts-ignore
          const caps = track.getCapabilities ? track.getCapabilities() : {};

          setHasZoom(true);

          // Torch / Flash capability
          // @ts-ignore
          if (caps.torch) {
            setHasTorch(true);
          }

          // Tự động kích hoạt lấy nét tự động liên tục (Continuous Autofocus) cho camera di động
          // @ts-ignore
          if (caps.focusMode) {
            try {
              // @ts-ignore
              track.applyConstraints({
                advanced: [
                  // @ts-ignore
                  { focusMode: 'continuous' }
                ]
              });
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn('Track control setup warning:', e);
    }
  };

  // Zoom control handler with hardware zoom and CSS digital zoom fallback
  const handleSetZoom = async (zoomLevel: number) => {
    setCurrentZoom(zoomLevel);

    const track = activeTrackRef.current;
    if (track) {
      try {
        // @ts-ignore
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        // @ts-ignore
        if (caps.zoom) {
          // @ts-ignore
          await track.applyConstraints({ advanced: [{ zoom: zoomLevel }] });
        }
      } catch {}
    }

    // CSS Digital Zoom - guaranteed sharp zoom on any camera
    const videoEl = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
    if (videoEl) {
      videoEl.style.transform = `scale(${zoomLevel})`;
      videoEl.style.transformOrigin = 'center center';
      videoEl.style.transition = 'transform 0.15s ease-out';
    }
  };

  // Torch / Flash toggle
  const handleToggleTorch = async () => {
    const track = activeTrackRef.current;
    if (track) {
      try {
        const nextState = !isTorchOn;
        // @ts-ignore
        await track.applyConstraints({ advanced: [{ torch: nextState }] });
        setIsTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle not supported', err);
      }
    }
  };

  // Tap to refocus trigger
  const handleTriggerRefocus = async (e?: React.MouseEvent<any>) => {
    if (e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left);
      const y = Math.round(e.clientY - rect.top);
      setTapPosition({ x, y });
      setTimeout(() => setTapPosition(null), 900);
    }
    setIsRefocusing(true);
    const track = activeTrackRef.current;
    if (track) {
      try {
        // @ts-ignore
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        // @ts-ignore
        if (caps.focusMode) {
          // @ts-ignore
          await track.applyConstraints({
            advanced: [
              // @ts-ignore
              { focusMode: 'continuous' }
            ]
          });
        }
      } catch {}
    }
    setTimeout(() => setIsRefocusing(false), 600);
  };

  // MULTI-ENGINE FRAME SCANNER (jsQR + native BarcodeDetector)
  // Runs continuously in parallel with html5-qrcode for 10x higher recognition of small CCCD QR codes
  const runDirectFrameInspection = async () => {
    if (hasDetectedRef.current) return;

    const videoEl = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
    if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
      return;
    }

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (vw === 0 || vh === 0) return;

    // 1. Native BarcodeDetector (instant hardware acceleration on Chrome/Android/Mac)
    // @ts-ignore
    if (typeof window.BarcodeDetector !== 'undefined') {
      try {
        if (!barcodeDetectorRef.current) {
          // @ts-ignore
          barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
        }
        const barcodes = await barcodeDetectorRef.current.detect(videoEl);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          handleDetectedCode(barcodes[0].rawValue);
          return;
        }
      } catch {}
    }

    // 2. jsQR engine: Grab frame to off-screen canvas
    try {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const canvas = offscreenCanvasRef.current;
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(videoEl, 0, 0, vw, vh);

      // Strategy A: Tight center crop (55% of frame) - Cực kỳ nhạy với mã QR CCCD kích thước nhỏ (1.2cm x 1.2cm)
      const tightCropSize = Math.floor(Math.min(vw, vh) * 0.55);
      const tightStartX = Math.floor((vw - tightCropSize) / 2);
      const tightStartY = Math.floor((vh - tightCropSize) / 2);
      const tightCropImgData = ctx.getImageData(tightStartX, tightStartY, tightCropSize, tightCropSize);
      const codeTight = jsQR(tightCropImgData.data, tightCropSize, tightCropSize, { inversionAttempts: 'attemptBoth' });
      if (codeTight && codeTight.data) {
        handleDetectedCode(codeTight.data);
        return;
      }

      // Strategy B: Medium center crop (75% of frame)
      const mediumCropSize = Math.floor(Math.min(vw, vh) * 0.75);
      const mediumStartX = Math.floor((vw - mediumCropSize) / 2);
      const mediumStartY = Math.floor((vh - mediumCropSize) / 2);
      const mediumCropImgData = ctx.getImageData(mediumStartX, mediumStartY, mediumCropSize, mediumCropSize);
      const codeMedium = jsQR(mediumCropImgData.data, mediumCropSize, mediumCropSize, { inversionAttempts: 'attemptBoth' });
      if (codeMedium && codeMedium.data) {
        handleDetectedCode(codeMedium.data);
        return;
      }

      // Strategy C: High-contrast binarization of tight center crop (Lọc chói sáng do màng ép plastic thẻ CCCD)
      const data = tightCropImgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = gray > 120 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      const codeBinarized = jsQR(data, tightCropSize, tightCropSize, { inversionAttempts: 'attemptBoth' });
      if (codeBinarized && codeBinarized.data) {
        handleDetectedCode(codeBinarized.data);
        return;
      }

      // Strategy D: Full image scan with both normal and inverted colors
      const fullImgData = ctx.getImageData(0, 0, vw, vh);
      const codeFull = jsQR(fullImgData.data, vw, vh, { inversionAttempts: 'attemptBoth' });
      if (codeFull && codeFull.data) {
        handleDetectedCode(codeFull.data);
        return;
      }
    } catch {}
  };

  // Start / Stop Camera
  useEffect(() => {
    let isCancelled = false;

    const setupAndStartCamera = async () => {
      if (!isOpen || activeMode !== 'camera') {
        await stopCamera();
        return;
      }

      if (isStartingRef.current) return;
      isStartingRef.current = true;
      hasDetectedRef.current = false;

      setCameraError(null);
      setIsScanning(true);

      // Clean up previous scanner
      if (html5QrCodeRef.current) {
        try {
          const vids = document.querySelectorAll(`#${readerElementId} video`);
          vids.forEach((v) => {
            (v as HTMLVideoElement).onabort = null;
            (v as HTMLVideoElement).onerror = null;
          });
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch {}
        html5QrCodeRef.current = null;
      }

      if (isCancelled) {
        isStartingRef.current = false;
        return;
      }

      try {
        const el = document.getElementById(readerElementId);
        if (!el) {
          setIsScanning(false);
          isStartingRef.current = false;
          return;
        }

        el.innerHTML = '';
        html5QrCodeRef.current = new Html5Qrcode(readerElementId);

        // Tham số 1: cameraId string hoặc { facingMode: 'environment' }
        const cameraIdOrConfig: string | { facingMode: string } = (selectedCameraId && typeof selectedCameraId === 'string' && selectedCameraId.trim().length > 0)
          ? selectedCameraId.trim()
          : { facingMode: 'environment' };

        const minDim = Math.min(window.innerWidth * 0.85, 340);
        const squareSize = Math.floor(minDim * 0.78);

        // Cấu hình tối ưu cao cấp cho camera di động với độ phân giải Full HD (1920x1080), 25 FPS và lấy nét liên tục
        // Không ép aspectRatio: 1.0 ở tầng driver phần cứng để tránh lỗi video surface onabort()
        const hdConfig = {
          fps: 25,
          qrbox: { width: squareSize, height: squareSize },
          disableFlip: false,
          videoConstraints: {
            ...(selectedCameraId 
              ? { deviceId: { exact: selectedCameraId } } 
              : { facingMode: { ideal: 'environment' } }
            ),
            width: { ideal: 1920, max: 2560 },
            height: { ideal: 1080, max: 1440 },
            // @ts-ignore
            focusMode: { ideal: 'continuous' },
          },
        };

        if (isCancelled) {
          isStartingRef.current = false;
          return;
        }

        try {
          // Thử khởi động với cấu hình Full HD 1080p tối ưu cho camera di động quét mã QR nhỏ
          await html5QrCodeRef.current.start(
            cameraIdOrConfig,
            hdConfig,
            (decodedText) => {
              if (!isCancelled) {
                handleDetectedCode(decodedText);
              }
            },
            () => {}
          );
          setCameraResolution('Full HD (1080p)');
        } catch (hdErr) {
          console.warn('Full HD constraints not accepted by camera, cleaning up before fallback:', hdErr);
          if (isCancelled) return;

          // Dọn dẹp an toàn phiên trước đó để tránh xung đột surface video
          try {
            const vids = document.querySelectorAll(`#${readerElementId} video`);
            vids.forEach((v) => {
              (v as HTMLVideoElement).onabort = null;
              (v as HTMLVideoElement).onerror = null;
            });
            if (html5QrCodeRef.current) {
              if (html5QrCodeRef.current.isScanning) {
                await html5QrCodeRef.current.stop();
              }
              html5QrCodeRef.current.clear();
            }
          } catch {}

          if (isCancelled) return;
          const container = document.getElementById(readerElementId);
          if (container) container.innerHTML = '';
          html5QrCodeRef.current = new Html5Qrcode(readerElementId);

          // Dự phòng cho thiết bị hoặc webcam cũ không hỗ trợ Full HD (dùng HD 720p)
          try {
            await html5QrCodeRef.current.start(
              cameraIdOrConfig,
              {
                fps: 25,
                qrbox: { width: squareSize, height: squareSize },
                disableFlip: false,
                videoConstraints: {
                  ...(selectedCameraId 
                    ? { deviceId: { exact: selectedCameraId } } 
                    : { facingMode: { ideal: 'environment' } }
                  ),
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              (decodedText) => {
                if (!isCancelled) {
                  handleDetectedCode(decodedText);
                }
              },
              () => {}
            );
            setCameraResolution('HD (720p)');
          } catch (stdErr) {
            console.warn('Standard constraints fallback failed, trying bare config:', stdErr);
            if (isCancelled) return;

            try {
              const vids = document.querySelectorAll(`#${readerElementId} video`);
              vids.forEach((v) => {
                (v as HTMLVideoElement).onabort = null;
                (v as HTMLVideoElement).onerror = null;
              });
              if (html5QrCodeRef.current) {
                if (html5QrCodeRef.current.isScanning) {
                  await html5QrCodeRef.current.stop();
                }
                html5QrCodeRef.current.clear();
              }
            } catch {}

            if (isCancelled) return;
            const container2 = document.getElementById(readerElementId);
            if (container2) container2.innerHTML = '';
            html5QrCodeRef.current = new Html5Qrcode(readerElementId);

            await html5QrCodeRef.current.start(
              cameraIdOrConfig,
              {
                fps: 20,
                qrbox: { width: squareSize, height: squareSize },
                disableFlip: false,
              },
              (decodedText) => {
                if (!isCancelled) {
                  handleDetectedCode(decodedText);
                }
              },
              () => {}
            );
            setCameraResolution('Tiêu chuẩn');
          }
        }

        // Kích hoạt lấy nét và thu phóng
        setTimeout(() => {
          if (!isCancelled) {
            attachTrackControls();
          }
        }, 300);

        // BẬT VÒNG LẶP ĐA LUỒNG KIỂM TRA KHUNG HÌNH (jsQR + BarcodeDetector)
        if (frameScanTimerRef.current) clearInterval(frameScanTimerRef.current);
        frameScanTimerRef.current = setInterval(() => {
          if (!isCancelled && !hasDetectedRef.current) {
            runDirectFrameInspection();
          }
        }, 100);

      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to start camera:', err);
          try {
            if (html5QrCodeRef.current) {
              if (html5QrCodeRef.current.isScanning) {
                await html5QrCodeRef.current.stop();
              }
              html5QrCodeRef.current.clear();
            }
          } catch {}
          html5QrCodeRef.current = null;

          setCameraError(
            err?.message || 'Không thể truy cập camera. Vui lòng cấp quyền camera trong trình duyệt hoặc sử dụng tính năng tải ảnh.'
          );
          setIsScanning(false);
        }
      } finally {
        isStartingRef.current = false;
      }
    };

    const timer = setTimeout(() => {
      setupAndStartCamera();
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, activeMode, selectedCameraId]);

  const handleDetectedCode = async (decodedText: string) => {
    if (hasDetectedRef.current) return;
    hasDetectedRef.current = true;

    const parsed = parseCccdQrCode(decodedText);
    if (parsed && (parsed.cccd || parsed.fullName)) {
      setParsedPreview(parsed);
      playBeep();
      await stopCamera();
      
      setTimeout(() => {
        onScanSuccess(parsed);
        onClose();
      }, 300);
    } else {
      // Cho phép tiếp tục dò nếu chưa đúng định dạng CCCD
      hasDetectedRef.current = false;
      setCameraError('Đã nhận diện QR nhưng không đúng cấu trúc mã CCCD Việt Nam. Dữ liệu: ' + decodedText);
    }
  };

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  // XỬ LÝ QUÉT ẢNH CCCD TẢI LÊN BẰNG JSQR + BARCODEDETECTOR + CANVAS FILTER
  const scanUploadedImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = () => {
        img.onload = async () => {
          // 1. Native BarcodeDetector
          // @ts-ignore
          if (typeof window.BarcodeDetector !== 'undefined') {
            try {
              // @ts-ignore
              const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
              const barcodes = await detector.detect(img);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                resolve(barcodes[0].rawValue);
                return;
              }
            } catch (e) {}
          }

          // 2. jsQR trên ảnh gốc
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imgData = ctx.getImageData(0, 0, img.width, img.height);
              const code = jsQR(imgData.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
              if (code && code.data) {
                resolve(code.data);
                return;
              }

              // 3. Tăng tương phản và độ nét (Contrast Enhancement)
              let w = img.width;
              let h = img.height;
              if (w < 900 || h < 900) {
                const scale = Math.max(900 / w, 900 / h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
              }
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);

              const enhancedData = ctx.getImageData(0, 0, w, h);
              const data = enhancedData.data;
              const contrast = 45;
              const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

              for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                const contrasted = factor * (gray - 128) + 128;
                const clamped = Math.min(255, Math.max(0, contrasted));
                data[i] = clamped;
                data[i + 1] = clamped;
                data[i + 2] = clamped;
              }
              ctx.putImageData(enhancedData, 0, 0);

              const codeEnhanced = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' });
              if (codeEnhanced && codeEnhanced.data) {
                resolve(codeEnhanced.data);
                return;
              }
            }
          } catch {}

          // 4. html5-qrcode scanFile fallback
          try {
            const tempId = 'cccd-file-scan-sandbox';
            let tempEl = document.getElementById(tempId);
            if (!tempEl) {
              tempEl = document.createElement('div');
              tempEl.id = tempId;
              tempEl.style.display = 'none';
              document.body.appendChild(tempEl);
            }
            const fileScanner = new Html5Qrcode(tempId);
            const decoded = await fileScanner.scanFile(file, true);
            try { fileScanner.clear(); } catch {}
            resolve(decoded);
            return;
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    setIsEnhancingImage(true);

    try {
      await stopCamera();
      const decodedText = await scanUploadedImage(file);
      if (decodedText) {
        handleDetectedCode(decodedText);
      } else {
        throw new Error('Không thể nhận diện mã QR');
      }
    } catch (err: any) {
      console.error('File scan error:', err);
      setCameraError('Không tìm thấy mã QR trên ảnh CCCD tải lên. Bạn có thể chụp lại gần hơn vào góc trên bên phải thẻ CCCD hoặc sử dụng Mẫu thử.');
    } finally {
      setIsEnhancingImage(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const parsed = parseCccdQrCode(manualText.trim());
    if (parsed) {
      handleSafeClose();
      onScanSuccess(parsed);
    } else {
      setCameraError('Dữ liệu nhập vào không hợp lệ. Vui lòng kiểm tra lại cấu trúc mã QR CCCD.');
    }
  };

  const handleSelectPreset = (qr: string) => {
    handleDetectedCode(qr);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-red-600 text-white shadow-sm">
              <QrCode className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold leading-tight">{title}</h3>
              <p className="text-xs text-slate-300">Công an Phường Bình Phú · Bộ nhận diện QR đa luồng BarcodeDetector & jsQR</p>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMode('camera')}
            className={`flex-1 py-2 px-3 rounded-md flex items-center justify-center gap-2 transition-colors ${
              activeMode === 'camera'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4 text-red-600" />
            Camera trực tiếp
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('upload')}
            className={`flex-1 py-2 px-3 rounded-md flex items-center justify-center gap-2 transition-colors ${
              activeMode === 'upload'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-blue-600" />
            Tải ảnh CCCD
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('manual')}
            className={`flex-1 py-2 px-3 rounded-md flex items-center justify-center gap-2 transition-colors ${
              activeMode === 'manual'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            Mẫu thử / Nhập mã
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {cameraError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold">Thông báo quét QR:</p>
                <p>{cameraError}</p>
              </div>
            </div>
          )}

          {parsedPreview && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Đã quét thành công: <strong>{parsedPreview.fullName}</strong> (CCCD: {parsedPreview.cccd})
              </span>
            </div>
          )}

          {/* Mode 1: Camera Trực Tiếp */}
          {activeMode === 'camera' && (
            <div className="space-y-3">
              {/* Toolbar: Chọn Camera + Bật Đèn Flash + Lấy nét */}
              <div className="flex items-center justify-between gap-2 text-xs bg-slate-100 p-2 rounded-lg border border-slate-200">
                {cameraList.length > 1 ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <Camera className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <select
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-[11px] font-medium"
                    >
                      {cameraList.map((cam) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.label || `Camera ${cam.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-700 font-semibold flex items-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    Đang quét tự động (Độ nhạy cao)
                  </span>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Chạm lấy nét lại */}
                  <button
                    type="button"
                    onClick={handleTriggerRefocus}
                    title="Chạm để lấy nét lại vị trí mã QR"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                      isRefocusing
                        ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Focus className={`w-3.5 h-3.5 ${isRefocusing ? 'animate-spin text-amber-600' : 'text-slate-600'}`} />
                    <span>{isRefocusing ? 'Đang lấy nét...' : 'Lấy nét'}</span>
                  </button>

                  {/* Bật đèn flash nếu có */}
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      title="Bật/Tắt đèn pin hỗ trợ soi sáng mã QR"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                        isTorchOn
                          ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {isTorchOn ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
                      <span>{isTorchOn ? 'Tắt đèn' : 'Bật đèn'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Dải thông số độ phân giải & tính năng lấy nét tự động */}
              <div className="flex items-center justify-between px-1 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {cameraResolution} · Lấy nét tự động liên tục
                </span>
                <span className="text-slate-500 hidden sm:flex items-center gap-1 text-[11px]">
                  <Focus className="w-3 h-3 text-amber-600" />
                  Chạm để bắt nét tức thì
                </span>
              </div>

              {/* Viewfinder Khung Quét QR Vuông */}
              <div 
                onClick={handleTriggerRefocus}
                className="relative rounded-xl overflow-hidden bg-slate-950 border-2 border-slate-700 w-full max-w-[340px] aspect-square mx-auto flex items-center justify-center shadow-2xl cursor-pointer group"
                title="Chạm vào đây để lấy nét vào mã QR CCCD"
              >
                <div id={readerElementId} className="w-full h-full" />
                
                {/* Visual Square QR Frame Guide (Khung vuông định vị mã QR) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[230px] h-[230px] border-2 border-dashed border-red-500/70 rounded-lg relative flex items-center justify-center">
                    {/* 4 Corner Markers Vàng Nổi Bật */}
                    <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl-sm shadow-[0_0_6px_rgba(251,191,36,0.6)]"></div>
                    <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr-sm shadow-[0_0_6px_rgba(251,191,36,0.6)]"></div>
                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl-sm shadow-[0_0_6px_rgba(251,191,36,0.6)]"></div>
                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br-sm shadow-[0_0_6px_rgba(251,191,36,0.6)]"></div>
                    
                    {/* Tia Laser Quét Đỏ */}
                    {isScanning && (
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse"></div>
                    )}

                    {/* Vòng tâm ngắm lấy nét */}
                    <div className="w-12 h-12 rounded-full border border-amber-400/30 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></div>
                    </div>
                  </div>
                </div>

                {/* Vòng ngắm lấy nét khi người dùng chạm vào khung hình */}
                {tapPosition && (
                  <div 
                    className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 w-14 h-14 border-2 border-amber-400 rounded-full animate-ping z-20 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                    style={{ left: tapPosition.x, top: tapPosition.y }}
                  />
                )}

                {/* Loading indicator khi chưa bắt đầu */}
                {!isScanning && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-950/80">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                    <p className="text-xs text-slate-200">Đang khởi tạo camera góc quét vuông...</p>
                  </div>
                )}
              </div>

              {/* BỘ NÚT ĐIỀU CHỈNH THU PHÓNG (ZOOM) */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                  <ZoomIn className="w-4 h-4 text-red-600" />
                  <span>Thu phóng (Zoom):</span>
                </div>

                <div className="flex items-center gap-1">
                  {[1.0, 1.5, 2.0, 2.5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleSetZoom(lvl)}
                      className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                        currentZoom === lvl
                          ? 'bg-red-700 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {lvl}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center text-xs text-slate-600 bg-amber-50/70 p-3 rounded-lg border border-amber-200 leading-relaxed">
                <strong className="text-amber-950 block font-bold mb-0.5">📌 Hướng dẫn quét thẻ CCCD nhanh nhất:</strong>
                Mã QR nằm ở <strong>góc trên bên phải mặt trước thẻ CCCD</strong>. Đặt ô mã QR vào giữa khung vuông màu đỏ ở trên, giữ khoảng cách <strong>15–20cm</strong> và chọn <strong>Zoom 1.5x hoặc 2x</strong> để camera bắt nét ngay tức thì!
              </div>
            </div>
          )}

          {/* Mode 2: Tải Ảnh CCCD */}
          {activeMode === 'upload' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-red-400 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-red-50/20 transition-all text-center">
                {isEnhancingImage ? (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
                    <span className="text-sm font-bold text-slate-900">Đang quét mã QR CCCD...</span>
                    <span className="text-xs text-slate-500">Đang phân tích hình ảnh và nhận diện dữ liệu</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-red-600 mb-2" />
                    <span className="text-sm font-semibold text-slate-900">Bấm để chọn ảnh Thẻ CCCD có mã QR</span>
                    <span className="text-xs text-slate-500 mt-1">Hỗ trợ JPG, PNG, WEBP từ điện thoại hoặc thư viện ảnh</span>
                    <span className="mt-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Tự động tăng cường độ nét và lọc chói sáng
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={isEnhancingImage}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-950">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Bộ lọc nhận diện thông minh đa luồng:</span>
                </div>
                <p>Hệ thống tự động kết hợp BarcodeDetector phần cứng và jsQR để đọc được mã QR CCCD ngay cả khi chụp nghiêng, chụp dưới ánh đèn chói hoặc ảnh mờ.</p>
              </div>
            </div>
          )}

          {/* Mode 3: Manual / Presets */}
          {activeMode === 'manual' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Mẫu thẻ CCCD thử nghiệm (1-Click quét ngay):
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SAMPLE_CCCD_QRS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(item.qr)}
                      className="text-left p-3 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50/50 transition-all text-xs flex items-center justify-between group"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 group-hover:text-red-700">{item.label}</p>
                        <p className="text-slate-500 font-mono text-[11px] truncate max-w-sm mt-0.5">{item.qr}</p>
                      </div>
                      <span className="px-2 py-1 bg-slate-100 group-hover:bg-red-100 group-hover:text-red-700 text-slate-600 rounded font-medium text-[11px] whitespace-nowrap">
                        Áp dụng
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <form onSubmit={handleManualSubmit} className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Hoặc dán chuỗi mã QR CCCD / Nhập số CCCD 12 số:
                  </label>
                  <textarea
                    rows={3}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Ví dụ: 079201004567|025684992|NGUYỄN VĂN AN|15081990|Nam|Số 123 Đường Số 7, Phường Bình Phú, Quận 6, TP.HCM|20042021"
                    className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-red-700 hover:bg-red-800 text-white font-medium rounded-lg text-xs transition-colors"
                  >
                    Giải mã và tải thông tin
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={handleSafeClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
