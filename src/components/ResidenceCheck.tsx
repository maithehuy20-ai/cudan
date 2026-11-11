import React, { useState, useEffect } from 'react';
import { 
  ScanLine, CheckCircle2, AlertCircle, Camera, Upload, 
  FileText, ShieldCheck, Printer, Save, RefreshCw, User, 
  Building2, Calendar, Clock, ShieldAlert, Sparkles 
} from 'lucide-react';
import { useResidents } from '../context/ResidentContext';
import { QrScannerModal } from './QrScannerModal';
import { ParsedCccdQr, getTowerFromApartmentCode, SAMPLE_CCCD_QRS } from '../utils/cccdParser';
import { ResidenceStatus } from '../types/resident';
import { calculateExtensionDate } from '../utils/dateHelper';

export const ResidenceCheck: React.FC = () => {
  const { 
    residents, 
    findResidentByCccd, 
    updateResident, 
    addResident, 
    addCheckLog, 
    inspectTargetCccd, 
    setInspectTargetCccd,
    setActiveTab,
    showToast
  } = useResidents();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [matchedResident, setMatchedResident] = useState<any | null>(null);
  const [isNewResident, setIsNewResident] = useState(false);

  // Form Fields as explicitly requested in Section III:
  // NGÀY GIỜ KIỂM TRA
  // MÃ CĂN HỘ
  // SCAN CCCD
  // SỐ CCCD
  // SỐ CMND
  // HỌ TÊN
  // GIỚI TÍNH
  // NGÀY SINH
  // NƠI THƯỜNG TRÚ
  // NGÀY CẤP
  // TÌNH TRẠNG CƯ TRÚ
  // ẢNH CCCD MẶT TRƯỚC
  // ẢNH CCCD MẶT SAU
  // Ảnh người
  const nowFormatted = new Date().toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const [checkDateTime, setCheckDateTime] = useState<string>(nowFormatted);
  const [apartmentCode, setApartmentCode] = useState<string>('A.1201');
  const [officerName, setOfficerName] = useState<string>('Đ/c Thiếu tá Lê Văn Thành (CSKV KP16)');
  const [cccd, setCccd] = useState<string>('');
  const [cmndOld, setCmndOld] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [gender, setGender] = useState<'Nam' | 'Nữ' | 'Khác'>('Nam');
  const [birthDate, setBirthDate] = useState<string>('');
  const [permanentAddress, setPermanentAddress] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>('');
  const [residenceStatus, setResidenceStatus] = useState<ResidenceStatus>('Thường trú');
  
  // Media fields
  const [cccdFrontUrl, setCccdFrontUrl] = useState<string>('');
  const [cccdBackUrl, setCccdBackUrl] = useState<string>('');
  const [personPhotoUrl, setPersonPhotoUrl] = useState<string>('');
  
  // Inspection assessment
  const [resultStatus, setResultStatus] = useState<'Hợp lệ' | 'Vi phạm chưa đăng ký' | 'Quá hạn tạm trú' | 'Cần xác minh thêm'>('Hợp lệ');
  const [notes, setNotes] = useState<string>('Kiểm tra cư trú thực tế tại căn hộ. Đã đối chiếu thông tin với cơ sở dữ liệu.');
  const [criminalRecord, setCriminalRecord] = useState<string>('Không tiền án/tiền sự');
  const [hasCriminalRecord, setHasCriminalRecord] = useState<boolean>(false);

  // If redirected with target CCCD
  useEffect(() => {
    if (inspectTargetCccd) {
      handleLookupByCccd(inspectTargetCccd);
      setInspectTargetCccd(null);
    }
  }, [inspectTargetCccd]);

  const handleLookupByCccd = (targetCccd: string) => {
    if (!targetCccd || !targetCccd.trim()) return;
    const cleanCccd = targetCccd.trim();
    const existing = findResidentByCccd(cleanCccd);
    setCccd(cleanCccd);

    if (existing) {
      setMatchedResident(existing);
      setIsNewResident(false);
      setApartmentCode(existing.apartmentCode);
      setFullName(existing.fullName);
      setGender(existing.gender);
      setBirthDate(existing.birthDate);
      setCmndOld(existing.cmndOld || '');
      setPermanentAddress(existing.permanentAddress);
      setResidenceStatus(existing.residenceStatus);
      setPersonPhotoUrl(existing.avatarUrl || '');
      setCccdFrontUrl(existing.cccdFrontUrl || '');
      setCccdBackUrl(existing.cccdBackUrl || '');
      setCriminalRecord(existing.criminalRecord);
      setHasCriminalRecord(existing.hasCriminalRecord);
      
      if (existing.hasCriminalRecord) {
        setResultStatus('Cần xác minh thêm');
        setNotes(`Đối tượng có hồ sơ tiền án/tiền sự: ${existing.criminalRecord}. Cần kiểm tra kỹ việc chấp hành pháp luật tại địa phương.`);
      } else if (existing.residenceStatus === 'Chưa đăng ký') {
        setResultStatus('Vi phạm chưa đăng ký');
        setNotes('Phát hiện cư dân chưa làm thủ tục đăng ký tạm trú/thông báo lưu trú theo quy định.');
      } else {
        setResultStatus('Hợp lệ');
        setNotes('Thông tin đối chiếu trùng khớp hoàn toàn với hồ sơ quản lý cư trú Khu phố 16.');
      }

      // Tự động ghi nhật ký hành động tra cứu
      addCheckLog({
        checkDateTime: new Date().toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        apartmentCode: existing.apartmentCode,
        officerName,
        actionType: 'XÁC MINH CƯ TRÚ',
        actionDescription: `Tra cứu xác minh số CCCD ${cleanCccd} - ${existing.fullName}`,
        cccd: cleanCccd,
        cmndOld: existing.cmndOld || '',
        fullName: existing.fullName,
        gender: existing.gender,
        birthDate: existing.birthDate,
        permanentAddress: existing.permanentAddress,
        residenceStatus: existing.residenceStatus,
        resultStatus: existing.hasCriminalRecord ? 'Cần xác minh thêm' : (existing.residenceStatus === 'Chưa đăng ký' ? 'Vi phạm chưa đăng ký' : 'Hợp lệ'),
        notes: `Tra cứu thành công hồ sơ cư dân ${existing.fullName}. Căn hộ ${existing.apartmentCode}.`,
        matchedResidentId: existing.id,
      });

      showToast(`Đã tìm thấy hồ sơ: ${existing.fullName} (${existing.apartmentCode})`, 'success');
    } else {
      // ĐIỀU KIỆN: Khi kiểm tra cư trú không có thông tin tại Quản lý cư trú -> TỰ ĐỘNG THÊM VÀO QUẢN LÝ CƯ TRÚ
      const targetApt = apartmentCode.trim() || 'A.1201';
      const defaultName = fullName.trim() || `CÔNG DÂN (${cleanCccd.slice(-4)})`;
      const autoCreated = addResident({
        apartmentCode: targetApt,
        fullName: defaultName,
        birthDate: birthDate || '01/01/1990',
        gender: gender || 'Nam',
        cccd: cleanCccd,
        cmndOld: cmndOld || '',
        phoneNumber: '',
        relationship: 'Khách thuê',
        residenceStatus: 'Tạm trú',
        nationality: 'Việt Nam',
        permanentAddress: permanentAddress || 'Chưa cập nhật',
        temporaryAddress: `Căn ${targetApt} Chung cư Bình Phú, KP16`,
        currentAddress: `Căn ${targetApt} Chung cư Bình Phú, KP16`,
        headOfHousehold: defaultName,
        maritalStatus: 'Độc thân',
        registrationDate: new Date().toLocaleDateString('vi-VN'),
        expiryDate: calculateExtensionDate(2),
        criminalRecord: 'Không tiền án/tiền sự',
        hasCriminalRecord: false,
      });

      setMatchedResident(autoCreated);
      setIsNewResident(false);
      setFullName(autoCreated.fullName);
      setResidenceStatus(autoCreated.residenceStatus);
      setResultStatus('Vi phạm chưa đăng ký');
      setNotes('Số CCCD chưa có trong hệ thống -> Đã tự động thêm vào Quản lý cư trú. Cần cập nhật hoàn tất thông tin nhân khẩu.');
      
      // Tự động ghi nhật ký hành động tự động thêm nhân khẩu
      addCheckLog({
        checkDateTime: new Date().toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        apartmentCode: targetApt,
        officerName,
        actionType: 'TỰ ĐỘNG THÊM NHÂN KHẨU',
        actionDescription: `Kiểm tra số CCCD ${cleanCccd} chưa có -> Tự động thêm hồ sơ vào Quản lý cư trú`,
        cccd: cleanCccd,
        cmndOld: cmndOld || '',
        fullName: autoCreated.fullName,
        gender: autoCreated.gender,
        birthDate: autoCreated.birthDate,
        permanentAddress: autoCreated.permanentAddress,
        residenceStatus: autoCreated.residenceStatus,
        resultStatus: 'Vi phạm chưa đăng ký',
        notes: 'Chưa có thông tin tại KP16 -> Hệ thống đã tự động khởi tạo hồ sơ nhân khẩu tạm trú.',
        matchedResidentId: autoCreated.id,
      });

      showToast(`Số CCCD ${cleanCccd} chưa có -> ĐÃ TỰ ĐỘNG THÊM VÀO QUẢN LÝ CƯ TRÚ!`, 'success');
    }
  };

  const handleQrSuccess = (parsed: ParsedCccdQr) => {
    setCccd(parsed.cccd);
    setCmndOld(parsed.cmndOld);
    setFullName(parsed.fullName);
    setBirthDate(parsed.birthDate);
    setGender(parsed.gender);
    setPermanentAddress(parsed.permanentAddress);
    setIssueDate(parsed.issueDate);

    // Auto lookup in resident database
    const existing = findResidentByCccd(parsed.cccd);
    if (existing) {
      setMatchedResident(existing);
      setIsNewResident(false);
      setApartmentCode(existing.apartmentCode);
      setResidenceStatus(existing.residenceStatus);
      setPersonPhotoUrl(existing.avatarUrl || '');
      setCccdFrontUrl(existing.cccdFrontUrl || '');
      setCccdBackUrl(existing.cccdBackUrl || '');
      setCriminalRecord(existing.criminalRecord);
      setHasCriminalRecord(existing.hasCriminalRecord);
      
      const currentResult = existing.hasCriminalRecord ? 'Cần xác minh thêm' : (existing.residenceStatus === 'Chưa đăng ký' ? 'Vi phạm chưa đăng ký' : 'Hợp lệ');
      const currentNotes = existing.hasCriminalRecord 
        ? `Đối tượng có thông tin tiền án: ${existing.criminalRecord}.` 
        : 'Quét QR CCCD thành công. Trùng khớp với dữ liệu quản lý cư trú Khu phố 16.';
      setResultStatus(currentResult);
      setNotes(currentNotes);

      // TỰ ĐỘNG GHI NHẬT KÝ HÀNH ĐỘNG QUÉT QR CCCD
      addCheckLog({
        checkDateTime: new Date().toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        apartmentCode: existing.apartmentCode,
        officerName,
        actionType: 'QUÉT QR CCCD',
        actionDescription: `Quét camera QR CCCD thẻ công dân ${parsed.fullName} (${parsed.cccd})`,
        cccd: parsed.cccd,
        cmndOld: parsed.cmndOld || existing.cmndOld || '',
        fullName: parsed.fullName,
        gender: parsed.gender,
        birthDate: parsed.birthDate,
        permanentAddress: parsed.permanentAddress || existing.permanentAddress,
        issueDate: parsed.issueDate,
        residenceStatus: existing.residenceStatus,
        resultStatus: currentResult,
        notes: currentNotes,
        matchedResidentId: existing.id,
      });

      showToast(`Quét thành công! Đã khớp dữ liệu cư dân: ${existing.fullName}`, 'success');
    } else {
      // ĐIỀU KIỆN: Khi kiểm tra cư trú không có thông tin tại Quản lý cư trú -> TỰ ĐỘNG THÊM VÀO QUẢN LÝ CƯ TRÚ
      const targetApt = apartmentCode.trim() || 'A.1201';
      const autoCreated = addResident({
        apartmentCode: targetApt,
        fullName: parsed.fullName || 'CÔNG DÂN MỚI',
        birthDate: parsed.birthDate || '01/01/1990',
        gender: parsed.gender,
        cccd: parsed.cccd,
        cmndOld: parsed.cmndOld || '',
        phoneNumber: '',
        relationship: 'Khách thuê',
        residenceStatus: 'Tạm trú',
        nationality: 'Việt Nam',
        permanentAddress: parsed.permanentAddress || '',
        temporaryAddress: `Căn ${targetApt} Chung cư Bình Phú, KP16`,
        currentAddress: `Căn ${targetApt} Chung cư Bình Phú, KP16`,
        headOfHousehold: parsed.fullName || '',
        maritalStatus: 'Độc thân',
        registrationDate: new Date().toLocaleDateString('vi-VN'),
        expiryDate: calculateExtensionDate(2),
        criminalRecord: 'Không tiền án/tiền sự',
        hasCriminalRecord: false,
      });

      setMatchedResident(autoCreated);
      setIsNewResident(false);
      setResidenceStatus('Tạm trú');
      setResultStatus('Vi phạm chưa đăng ký');
      setNotes('Quét QR CCCD thành công. Chưa có dữ liệu tại KP16 -> ĐÃ TỰ ĐỘNG THÊM VÀO QUẢN LÝ CƯ TRÚ!');

      // TỰ ĐỘNG GHI NHẬT KÝ HÀNH ĐỘNG TỰ ĐỘNG THÊM NHÂN KHẨU
      addCheckLog({
        checkDateTime: new Date().toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        apartmentCode: targetApt,
        officerName,
        actionType: 'TỰ ĐỘNG THÊM NHÂN KHẨU',
        actionDescription: `Quét QR CCCD thẻ mới ${parsed.fullName} -> Tự động tạo hồ sơ cư trú căn ${targetApt}`,
        cccd: parsed.cccd,
        cmndOld: parsed.cmndOld || '',
        fullName: parsed.fullName,
        gender: parsed.gender,
        birthDate: parsed.birthDate,
        permanentAddress: parsed.permanentAddress || '',
        issueDate: parsed.issueDate,
        residenceStatus: 'Tạm trú',
        resultStatus: 'Vi phạm chưa đăng ký',
        notes: 'Quét QR CCCD phát hiện công dân chưa đăng ký tại địa bàn -> Đã tự động tạo hồ sơ cư trú KP16.',
        matchedResidentId: autoCreated.id,
      });

      showToast(`Quét thành công! ĐÃ TỰ ĐỘNG THÊM VÀO QUẢN LÝ CƯ TRÚ: ${autoCreated.fullName} (${autoCreated.apartmentCode})`, 'success');
    }
  };

  const handleFileUpload = (setter: (url: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cccd || !fullName || !apartmentCode) {
      showToast('Vui lòng nhập đầy đủ Số CCCD, Họ tên và Mã căn hộ!', 'error');
      return;
    }

    // 1. Save to Check Logs with explicit Action Type
    const log = addCheckLog({
      checkDateTime,
      apartmentCode: apartmentCode.toUpperCase(),
      officerName,
      actionType: 'KIỂM TRA CƯ TRÚ',
      actionDescription: `Lập biên bản kiểm tra cư trú căn hộ ${apartmentCode.toUpperCase()} - Công dân ${fullName}`,
      cccd,
      cmndOld,
      fullName,
      gender,
      birthDate,
      permanentAddress,
      issueDate,
      residenceStatus,
      cccdFrontUrl,
      cccdBackUrl,
      personPhotoUrl,
      resultStatus,
      notes,
      matchedResidentId: matchedResident?.id,
    });

    // 2. Update or Add into resident management database as requested
    if (matchedResident) {
      updateResident(matchedResident.id, {
        apartmentCode: apartmentCode.toUpperCase(),
        fullName,
        gender,
        birthDate,
        permanentAddress,
        residenceStatus,
        avatarUrl: personPhotoUrl || matchedResident.avatarUrl,
        cccdFrontUrl: cccdFrontUrl || matchedResident.cccdFrontUrl,
        cccdBackUrl: cccdBackUrl || matchedResident.cccdBackUrl,
        criminalRecord,
        hasCriminalRecord,
      });
      showToast('Đã lưu lượt kiểm tra và cập nhật thông tin hồ sơ cư trú!', 'success');
    } else {
      // Create new resident
      addResident({
        apartmentCode: apartmentCode.toUpperCase(),
        fullName,
        birthDate: birthDate || '01/01/1990',
        gender,
        cccd,
        cmndOld,
        phoneNumber: '',
        relationship: 'Khách thuê',
        residenceStatus,
        nationality: 'Việt Nam',
        permanentAddress,
        temporaryAddress: apartmentCode,
        currentAddress: `Căn ${apartmentCode} Chung cư Bình Phú, KP16`,
        headOfHousehold: fullName,
        maritalStatus: 'Độc thân',
        registrationDate: new Date().toISOString().slice(0, 10),
        criminalRecord,
        hasCriminalRecord,
        avatarUrl: personPhotoUrl,
        cccdFrontUrl,
        cccdBackUrl,
      });
      showToast('Đã lưu lượt kiểm tra và tự động thêm cư dân mới vào hệ thống!', 'success');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const tower = getTowerFromApartmentCode(apartmentCode);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-red-700" />
            <span>Nghiệp Vụ Kiểm Tra Cư Trú & Quét QR CCCD</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quét mã QR trên CCCD gắn chip để tự động tra cứu, đối chiếu hồ sơ và cập nhật thông tin
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            <ScanLine className="w-4 h-4 text-amber-300" />
            <span>BẬT SCAN MÃ QR CCCD</span>
          </button>
        </div>
      </div>

      {/* Quick Lookup Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="font-semibold text-slate-300 shrink-0">Tra cứu nhanh số CCCD:</span>
          <div className="flex items-center gap-2 flex-1 sm:w-72">
            <input
              type="text"
              placeholder="Nhập 12 số CCCD để tra cứu..."
              value={cccd}
              onChange={(e) => setCccd(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
            <button
              onClick={() => handleLookupByCccd(cccd)}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-lg whitespace-nowrap"
            >
              Tìm kiếm
            </button>
          </div>
        </div>

        {/* Demo Quick Samples for Instant Verification */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-[11px]">
          <span className="text-slate-400 shrink-0">Thử nhanh:</span>
          {SAMPLE_CCCD_QRS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                const parts = s.qr.split('|');
                handleQrSuccess({
                  cccd: parts[0],
                  cmndOld: parts[1],
                  fullName: parts[2],
                  birthDate: parts[3].replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3'),
                  birthDateIso: '',
                  gender: parts[4] as any,
                  permanentAddress: parts[5],
                  issueDate: parts[6] ? parts[6].replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3') : '',
                  raw: s.qr,
                });
              }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded whitespace-nowrap"
            >
              {s.label.split('(')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Match Status Banner */}
      {matchedResident ? (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-emerald-800">
                ĐÃ TÌM THẤY DỮ LIỆU CƯ DÂN TRONG HỆ THỐNG KHU PHỐ 16!
              </p>
              <p className="text-emerald-700 mt-0.5">
                Cư dân: <strong>{matchedResident.fullName}</strong> · Căn hộ: <strong>{matchedResident.apartmentCode}</strong> ({getTowerFromApartmentCode(matchedResident.apartmentCode).towerName}) · Quan hệ: {matchedResident.relationship}
              </p>
              <p className="text-emerald-600 text-[11px] mt-1">
                Toàn bộ thông tin Quản lý Cư trú đã được điền tự động. Bạn có thể chỉnh sửa nội dung bên dưới và bấm Lưu để cập nhật.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
            Khớp hồ sơ
          </span>
        </div>
      ) : isNewResident ? (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-amber-800">
              CÔNG DÂN CHƯA CÓ TRONG CƠ SỞ DỮ LIỆU CƯ TRÚ KHU PHỐ 16
            </p>
            <p className="text-amber-700 mt-0.5">
              Hệ thống đã tự động trích xuất các thông tin từ mã QR CCCD. Vui lòng bổ sung Mã căn hộ và lưu biên bản kiểm tra để đồng thời thêm vào danh sách cư trú.
            </p>
          </div>
        </div>
      ) : null}

      {/* Criminal alert highlight */}
      {hasCriminalRecord && (
        <div className="p-4 bg-red-600 text-white rounded-xl shadow-md flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="text-sm">ĐỐI TƯỢNG CÓ TIỀN ÁN / TIỀN SỰ: {criminalRecord}</span>
          </div>
          <span className="text-[11px] bg-red-900 px-2.5 py-1 rounded uppercase tracking-wide">
            Cảnh báo nghiệp vụ
          </span>
        </div>
      )}

      {/* MAIN INSPECTION FORM (ALL 14 REQUIRED FIELDS) */}
      <form onSubmit={handleSaveCheck} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Phiếu Kiểm Tra Cư Trú Hành Chính
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Khu phố 16 · Phường Bình Phú, Quận 6, TP.HCM
            </span>
          </div>

          {/* Row 1: Ngày giờ kiểm tra, Mã căn hộ, Cán bộ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>NGÀY GIỜ KIỂM TRA</span>
              </label>
              <input
                type="text"
                required
                value={checkDateTime}
                onChange={(e) => setCheckDateTime(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-red-600" />
                <span>MÃ CĂN HỘ <span className="text-red-600">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="VD: A.1201, B.0405, NCC.01"
                  value={apartmentCode}
                  onChange={(e) => setApartmentCode(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold uppercase focus:ring-2 focus:ring-red-500"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-slate-500">
                  {tower.towerName}
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>CÁN BỘ KIỂM TRA</span>
              </label>
              <input
                type="text"
                required
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Row 2: SCAN CCCD & Số CCCD / CMND */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                SCAN CCCD (Mã QR)
              </label>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="w-full p-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <ScanLine className="w-4 h-4 text-amber-300" />
                <span>Quét lại mã QR CCCD</span>
              </button>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                SỐ CCCD (12 số) <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="079..."
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                SỐ CMND CŨ (9 số)
              </label>
              <input
                type="text"
                placeholder="02..."
                value={cmndOld}
                onChange={(e) => setCmndOld(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Row 3: HỌ TÊN, GIỚI TÍNH, NGÀY SINH, NGÀY CẤP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                HỌ TÊN CÔNG DÂN <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="NGUYỄN VĂN A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-red-500 uppercase"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                GIỚI TÍNH
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                NGÀY SINH
              </label>
              <input
                type="text"
                placeholder="dd/mm/yyyy"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                NGÀY CẤP CCCD
              </label>
              <input
                type="text"
                placeholder="dd/mm/yyyy"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Row 4: NƠI THƯỜNG TRÚ & TÌNH TRẠNG CƯ TRÚ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                NƠI THƯỜNG TRÚ (Theo thẻ CCCD)
              </label>
              <input
                type="text"
                placeholder="Địa chỉ thường trú ghi trên thẻ CCCD..."
                value={permanentAddress}
                onChange={(e) => setPermanentAddress(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                TÌNH TRẠNG CƯ TRÚ
              </label>
              <select
                value={residenceStatus}
                onChange={(e) => setResidenceStatus(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
              >
                <option value="Thường trú">Thường trú</option>
                <option value="Tạm trú">Tạm trú</option>
                <option value="Chưa đăng ký">Chưa đăng ký</option>
                <option value="Đã chuyển đi">Đã chuyển đi</option>
              </select>
            </div>
          </div>

          {/* ẢNH CCCD MẶT TRƯỚC, ẢNH CCCD MẶT SAU, ẢNH NGƯỜI THỰC TẾ */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Hình Ảnh Đính Kèm (Ảnh CCCD & Ảnh Người Thực Tế)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Ảnh CCCD Mặt Trước */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                <span className="font-bold text-slate-700 block">ẢNH CCCD MẶT TRƯỚC</span>
                {cccdFrontUrl ? (
                  <img
                    src={cccdFrontUrl}
                    alt="CCCD Mặt trước"
                    className="w-full h-32 object-cover rounded-lg border border-slate-300"
                  />
                ) : (
                  <div className="w-full h-32 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                    Chưa có ảnh mặt trước
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold text-slate-700 text-[11px]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải ảnh mặt trước</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload(setCccdFrontUrl)} className="hidden" />
                </label>
              </div>

              {/* Ảnh CCCD Mặt Sau */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                <span className="font-bold text-slate-700 block">ẢNH CCCD MẶT SAU</span>
                {cccdBackUrl ? (
                  <img
                    src={cccdBackUrl}
                    alt="CCCD Mặt sau"
                    className="w-full h-32 object-cover rounded-lg border border-slate-300"
                  />
                ) : (
                  <div className="w-full h-32 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                    Chưa có ảnh mặt sau
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold text-slate-700 text-[11px]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải ảnh mặt sau</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload(setCccdBackUrl)} className="hidden" />
                </label>
              </div>

              {/* Ảnh Người Thực Tế */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                <span className="font-bold text-slate-700 block">ẢNH NGƯỜI THỰC TẾ</span>
                {personPhotoUrl ? (
                  <img
                    src={personPhotoUrl}
                    alt="Ảnh người thực tế"
                    className="w-full h-32 object-cover rounded-lg border border-slate-300"
                  />
                ) : (
                  <div className="w-full h-32 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                    Chưa có ảnh người
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold text-slate-700 text-[11px]">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Chụp / Tải ảnh người</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload(setPersonPhotoUrl)} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* Đánh giá kết quả & Ghi chú kiểm tra */}
          <div className="space-y-3 pt-2 border-t border-slate-200 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  KẾT QUẢ KIỂM TRA HÀNH CHÍNH
                </label>
                <select
                  value={resultStatus}
                  onChange={(e) => setResultStatus(e.target.value as any)}
                  className={`w-full p-2.5 border rounded-lg font-bold ${
                    resultStatus === 'Hợp lệ'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : resultStatus === 'Vi phạm chưa đăng ký'
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value="Hợp lệ">Hợp lệ - Cư trú đúng quy định</option>
                  <option value="Vi phạm chưa đăng ký">Vi phạm chưa đăng ký tạm trú / thông báo lưu trú</option>
                  <option value="Quá hạn tạm trú">Quá hạn tạm trú cần gia hạn</option>
                  <option value="Cần xác minh thêm">Cần xác minh thêm với cơ quan chức năng</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  TIỀN ÁN / TIỀN SỰ (Nếu phát hiện trong lúc kiểm tra)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasCriminalRecord}
                    onChange={(e) => {
                      setHasCriminalRecord(e.target.checked);
                      if (!e.target.checked) setCriminalRecord('Không tiền án/tiền sự');
                    }}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <input
                    type="text"
                    disabled={!hasCriminalRecord}
                    value={criminalRecord}
                    onChange={(e) => setCriminalRecord(e.target.value)}
                    placeholder="Nhập thông tin tiền án/tiền sự nếu có..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                GHI CHÚ KIỂM TRA / ĐỀ XUẤT XỬ LÝ
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi nhận hiện trạng, việc chấp hành, thời hạn yêu cầu bổ sung giấy tờ..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>In Biên Bản Kiểm Tra</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCccd('');
                  setFullName('');
                  setMatchedResident(null);
                  setIsNewResident(false);
                }}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-colors"
              >
                Làm mới phiếu
              </button>

              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-lg shadow-md transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>LƯU BIÊN BẢN & CẬP NHẬT HỒ SƠ</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScanSuccess={handleQrSuccess}
        title="Quét Mã QR CCCD Kiểm Tra Cư Trú"
      />
    </div>
  );
};
