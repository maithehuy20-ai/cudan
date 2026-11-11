import React, { useState, useMemo } from 'react';
import { 
  Building2, Home, Users, UserCheck, ShieldAlert, 
  Search, Plus, Eye, ScanLine, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { useResidents } from '../context/ResidentContext';
import { Resident, TowerId } from '../types/resident';
import { getTowerFromApartmentCode } from '../utils/cccdParser';

interface ApartmentGroup {
  apartmentCode: string;
  towerId: TowerId;
  towerName: string;
  residents: Resident[];
  head?: Resident;
  hasTenants: boolean;
  hasUnregistered: boolean;
  hasCriminalRecord: boolean;
}

export const ApartmentManagement: React.FC = () => {
  const { residents, setActiveTab, setInspectTargetCccd, setSelectedResidentForEdit } = useResidents();
  
  // Selected Tower Tab: A | B | C | D | NCC
  const [activeTower, setActiveTower] = useState<TowerId>('A');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'TENANT' | 'WARNING' | 'UNREGISTERED'>('ALL');
  const [selectedApartment, setSelectedApartment] = useState<ApartmentGroup | null>(null);

  // Group residents by apartmentCode
  const apartmentGroups = useMemo(() => {
    const map = new Map<string, Resident[]>();
    
    residents.forEach((r) => {
      const code = (r.apartmentCode || 'NCC.01').trim().toUpperCase();
      if (!map.has(code)) {
        map.set(code, []);
      }
      map.get(code)!.push(r);
    });

    const list: ApartmentGroup[] = [];
    map.forEach((resList, code) => {
      const { towerId, towerName } = getTowerFromApartmentCode(code);
      const head = resList.find((r) => r.relationship === 'Chủ hộ') || resList[0];
      const hasTenants = resList.some((r) => r.relationship === 'Khách thuê');
      const hasUnregistered = resList.some((r) => r.residenceStatus === 'Chưa đăng ký');
      const hasCriminalRecord = resList.some((r) => r.hasCriminalRecord);

      list.push({
        apartmentCode: code,
        towerId,
        towerName,
        residents: resList,
        head,
        hasTenants,
        hasUnregistered,
        hasCriminalRecord,
      });
    });

    // Sort by apartment code
    list.sort((a, b) => a.apartmentCode.localeCompare(b.apartmentCode));
    return list;
  }, [residents]);

  // Towers list
  const towers = [
    { id: 'A' as TowerId, name: 'Tháp A', prefix: 'Mã A...' },
    { id: 'B' as TowerId, name: 'Tháp B', prefix: 'Mã B...' },
    { id: 'C' as TowerId, name: 'Tháp C', prefix: 'Mã C...' },
    { id: 'D' as TowerId, name: 'Tháp D', prefix: 'Mã D...' },
    { id: 'NCC' as TowerId, name: 'Ngoài chung cư', prefix: 'Nhà phố / Khu dân cư' },
  ];

  // Current tower apartments
  const currentTowerApartments = useMemo(() => {
    return apartmentGroups.filter((g) => {
      if (g.towerId !== activeTower) return false;

      // search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchCode = g.apartmentCode.toLowerCase().includes(q);
        const matchHead = g.head?.fullName.toLowerCase().includes(q) || false;
        const matchAny = g.residents.some((r) => r.fullName.toLowerCase().includes(q) || r.cccd.includes(q));
        if (!matchCode && !matchHead && !matchAny) return false;
      }

      // filter
      if (filterType === 'TENANT' && !g.hasTenants) return false;
      if (filterType === 'WARNING' && !g.hasCriminalRecord) return false;
      if (filterType === 'UNREGISTERED' && !g.hasUnregistered) return false;

      return true;
    });
  }, [apartmentGroups, activeTower, searchTerm, filterType]);

  // Tower level statistics
  const towerStats = useMemo(() => {
    const list = apartmentGroups.filter((g) => g.towerId === activeTower);
    const totalApartments = list.length;
    let totalPeople = 0;
    let totalTenants = 0;
    let totalCriminal = 0;
    let totalUnregistered = 0;

    list.forEach((g) => {
      totalPeople += g.residents.length;
      g.residents.forEach((r) => {
        if (r.relationship === 'Khách thuê') totalTenants++;
        if (r.hasCriminalRecord) totalCriminal++;
        if (r.residenceStatus === 'Chưa đăng ký') totalUnregistered++;
      });
    });

    return { totalApartments, totalPeople, totalTenants, totalCriminal, totalUnregistered };
  }, [apartmentGroups, activeTower]);

  return (
    <div className="space-y-6">
      {/* Page Title & Tower Tabs */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-700" />
              <span>Quản Lý Căn Hộ Theo Tháp & Khu Vực</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân loại tự động dựa trên ký tự đầu của mã căn hộ (Tháp A, B, C, D và Ngoài chung cư)
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto tabular-nums">
            Tổng cộng: {apartmentGroups.length} căn hộ / nhà ở đã ghi nhận
          </span>
        </div>

        {/* 5 Tower Selector Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {towers.map((t) => {
            const count = apartmentGroups.filter((g) => g.towerId === t.id).length;
            const isSelected = activeTower === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTower(t.id);
                  setSelectedApartment(null);
                }}
                className={`flex-1 min-w-[130px] p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase">{t.name}</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    isSelected ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {count} căn
                  </span>
                </div>
                <p className={`text-[11px] mt-1 truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                  {t.prefix}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Stats Row for Current Tower */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">Số căn hộ đã lập hồ sơ</span>
          <span className="text-xl font-extrabold text-slate-900 tabular-nums">
            {towerStats.totalApartments}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">Tổng cư dân cư trú</span>
          <span className="text-xl font-extrabold text-blue-700 tabular-nums">
            {towerStats.totalPeople} <span className="text-xs font-normal text-slate-500">người</span>
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">Số khách thuê lưu trú</span>
          <span className="text-xl font-extrabold text-amber-700 tabular-nums">
            {towerStats.totalTenants} <span className="text-xs font-normal text-slate-500">người</span>
          </span>
        </div>

        <div className={`p-3.5 rounded-xl border shadow-sm ${
          towerStats.totalCriminal > 0 
            ? 'bg-red-50 border-red-300 text-red-900' 
            : 'bg-white border-slate-200'
        }`}>
          <span className="text-xs font-medium block flex items-center gap-1">
            {towerStats.totalCriminal > 0 && <ShieldAlert className="w-3.5 h-3.5 text-red-600" />}
            <span>Có tiền án / tiền sự</span>
          </span>
          <span className={`text-xl font-extrabold tabular-nums ${
            towerStats.totalCriminal > 0 ? 'text-red-700' : 'text-slate-900'
          }`}>
            {towerStats.totalCriminal} <span className="text-xs font-normal text-slate-500">người</span>
          </span>
        </div>
      </div>

      {/* Search & Sub-Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Tìm mã căn hộ hoặc tên cư dân trong ${towers.find(t=>t.id===activeTower)?.name}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors ${
              filterType === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả căn
          </button>
          <button
            onClick={() => setFilterType('TENANT')}
            className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors ${
              filterType === 'TENANT'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Có khách thuê
          </button>
          <button
            onClick={() => setFilterType('WARNING')}
            className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors ${
              filterType === 'WARNING'
                ? 'bg-red-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚠️ Có tiền án/tiền sự
          </button>
          <button
            onClick={() => setFilterType('UNREGISTERED')}
            className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors ${
              filterType === 'UNREGISTERED'
                ? 'bg-rose-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Chưa đăng ký
          </button>
        </div>
      </div>

      {/* Apartment Cards Grid */}
      {currentTowerApartments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Home className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">
            Không có căn hộ nào khớp tiêu chí trong {towers.find(t=>t.id===activeTower)?.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Bạn có thể thêm cư dân mới và đặt mã căn bắt đầu bằng "{activeTower}." để tự động hiển thị ở đây.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentTowerApartments.map((group) => (
            <div
              key={group.apartmentCode}
              className={`bg-white rounded-xl border transition-all duration-150 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                group.hasCriminalRecord
                  ? 'border-red-500 ring-2 ring-red-500/20'
                  : 'border-slate-200'
              }`}
            >
              {/* Top Banner if has criminal record */}
              {group.hasCriminalRecord && (
                <div className="bg-red-600 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                    Căn hộ có nhân khẩu tiền án/tiền sự
                  </span>
                  <span className="text-[10px] bg-red-900 px-1.5 py-0.2 rounded uppercase">Nghiệp vụ</span>
                </div>
              )}

              {/* Apartment Header */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-sm">
                      {group.apartmentCode}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        {group.towerName}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Chủ hộ: <strong>{group.head?.fullName || 'Chưa đăng ký chủ hộ'}</strong>
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 tabular-nums">
                    {group.residents.length} người
                  </span>
                </div>

                {/* Resident List Inside Apartment */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Danh sách nhân khẩu trong căn:
                  </span>
                  {group.residents.map((r) => (
                    <div
                      key={r.id}
                      className={`text-xs p-2 rounded-lg flex items-center justify-between ${
                        r.hasCriminalRecord
                          ? 'bg-red-50/80 border border-red-200 text-red-950 font-medium'
                          : 'bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold truncate">{r.fullName}</span>
                        <span className="text-[11px] text-slate-500 shrink-0">({r.relationship})</span>
                        {r.hasCriminalRecord && (
                          <span className="text-[9px] bg-red-600 text-white px-1 py-0.2 rounded font-bold">
                            Tiền án
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">{r.cccd.slice(-4)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Apartment Action Footer */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => setSelectedApartment(group)}
                  className="text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Chi tiết căn hộ</span>
                </button>

                <button
                  onClick={() => {
                    // Preselect first resident or apartment code for check
                    if (group.head) {
                      setInspectTargetCccd(group.head.cccd);
                    }
                    setActiveTab('check');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded transition-colors"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>Kiểm tra căn</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* APARTMENT DETAIL MODAL */}
      {selectedApartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Home className="w-4 h-4 text-amber-400" />
                  <span>Hồ Sơ Căn Hộ: {selectedApartment.apartmentCode} ({selectedApartment.towerName})</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Tổng số: {selectedApartment.residents.length} nhân khẩu đang cư trú
                </p>
              </div>
              <button
                onClick={() => setSelectedApartment(null)}
                className="text-white/80 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {selectedApartment.hasCriminalRecord && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">CẢNH BÁO AN NINH TRẬT TỰ:</strong>
                    <span>Có đối tượng trong danh sách theo dõi tiền án / tiền sự đang cư trú tại căn hộ này.</span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] border-b pb-1">
                  Danh Sách Toàn Bộ Nhân Khẩu Trong Căn:
                </h4>

                {selectedApartment.residents.map((r, index) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{index + 1}. {r.fullName}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200">
                          {r.relationship}
                        </span>
                        <span className="text-xs font-bold text-blue-700">
                          {r.residenceStatus}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-1 space-x-2 font-mono text-[11px]">
                        <span>CCCD: {r.cccd}</span>
                        <span>·</span>
                        <span>Sinh: {r.birthDate}</span>
                        <span>·</span>
                        <span>SĐT: {r.phoneNumber || 'Chưa có'}</span>
                      </div>
                      {r.hasCriminalRecord && (
                        <p className="mt-1 text-red-700 font-semibold text-xs">
                          ⚠️ {r.criminalRecord}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedApartment(null);
                          setInspectTargetCccd(r.cccd);
                          setActiveTab('check');
                        }}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded font-bold text-xs"
                      >
                        Kiểm tra CCCD
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedApartment(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
