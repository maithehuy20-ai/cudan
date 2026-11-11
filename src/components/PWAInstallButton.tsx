import React, { useState } from 'react';
import { 
  Download, Smartphone, Tablet, Share2, PlusSquare, 
  X, CheckCircle, ShieldCheck, Sparkles 
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'card';
  onDismissBanner?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'header',
  onDismissBanner 
}) => {
  const { isInstallable, isInstalled, isIOS, isMobileOrTablet, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running standalone (already installed as PWA on phone/tablet), don't show install buttons
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 4000);
      }
    } else {
      // If native deferred prompt is not available (e.g. iOS Safari, iPad, or already viewed)
      setShowGuideModal(true);
    }
  };

  if (variant === 'banner') {
    return (
      <>
        <div className="bg-gradient-to-r from-red-900 via-red-800 to-amber-900 text-white px-3 sm:px-4 py-2.5 shadow-md border-b border-red-700/60 print:hidden relative">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-sm shrink-0">
                <Smartphone className="w-4 h-4 hidden xs:block" />
                <Tablet className="w-4 h-4 block xs:hidden" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-200">Cài đặt Cư Trú KP16 lên Thiết bị</span>
                  <span className="bg-red-700/80 text-white text-[10px] px-1.5 py-0.2 rounded font-semibold border border-red-500/50">PWA 2026</span>
                </div>
                <p className="text-[11px] text-slate-200 mt-0.5">
                  Mở trực tiếp từ Màn hình chính trên Điện thoại & Máy tính bảng · Quét mã QR CCCD tức thì và mượt mà
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Cài Đặt Ngay</span>
              </button>
              {onDismissBanner && (
                <button
                  type="button"
                  onClick={onDismissBanner}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Đóng thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Guide */}
        {showGuideModal && <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />}
      </>
    );
  }

  // Header button variant
  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Cài đặt ứng dụng lên Điện thoại hoặc Máy tính bảng"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-emerald-400/40 transition active:scale-95 shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-amber-200" />
        <span className="hidden sm:inline">Cài đặt App</span>
        <span className="inline sm:hidden">Cài App</span>
      </button>

      {showGuideModal && <InstallGuideModal isIOS={isIOS} onClose={() => setShowGuideModal(false)} />}
    </>
  );
};

// Modal hướng dẫn cài đặt trực quan cho iOS Safari & Android
const InstallGuideModal: React.FC<{ isIOS: boolean; onClose: () => void }> = ({ isIOS, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-800 to-red-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-white">
                Cài Đặt Lên Điện Thoại & Máy Tính Bảng
              </h3>
              <p className="text-[11px] text-amber-200">Khu phố 16 · Ứng dụng Quản lý Cư trú</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-900 leading-relaxed font-medium">
              Sau khi cài đặt, ứng dụng sẽ có biểu tượng riêng trên Màn hình chính (Home Screen), hoạt động toàn màn hình như ứng dụng gốc, lưu trữ dữ liệu an toàn và hỗ trợ quét camera CCCD tốc độ cao!
            </p>
          </div>

          {isIOS ? (
            /* Hướng dẫn cho iPhone / iPad */
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-red-700">
                Hướng dẫn cho iPhone & iPad (Trình duyệt Safari):
              </h4>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                      Bấm nút <strong>Chia sẻ</strong> <Share2 className="w-3.5 h-3.5 text-blue-600 inline" />
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Nút này nằm ở thanh công cụ dưới đáy màn hình iPhone hoặc góc trên của iPad.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                      Chọn <strong>Thêm vào MH chính</strong> <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" />
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      (Tên tiếng Anh: <em>"Add to Home Screen"</em>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Bấm <strong>Thêm</strong> (Add) ở góc trên bên phải
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Biểu tượng <strong>Cư Trú KP16</strong> sẽ xuất hiện ngay trên màn hình thiết bị.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Hướng dẫn cho Android / Chrome / Edge */
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-red-700">
                Hướng dẫn cho Điện thoại & Máy tính bảng Android:
              </h4>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Nhấn vào menu <strong>3 dấu chấm (⋮)</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ở góc trên bên phải trình duyệt Chrome / Cốc Cốc / Samsung Internet.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      (Tên tiếng Anh: <em>"Install App"</em> hoặc <em>"Add to Home screen"</em>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Xác nhận <strong>Cài đặt</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ứng dụng sẽ tự động tải về và ghim trên màn hình điện thoại / máy tính bảng như app từ Google Play.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Đạt tiêu chuẩn an toàn PWA, không chiếm dung lượng bộ nhớ máy.</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition"
          >
            Đã Hiểu · Đóng Hướng Dẫn
          </button>
        </div>
      </div>
    </div>
  );
};
