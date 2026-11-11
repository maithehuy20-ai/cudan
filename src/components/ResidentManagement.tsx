import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Filter, ShieldAlert, CheckCircle, 
  User, Phone, Home, Calendar, Edit3, Trash2, Eye, 
  AlertTriangle, Users, QrCode, Camera, Upload, ExternalLink 
} from 'lucide-react';
import { useResidents } from '../context/ResidentContext';
import { Resident, Relationship, ResidenceStatus, MaritalStatus } from '../types/resident';
import { getTowerFromApartmentCode } from '../utils/cccdParser';
import { QrScannerModal } from './QrScannerModal';
import { evaluateExpiry, calculateExtensionDate } from '../utils/dateHelper';

export const ResidentManagement: React.FC = () => {
  const { 
    residents, 
    addResident, 
    updateResident, 
    deleteResident, 
    getMembersOfApartment,
    selectedResidentForEdit,
    setSelectedResidentForEdit,
    findResidentByCccd,
    setActiveTab,
    setInspectTargetCccd,
    logAction,
    showToast
  } = useResidents();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [towerFilter, setTowerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [criminalFilter, setCriminalFilter] = useState<string>('ALL'); // 'ALL' | 'CRIMINAL' | 'CLEAN'
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuickAddTempOpen, setIsQuickAddTempOpen] = useState(false);
  const [viewDetailResident, setViewDetailResident] = useState<Resident | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Quick Temporary Resident Form State (cho phép thêm dữ liệu trực tiếp)
  const [quickTempData, setQuickTempData] = useState({
    apartmentCode: 'A.1201',
    fullName: '',
    cccd: '',
    phoneNumber: '',
    gender: 'Nam' as 'Nam' | 'Nữ' | 'Khác',
    birthDate: '',
    permanentAddress: '',
    expiryDate: calculateExtensionDate(2), // 2 năm mặc định
  });

  // Calculate residents expiring within 15 days or expired
  const expiringResidents = useMemo(() => {
    return residents
      .map((r) => ({
        resident: r,
        expiryInfo: evaluateExpiry(r.expiryDate, r.residenceStatus),
      }))
      .filter((item) => item.expiryInfo.status === 'expiring_soon' || item.expiryInfo.status === 'expired')
      .sort((a, b) => (a.expiryInfo.daysRemaining ?? 999) - (b.expiryInfo.daysRemaining ?? 999));
  }, [residents]);

  // Direct Renewal Handler (Gia hạn trực tiếp)
  const handleExtendExpiry = (id: string, yearsToAdd: number) => {
    const target = residents.find((r) => r.id === id);
    if (!target) return;
    const newDate = calculateExtensionDate(yearsToAdd);
    updateResident(id, { expiryDate: newDate, residenceStatus: 'Tạm trú' });
    
    // Ghi nhật ký hành động gia hạn
    logAction(
      'GIA HẠN TẠM TRÚ',
      `Gia hạn tạm trú thêm ${yearsToAdd} năm cho cư dân ${target.fullName} (Hạn mới: ${newDate})`,
      {
        apartmentCode: target.apartmentCode,
        fullName: target.fullName,
        cccd: target.cccd,
        residenceStatus: 'Tạm trú',
        resultStatus: 'Hợp lệ',
        matchedResidentId: target.id,
      }
    );

    showToast(`Đã gia hạn tạm trú trực tiếp cho ${target.fullName} đến ngày ${newDate} (+${yearsToAdd} năm)`, 'success');
  };

  // Direct Quick Add Temporary Resident Handler (Thêm dữ liệu trực tiếp)
  const handleSaveQuickTemp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTempData.apartmentCode || !quickTempData.fullName || !quickTempData.cccd) {
      showToast('Vui lòng điền đủ Mã căn hộ, Họ tên và Số CCCD!', 'error');
      return;
    }

    const created = addResident({
      apartmentCode: quickTempData.apartmentCode.toUpperCase(),
      fullName: quickTempData.fullName.toUpperCase(),
      birthDate: quickTempData.birthDate || '01/01/1995',
      gender: quickTempData.gender,
      cccd: quickTempData.cccd,
      cmndOld: '',
      phoneNumber: quickTempData.phoneNumber,
      relationship: 'Khách thuê',
      residenceStatus: 'Tạm trú',
      nationality: 'Việt Nam',
      permanentAddress: quickTempData.permanentAddress || 'Chưa cập nhật',
      temporaryAddress: `Căn ${quickTempData.apartmentCode.toUpperCase()} Chung cư Bình Phú, KP16`,
      currentAddress: `Căn ${quickTempData.apartmentCode.toUpperCase()} Chung cư Bình Phú, KP16`,
      headOfHousehold: quickTempData.fullName.toUpperCase(),
      maritalStatus: 'Độc thân',
      registrationDate: new Date().toLocaleDateString('vi-VN'),
      expiryDate: quickTempData.expiryDate,
      criminalRecord: 'Không tiền án/tiền sự',
      hasCriminalRecord: false,
    });

    // Ghi nhật ký hành động thêm mới
    logAction(
      'TỰ ĐỘNG THÊM NHÂN KHẨU',
      `Thêm trực tiếp nhân khẩu tạm trú: ${quickTempData.fullName.toUpperCase()} - Căn ${quickTempData.apartmentCode.toUpperCase()}`,
      {
        apartmentCode: quickTempData.apartmentCode.toUpperCase(),
        fullName: quickTempData.fullName.toUpperCase(),
        cccd: quickTempData.cccd,
        residenceStatus: 'Tạm trú',
        resultStatus: 'Hợp lệ',
        matchedResidentId: created.id,
      }
    );

    setIsQuickAddTempOpen(false);
    setQuickTempData({
      apartmentCode: 'A.1201',
      fullName: '',
      cccd: '',
      phoneNumber: '',
      gender: 'Nam',
      birthDate: '',
      permanentAddress: '',
      expiryDate: calculateExtensionDate(2),
    });
    showToast('Đã thêm cư dân tạm trú trực tiếp thành công!', 'success');
  };

  // Filtered residents list
  const filteredResidents = useMemo(() => {
    return residents.filter((r) => {
      // Search
      const search = searchTerm.toLowerCase();
      const matchSearch =
        !search ||
        r.fullName.toLowerCase().includes(search) ||
        r.cccd.toLowerCase().includes(search) ||
        r.apartmentCode.toLowerCase().includes(search) ||
        r.phoneNumber.toLowerCase().includes(search) ||
        (r.permanentAddress && r.permanentAddress.toLowerCase().includes(search));

      // Tower
      const tower = getTowerFromApartmentCode(r.apartmentCode);
      const matchTower = towerFilter === 'ALL' || tower.towerId === towerFilter;

      // Status & 15-day expiry filter
      let matchStatus = true;
      if (statusFilter === 'EXPIRING_15_DAYS') {
        const exp = evaluateExpiry(r.expiryDate, r.residenceStatus);
        matchStatus = exp.status === 'expiring_soon' || exp.status === 'expired';
      } else if (statusFilter !== 'ALL') {
        matchStatus = r.residenceStatus === statusFilter;
      }

      // Criminal record
      const matchCriminal =
        criminalFilter === 'ALL' ||
        (criminalFilter === 'CRIMINAL' && r.hasCriminalRecord) ||
        (criminalFilter === 'CLEAN' && !r.hasCriminalRecord);

      return matchSearch && matchTower && matchStatus && matchCriminal;
    });
  }, [residents, searchTerm, towerFilter, statusFilter, criminalFilter]);

  // Form state for full 14-field modal
  const [formData, setFormData] = useState<Partial<Resident>>({
    apartmentCode: '',
    fullName: '',
    birthDate: '',
    gender: 'Nam',
    cccd: '',
    cmndOld: '',
    phoneNumber: '',
    relationship: 'Chủ hộ',
    residenceStatus: 'Thường trú',
    nationality: 'Việt Nam',
    permanentAddress: '',
    temporaryAddress: '',
    currentAddress: '',
    headOfHousehold: '',
    fatherName: '',
    motherName: '',
    maritalStatus: 'Độc thân',
    spouseName: '',
    registrationDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    criminalRecord: '',
    hasCriminalRecord: false,
    avatarUrl: '',
  });

  const openAddForm = () => {
    setSelectedResidentForEdit(null);
    setFormData({
      apartmentCode: '',
      fullName: '',
      birthDate: '',
      gender: 'Nam',
      cccd: '',
      cmndOld: '',
      phoneNumber: '',
      relationship: 'Chủ hộ',
      residenceStatus: 'Thường trú',
      nationality: 'Việt Nam',
      permanentAddress: '',
      temporaryAddress: '',
      currentAddress: '',
      headOfHousehold: '',
      fatherName: '',
      motherName: '',
      maritalStatus: 'Độc thân',
      spouseName: '',
      registrationDate: new Date().toISOString().slice(0, 10),
      expiryDate: '',
      criminalRecord: '',
      hasCriminalRecord: false,
      avatarUrl: '',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (resident: Resident) => {
    setSelectedResidentForEdit(resident);
    setFormData({ ...resident });
    setIsFormOpen(true);
  };

  const handleSaveResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.apartmentCode || !formData.fullName || !formData.cccd) {
      showToast('Vui lòng điền đủ: Mã căn hộ, Họ tên và Số CCCD!', 'error');
      return;
    }

    if (selectedResidentForEdit) {
      updateResident(selectedResidentForEdit.id, formData);
      logAction(
        'CẬP NHẬT HỒ SƠ',
        `Cập nhật hồ sơ cư trú: ${formData.fullName} - Căn ${formData.apartmentCode}`,
        {
          apartmentCode: formData.apartmentCode,
          fullName: formData.fullName,
          cccd: formData.cccd,
          residenceStatus: formData.residenceStatus,
          resultStatus: 'Hợp lệ',
          matchedResidentId: selectedResidentForEdit.id,
        }
      );
    } else {
      const added = addResident(formData as any);
      logAction(
        'TỰ ĐỘNG THÊM NHÂN KHẨU',
        `Thêm mới nhân khẩu: ${formData.fullName} - Căn ${formData.apartmentCode}`,
        {
          apartmentCode: formData.apartmentCode,
          fullName: formData.fullName,
          cccd: formData.cccd,
          residenceStatus: formData.residenceStatus,
          resultStatus: 'Hợp lệ',
          matchedResidentId: added.id,
        }
      );
    }
    setIsFormOpen(false);
  };

  const handleQrScanned = (parsed: any) => {
    // Check if resident exists
    const existing = findResidentByCccd(parsed.cccd);
    if (existing) {
      openEditForm(existing);
      showToast(`Đã tìm thấy cư dân: ${existing.fullName} (${existing.apartmentCode}). Mở form cập nhật.`, 'success');
    } else {
      // Auto fill new form
      setSelectedResidentForEdit(null);
      setFormData((prev) => ({
        ...prev,
        cccd: parsed.cccd,
        cmndOld: parsed.cmndOld,
        fullName: parsed.fullName,
        birthDate: parsed.birthDate,
        gender: parsed.gender,
        permanentAddress: parsed.permanentAddress,
        currentAddress: parsed.permanentAddress,
      }));
      setIsFormOpen(true);
    }
  };

  // Avatar photo upload
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData((prev) => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar & Summary Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Danh Sách Quản Lý Cư Trú</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 tabular-nums">
              {filteredResidents.length} / {residents.length} nhân khẩu
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Khu phố 16, Phường Bình Phú, TP.HCM (Tháp A, B, C, D & Ngoài chung cư)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shadow-sm"
          >
            <QrCode className="w-4 h-4 text-amber-800" />
            <span>Quét QR CCCD tra cứu</span>
          </button>

          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Cư Dân Mới</span>
          </button>
        </div>
      </div>

      {/* CẢNH BÁO HẾT HẠN TẠM TRÚ TRONG 15 NGÀY TỚI & THÊM DỮ LIỆU TRỰC TIẾP */}
      <div className="bg-white rounded-xl border-2 border-amber-400 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/20 text-white">
              <AlertTriangle className="w-5 h-5 text-amber-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Cảnh Báo: Hết Hạn Tạm Trú Trong 15 Ngày Tới ({expiringResidents.length} người)
                </h3>
                <span className="text-[10px] bg-red-900/80 px-2 py-0.5 rounded font-bold uppercase">
                  Nghiệp vụ cư trú
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                Danh sách nhân khẩu tạm trú sắp hết hạn hoặc đã quá hạn cần rà soát và đôn đốc gia hạn kịp thời
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsQuickAddTempOpen(true)}
              className="px-3.5 py-1.5 bg-white hover:bg-amber-50 text-amber-900 rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-amber-700" />
              <span>+ Thêm Tạm Trú Trực Tiếp</span>
            </button>
          </div>
        </div>

        {/* List of expiring temporary residents with direct actions */}
        <div className="p-4 space-y-3 bg-amber-50/40">
          {expiringResidents.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">
              Hiện tại không có cư dân tạm trú nào hết hạn trong 15 ngày tới.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {expiringResidents.map(({ resident: r, expiryInfo }) => (
                <div
                  key={r.id}
                  className={`p-3.5 rounded-xl border bg-white shadow-xs flex flex-col justify-between gap-2.5 ${
                    expiryInfo.status === 'expired'
                      ? 'border-red-300 ring-1 ring-red-300'
                      : 'border-amber-300 ring-1 ring-amber-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 text-xs uppercase truncate">
                        {r.fullName}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                        expiryInfo.status === 'expired'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {expiryInfo.badgeText}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                      <p>
                        Căn hộ: <strong className="font-mono text-slate-900">{r.apartmentCode}</strong> ({getTowerFromApartmentCode(r.apartmentCode).towerName})
                      </p>
                      <p className="font-mono text-[11px]">
                        CCCD: {r.cccd} {r.phoneNumber && `· SĐT: ${r.phoneNumber}`}
                      </p>
                    </div>
                  </div>

                  {/* Direct Actions: Gia hạn trực tiếp */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-500 font-medium">Gia hạn trực tiếp:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleExtendExpiry(r.id, 1)}
                        title="Gia hạn thêm 1 năm kể từ hôm nay"
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded transition-colors"
                      >
                        +1 năm
                      </button>
                      <button
                        onClick={() => handleExtendExpiry(r.id, 2)}
                        title="Gia hạn thêm 2 năm kể từ hôm nay"
                        className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold rounded transition-colors"
                      >
                        +2 năm
                      </button>
                      <button
                        onClick={() => {
                          setInspectTargetCccd(r.cccd);
                          setActiveTab('check');
                        }}
                        title="Kiểm tra đối chiếu thực tế"
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-colors"
                      >
                        Kiểm tra
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm họ tên, CCCD, mã căn hộ, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-medium text-slate-900"
          />
        </div>

        {/* Tower filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={towerFilter}
            onChange={(e) => setTowerFilter(e.target.value)}
            className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-medium text-slate-900"
          >
            <option value="ALL">Tất cả khu vực / Tháp</option>
            <option value="A">Chung cư - Tháp A</option>
            <option value="B">Chung cư - Tháp B</option>
            <option value="C">Chung cư - Tháp C</option>
            <option value="D">Chung cư - Tháp D</option>
            <option value="NCC">Ngoài chung cư (Nhà phố)</option>
          </select>
        </div>

        {/* Status filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-medium text-slate-900"
          >
            <option value="ALL">Tất cả tình trạng cư trú</option>
            <option value="EXPIRING_15_DAYS">⚠️ Hết hạn tạm trú trong 15 ngày tới ({expiringResidents.length})</option>
            <option value="Thường trú">Thường trú</option>
            <option value="Tạm trú">Tạm trú</option>
            <option value="Chưa đăng ký">Chưa đăng ký</option>
            <option value="Đã chuyển đi">Đã chuyển đi</option>
          </select>
        </div>

        {/* Criminal Record filter */}
        <div>
          <select
            value={criminalFilter}
            onChange={(e) => setCriminalFilter(e.target.value)}
            className="w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-medium text-slate-900"
          >
            <option value="ALL">Tiền án / Tiền sự (Tất cả)</option>
            <option value="CRIMINAL">⚠️ Chỉ người CÓ tiền án/tiền sự</option>
            <option value="CLEAN">Không tiền án/tiền sự</option>
          </select>
        </div>
      </div>

      {/* Residents Grid / Cards */}
      {filteredResidents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Không tìm thấy nhân khẩu phù hợp</h3>
          <p className="text-xs text-slate-500 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bỏ các bộ lọc bên trên.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setTowerFilter('ALL');
              setStatusFilter('ALL');
              setCriminalFilter('ALL');
            }}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Xóa toàn bộ bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResidents.map((r) => {
            const tower = getTowerFromApartmentCode(r.apartmentCode);
            const coResidents = getMembersOfApartment(r.apartmentCode).filter(m => m.id !== r.id);
            const expiryInfo = evaluateExpiry(r.expiryDate, r.residenceStatus);

            return (
              <div
                key={r.id}
                className={`bg-white rounded-xl border transition-all duration-150 shadow-sm hover:shadow-md flex flex-col overflow-hidden ${
                  r.hasCriminalRecord
                    ? 'border-red-500 ring-2 ring-red-500/20'
                    : expiryInfo.status === 'expired'
                    ? 'border-rose-400 ring-1 ring-rose-300'
                    : expiryInfo.status === 'expiring_soon'
                    ? 'border-amber-400 ring-1 ring-amber-300'
                    : 'border-slate-200'
                }`}
              >
                {/* 14. THÔNG TIN TIỀN ÁN TIỀN SỰ: NỔI ĐỎ LÊN ĐẦU KHI CÓ THÔNG TIN */}
                {r.hasCriminalRecord ? (
                  <div className="bg-red-600 text-white px-3.5 py-2 flex items-center justify-between text-xs font-bold tracking-wide">
                    <div className="flex items-center gap-1.5 truncate">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-300 animate-pulse" />
                      <span className="truncate">CẢNH BÁO TIỀN ÁN / TIỀN SỰ</span>
                    </div>
                    <span className="text-[10px] bg-red-900/80 px-2 py-0.5 rounded uppercase">Cần chú ý</span>
                  </div>
                ) : (
                  <div className="bg-slate-50 border-b border-slate-100 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Không tiền án/tiền sự
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">{tower.towerName}</span>
                  </div>
                )}

                {/* Criminal record detail bar if present */}
                {r.hasCriminalRecord && (
                  <div className="bg-red-50 border-b border-red-200 px-3.5 py-2 text-xs text-red-900 leading-snug">
                    <p className="font-semibold text-red-700 text-[11px] uppercase">Chi tiết hồ sơ nghiệp vụ:</p>
                    <p className="mt-0.5 line-clamp-2">{r.criminalRecord}</p>
                  </div>
                )}

                {/* Card Main Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar / Real Person Photo */}
                    <div className="relative shrink-0">
                      {r.avatarUrl ? (
                        <img
                          src={r.avatarUrl}
                          alt={r.fullName}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                          <User className="w-7 h-7" />
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 text-[9px] font-bold px-1 py-0.2 rounded bg-slate-800 text-white">
                        {r.gender}
                      </span>
                    </div>

                    {/* Resident Core Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-sm font-bold text-slate-900 truncate uppercase">
                          {r.fullName}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                            r.residenceStatus === 'Thường trú'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : r.residenceStatus === 'Tạm trú'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.residenceStatus}
                        </span>
                      </div>

                      <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                        <p className="font-mono text-[11px] text-slate-700">
                          CCCD: <strong className="text-slate-900">{r.cccd}</strong>
                        </p>
                        <p className="text-slate-500">
                          Sinh ngày: <span className="tabular-nums font-medium text-slate-700">{r.birthDate}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 15-Day Expiry Tag Inside Card */}
                  {expiryInfo.status === 'expiring_soon' && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-semibold">
                      <span className="flex items-center gap-1 truncate text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Hết hạn trong {expiryInfo.daysRemaining} ngày</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleExtendExpiry(r.id, 1)}
                          title="Gia hạn thêm 1 năm"
                          className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded font-bold text-[10px]"
                        >
                          +1 năm
                        </button>
                      </div>
                    </div>
                  )}

                  {expiryInfo.status === 'expired' && (
                    <div className="bg-rose-50 border border-rose-300 text-rose-900 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-bold">
                      <span className="flex items-center gap-1 truncate text-rose-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">ĐÃ QUÁ HẠN TẠM TRÚ</span>
                      </span>
                      <button
                        onClick={() => handleExtendExpiry(r.id, 1)}
                        title="Gia hạn ngay 1 năm"
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10px] shrink-0"
                      >
                        Gia hạn
                      </button>
                    </div>
                  )}

                  {/* Metadata key grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-slate-600 truncate">
                      <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Căn: <strong className="text-slate-900 font-mono">{r.apartmentCode}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-600 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Quan hệ: <strong>{r.relationship}</strong></span>
                    </div>

                    {r.phoneNumber && (
                      <div className="flex items-center gap-1.5 text-slate-600 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-mono">{r.phoneNumber}</span>
                      </div>
                    )}

                    {r.expiryDate && (
                      <div className="flex items-center gap-1.5 text-slate-600 truncate">
                        <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate text-amber-700 font-medium">Hết hạn: {r.expiryDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Family co-members note */}
                  {coResidents.length > 0 && (
                    <div className="text-[11px] bg-slate-50 p-2 rounded-md text-slate-600 border border-slate-100">
                      <span className="font-medium text-slate-700">Cùng hộ ({coResidents.length} người): </span>
                      {coResidents.map(m => m.fullName).join(', ')}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setViewDetailResident(r)}
                    className="text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem chi tiết</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setInspectTargetCccd(r.cccd);
                        setActiveTab('check');
                      }}
                      title="Kiểm tra đối chiếu CCCD"
                      className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded"
                    >
                      Kiểm tra
                    </button>
                    <button
                      onClick={() => openEditForm(r)}
                      title="Sửa thông tin"
                      className="p-1 text-slate-500 hover:text-slate-900 rounded"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteResident(r.id)}
                      title="Xóa nhân khẩu"
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW DETAIL MODAL (FULL 14 FIELDS) */}
      {viewDetailResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className={`p-4 text-white flex items-center justify-between ${
              viewDetailResident.hasCriminalRecord ? 'bg-red-700' : 'bg-slate-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center font-bold">
                  {viewDetailResident.gender === 'Nữ' ? 'F' : 'M'}
                </div>
                <div>
                  <h3 className="text-base font-bold uppercase">{viewDetailResident.fullName}</h3>
                  <p className="text-xs text-slate-200 font-mono">
                    CCCD: {viewDetailResident.cccd} · Căn hộ: {viewDetailResident.apartmentCode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewDetailResident(null)}
                className="text-white/80 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Highlight Criminal Record Red if Present */}
              {viewDetailResident.hasCriminalRecord ? (
                <div className="p-3.5 bg-red-50 border border-red-300 rounded-lg text-red-900">
                  <div className="flex items-center gap-2 font-bold text-red-700 uppercase mb-1">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Thông tin Tiền án / Tiền sự (Cảnh báo nghiệp vụ)</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed">{viewDetailResident.criminalRecord}</p>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium">Tình trạng tiền án / tiền sự: Không có tiền án, tiền sự</span>
                </div>
              )}

              {/* Photos row */}
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="shrink-0 text-center">
                  {viewDetailResident.avatarUrl ? (
                    <img
                      src={viewDetailResident.avatarUrl}
                      alt={viewDetailResident.fullName}
                      referrerPolicy="no-referrer"
                      className="w-20 h-24 object-cover rounded border border-slate-300 shadow-sm mx-auto"
                    />
                  ) : (
                    <div className="w-20 h-24 bg-slate-200 rounded border border-slate-300 flex items-center justify-center text-slate-400 mx-auto">
                      <User className="w-8 h-8" />
                    </div>
                  )}
                  <span className="text-[10px] text-slate-500 font-medium block mt-1">Ảnh người thực tế</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1">
                  <div>
                    <span className="text-slate-500 block">Số CCCD (12 số):</span>
                    <strong className="text-slate-900 font-mono text-sm">{viewDetailResident.cccd}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Số CMND cũ (9 số):</span>
                    <strong className="text-slate-900 font-mono">{viewDetailResident.cmndOld || 'Không có'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ngày sinh:</span>
                    <strong className="text-slate-900">{viewDetailResident.birthDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Giới tính:</span>
                    <strong className="text-slate-900">{viewDetailResident.gender}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Số điện thoại:</span>
                    <strong className="text-slate-900 font-mono">{viewDetailResident.phoneNumber || 'Chưa cập nhật'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Quốc tịch:</span>
                    <strong className="text-slate-900">{viewDetailResident.nationality || 'Việt Nam'}</strong>
                  </div>
                </div>
              </div>

              {/* Chi tiết nhân khẩu */}
              <div className="space-y-2 border border-slate-200 p-3.5 rounded-lg">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] text-slate-500 border-b pb-1">
                  Chi Tiết Nhân Khẩu & Hộ Khẩu
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <span className="text-slate-500 block">Mã căn hộ:</span>
                    <strong className="text-slate-900 font-mono">{viewDetailResident.apartmentCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Mối quan hệ với chủ hộ:</span>
                    <strong className="text-slate-900">{viewDetailResident.relationship}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Họ tên chủ hộ:</span>
                    <strong className="text-slate-900">{viewDetailResident.headOfHousehold}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Tình trạng hôn nhân:</span>
                    <strong className="text-slate-900">{viewDetailResident.maritalStatus}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Họ tên Vợ / Chồng:</span>
                    <strong className="text-slate-900">{viewDetailResident.spouseName || 'Chưa có'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Họ tên Cha:</span>
                    <strong className="text-slate-900">{viewDetailResident.fatherName || 'Chưa cập nhật'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Họ tên Mẹ:</span>
                    <strong className="text-slate-900">{viewDetailResident.motherName || 'Chưa cập nhật'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Tình trạng cư trú:</span>
                    <strong className="text-slate-900">{viewDetailResident.residenceStatus}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div>
                    <span className="text-slate-500 block">Nơi thường trú:</span>
                    <p className="text-slate-800 font-medium">{viewDetailResident.permanentAddress || 'Chưa ghi nhận'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nơi tạm trú:</span>
                    <p className="text-slate-800 font-medium">{viewDetailResident.temporaryAddress || 'Chưa ghi nhận'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nơi ở hiện tại:</span>
                    <p className="text-slate-800 font-medium">{viewDetailResident.currentAddress || 'Chưa ghi nhận'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Ngày đăng ký cư trú:</span>
                    <strong className="text-slate-900">{viewDetailResident.registrationDate || 'Chưa rõ'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ngày hết hạn tạm trú:</span>
                    <strong className="text-amber-700">{viewDetailResident.expiryDate || 'Vô thời hạn'}</strong>
                  </div>
                </div>
              </div>

              {/* Thành viên cùng hộ */}
              <div className="border border-slate-200 p-3.5 rounded-lg">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] text-slate-500 border-b pb-1 mb-2">
                  Các Thành Viên Cùng Căn Hộ ({viewDetailResident.apartmentCode})
                </h4>
                {getMembersOfApartment(viewDetailResident.apartmentCode).length === 0 ? (
                  <p className="text-slate-500">Chưa ghi nhận nhân khẩu nào khác.</p>
                ) : (
                  <div className="space-y-1.5">
                    {getMembersOfApartment(viewDetailResident.apartmentCode).map((mem) => (
                      <div
                        key={mem.id}
                        className={`p-2 rounded flex items-center justify-between ${
                          mem.id === viewDetailResident.id ? 'bg-slate-100 font-bold' : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{mem.fullName}</span>
                          <span className="text-slate-400">({mem.relationship})</span>
                          {mem.hasCriminalRecord && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-semibold">
                              Có tiền án/tiền sự
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-slate-500">{mem.cccd}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => {
                  setViewDetailResident(null);
                  openEditForm(viewDetailResident);
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
              >
                Chỉnh sửa thông tin
              </button>
              <button
                onClick={() => setViewDetailResident(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT RESIDENT MODAL (14 FIELDS) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  {selectedResidentForEdit ? 'Cập Nhật Thông Tin Cư Dân' : 'Thêm Nhân Khẩu Cư Trú Mới'}
                </h3>
                <p className="text-xs text-slate-300">
                  Khu phố 16, Phường Bình Phú · 14 trường biểu mẫu quản lý chuẩn
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveResident} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              
              {/* 14. TIỀN ÁN TIỀN SỰ: NỔI ĐỎ LÊN ĐẦU */}
              <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-red-800 uppercase flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>Mục 14: Thông tin Tiền án / Tiền sự (Nổi đỏ cảnh báo)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-red-900">
                    <input
                      type="checkbox"
                      checked={formData.hasCriminalRecord || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData((prev) => ({
                          ...prev,
                          hasCriminalRecord: checked,
                          criminalRecord: checked ? (prev.criminalRecord || 'Có tiền án/tiền sự') : 'Không tiền án/tiền sự',
                        }));
                      }}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <span>Xác nhận CÓ tiền án/tiền sự</span>
                  </label>
                </div>
                {formData.hasCriminalRecord ? (
                  <textarea
                    rows={2}
                    value={formData.criminalRecord || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, criminalRecord: e.target.value }))}
                    placeholder="Ghi rõ: Tội danh, năm xử án, bản án, nơi chấp hành án, tình trạng đã xóa án tích hay chưa..."
                    className="w-full p-2.5 bg-white border border-red-300 rounded-lg text-red-950 focus:ring-2 focus:ring-red-600 focus:outline-none font-medium"
                  />
                ) : (
                  <p className="text-slate-500 text-xs italic">
                    Hiện tại: <span className="font-semibold text-emerald-700">Không có tiền án / tiền sự</span>
                  </p>
                )}
              </div>

              {/* Group: Căn hộ & Ảnh người thực tế */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    1. Mã Căn hộ <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: A.1204, B.0502, NCC.01"
                    value={formData.apartmentCode || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, apartmentCode: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold uppercase focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Khu vực: <strong>{getTowerFromApartmentCode(formData.apartmentCode || '').towerName}</strong>
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    2. Hình ảnh người thực tế
                  </label>
                  <div className="flex items-center gap-3">
                    {formData.avatarUrl ? (
                      <img
                        src={formData.avatarUrl}
                        alt="Avatar"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-300 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer font-medium text-slate-700 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải ảnh chân dung</span>
                        <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                      </label>
                      <input
                        type="text"
                        placeholder="Hoặc dán URL ảnh trực tiếp..."
                        value={formData.avatarUrl || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded-md text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Group: Nhân thân cơ bản */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    3. Họ và tên <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: NGUYỄN VĂN AN"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value.toUpperCase() }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    4. Ngày tháng năm sinh
                  </label>
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={formData.birthDate || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, birthDate: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    5. Giới tính
                  </label>
                  <select
                    value={formData.gender || 'Nam'}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value as any }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              {/* CCCD & Liên hệ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    6. Số CCCD (12 số) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    placeholder="VD: 079201004567"
                    value={formData.cccd || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cccd: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Số CMND cũ (9 số)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 025684992"
                    value={formData.cmndOld || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cmndOld: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    7. Số điện thoại
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0908123456"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Mối quan hệ & Tình trạng cư trú */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    8. Mối quan hệ với chủ hộ
                  </label>
                  <select
                    value={formData.relationship || 'Chủ hộ'}
                    onChange={(e) => setFormData((prev) => ({ ...prev, relationship: e.target.value as Relationship }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium"
                  >
                    <option value="Chủ hộ">Chủ hộ</option>
                    <option value="Vợ">Vợ</option>
                    <option value="Chồng">Chồng</option>
                    <option value="Con">Con</option>
                    <option value="Cha">Cha</option>
                    <option value="Mẹ">Mẹ</option>
                    <option value="Em">Em</option>
                    <option value="Anh/Chị">Anh / Chị</option>
                    <option value="Khách thuê">Khách thuê</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    9. Tình trạng cư trú
                  </label>
                  <select
                    value={formData.residenceStatus || 'Thường trú'}
                    onChange={(e) => setFormData((prev) => ({ ...prev, residenceStatus: e.target.value as ResidenceStatus }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-semibold"
                  >
                    <option value="Thường trú">Thường trú</option>
                    <option value="Tạm trú">Tạm trú</option>
                    <option value="Chưa đăng ký">Chưa đăng ký</option>
                    <option value="Đã chuyển đi">Đã chuyển đi</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Quốc tịch
                  </label>
                  <input
                    type="text"
                    value={formData.nationality || 'Việt Nam'}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* 10. CHI TIẾT NHÂN KHẨU */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] border-b pb-1">
                  10. Chi Tiết Nhân Khẩu
                </h4>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-slate-600 block mb-0.5">Nơi thường trú:</label>
                    <input
                      type="text"
                      placeholder="Địa chỉ ghi trên CCCD / Hộ khẩu..."
                      value={formData.permanentAddress || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, permanentAddress: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-0.5">Nơi tạm trú:</label>
                    <input
                      type="text"
                      placeholder="Địa chỉ đăng ký tạm trú (nếu có)..."
                      value={formData.temporaryAddress || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, temporaryAddress: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-0.5">Nơi ở hiện tại:</label>
                    <input
                      type="text"
                      placeholder="Căn hộ chung cư Bình Phú, KP16..."
                      value={formData.currentAddress || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, currentAddress: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="text-slate-600 block mb-0.5">Họ tên chủ hộ:</label>
                    <input
                      type="text"
                      value={formData.headOfHousehold || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, headOfHousehold: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-0.5">Tình trạng hôn nhân:</label>
                    <select
                      value={formData.maritalStatus || 'Độc thân'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, maritalStatus: e.target.value as MaritalStatus }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="Độc thân">Độc thân</option>
                      <option value="Đã kết hôn">Đã kết hôn</option>
                      <option value="Ly hôn">Ly hôn</option>
                      <option value="Góa">Góa</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-0.5">Họ tên Cha:</label>
                    <input
                      type="text"
                      value={formData.fatherName || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fatherName: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-0.5">Họ tên Mẹ:</label>
                    <input
                      type="text"
                      value={formData.motherName || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, motherName: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-slate-600 block mb-0.5">Họ tên Vợ / Chồng (nếu có):</label>
                    <input
                      type="text"
                      value={formData.spouseName || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, spouseName: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* 12, 13: Ngày đăng ký & Ngày hết hạn tạm trú */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    12. Ngày đăng ký cư trú
                  </label>
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={formData.registrationDate || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, registrationDate: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    13. Ngày hết hạn tạm trú (nếu tạm trú)
                  </label>
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={formData.expiryDate || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </form>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveResident}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold shadow-sm transition-all"
              >
                {selectedResidentForEdit ? 'Cập Nhật Nhân Khẩu' : 'Lưu Hồ Sơ Cư Dân'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD TEMPORARY RESIDENT MODAL (THÊM DỮ LIỆU TẠM TRÚ TRỰC TIẾP) */}
      {isQuickAddTempOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <div>
                  <h3 className="text-base font-bold">Thêm Cư Dân Tạm Trú Trực Tiếp</h3>
                  <p className="text-xs text-amber-100">Khu phố 16 · Thiết lập nhanh thời hạn tạm trú</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickAddTempOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickTemp} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mã căn hộ <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: B.0405, A.1201"
                    value={quickTempData.apartmentCode}
                    onChange={(e) => setQuickTempData({ ...quickTempData, apartmentCode: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold uppercase focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Khu vực: <strong>{getTowerFromApartmentCode(quickTempData.apartmentCode).towerName}</strong>
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Họ và tên <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="NGUYỄN VĂN A"
                    value={quickTempData.fullName}
                    onChange={(e) => setQuickTempData({ ...quickTempData, fullName: e.target.value.toUpperCase() })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold uppercase focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Số CCCD (12 số) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="079..."
                    value={quickTempData.cccd}
                    onChange={(e) => setQuickTempData({ ...quickTempData, cccd: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    placeholder="09..."
                    value={quickTempData.phoneNumber}
                    onChange={(e) => setQuickTempData({ ...quickTempData, phoneNumber: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Giới tính
                  </label>
                  <select
                    value={quickTempData.gender}
                    onChange={(e) => setQuickTempData({ ...quickTempData, gender: e.target.value as any })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Ngày tháng năm sinh
                  </label>
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={quickTempData.birthDate}
                    onChange={(e) => setQuickTempData({ ...quickTempData, birthDate: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nơi thường trú (Địa chỉ trên CCCD)
                </label>
                <input
                  type="text"
                  placeholder="Xã/Huyện/Tỉnh thường trú..."
                  value={quickTempData.permanentAddress}
                  onChange={(e) => setQuickTempData({ ...quickTempData, permanentAddress: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* Ngày hết hạn tạm trú & Quick select buttons */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <label className="font-bold text-amber-900 block">
                  Ngày hết hạn tạm trú:
                </label>
                <input
                  type="text"
                  required
                  placeholder="dd/mm/yyyy"
                  value={quickTempData.expiryDate}
                  onChange={(e) => setQuickTempData({ ...quickTempData, expiryDate: e.target.value })}
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg font-bold text-amber-900 focus:ring-2 focus:ring-amber-600"
                />

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-amber-800 font-medium">Chọn nhanh:</span>
                  <button
                    type="button"
                    onClick={() => setQuickTempData({ ...quickTempData, expiryDate: calculateExtensionDate(1) })}
                    className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded text-[11px] font-semibold"
                  >
                    +1 năm
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTempData({ ...quickTempData, expiryDate: calculateExtensionDate(2) })}
                    className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded text-[11px] font-semibold"
                  >
                    +2 năm
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddTempOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Lưu Tạm Trú Trực Tiếp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal for lookup */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScanSuccess={handleQrScanned}
        title="Quét QR CCCD để tra cứu & chỉnh sửa cư dân"
      />
    </div>
  );
};
