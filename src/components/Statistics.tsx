import React, { useMemo } from 'react';
import { 
  BarChart3, Users, UserCheck, ShieldAlert, Globe, 
  Home, Building2, AlertTriangle, ArrowUpRight, FileSpreadsheet 
} from 'lucide-react';
import { useResidents } from '../context/ResidentContext';
import { getTowerFromApartmentCode } from '../utils/cccdParser';
import { exportResidentsToExcel } from '../utils/excelHelper';
import { evaluateExpiry } from '../utils/dateHelper';

export const Statistics: React.FC = () => {
  const { residents, logs, setActiveTab } = useResidents();

  // 1. Tổng cư dân
  const totalResidents = residents.length;

  // 2. Số lượng: Thường trú, Tạm trú, Chưa đăng ký, Đã chuyển đi
  const statusStats = useMemo(() => {
    let thuongTru = 0;
    let tamTru = 0;
    let chuaDangKy = 0;
    let daChuyenDi = 0;

    residents.forEach((r) => {
      if (r.residenceStatus === 'Thường trú') thuongTru++;
      else if (r.residenceStatus === 'Tạm trú') tamTru++;
      else if (r.residenceStatus === 'Chưa đăng ký') chuaDangKy++;
      else if (r.residenceStatus === 'Đã chuyển đi') daChuyenDi++;
    });

    return { thuongTru, tamTru, chuaDangKy, daChuyenDi };
  }, [residents]);

  // 3. Quốc tịch
  const nationalityStats = useMemo(() => {
    const map = new Map<string, number>();
    residents.forEach((r) => {
      const nat = r.nationality || 'Việt Nam';
      map.set(nat, (map.get(nat) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [residents]);

  // 4. Khách thuê
  const tenantCount = useMemo(() => {
    return residents.filter((r) => r.relationship === 'Khách thuê').length;
  }, [residents]);

  // 5. Phân loại Chủ hộ & Mối quan hệ trong hộ (chủ hộ, con, cha, mẹ, em, vợ, chồng, khác)
  const relationshipStats = useMemo(() => {
    const counts: Record<string, number> = {
      'Chủ hộ': 0,
      'Vợ': 0,
      'Chồng': 0,
      'Con': 0,
      'Cha': 0,
      'Mẹ': 0,
      'Em': 0,
      'Khách thuê': 0,
      'Khác': 0,
    };

    residents.forEach((r) => {
      const rel = r.relationship;
      if (counts[rel] !== undefined) {
        counts[rel]++;
      } else {
        counts['Khác']++;
      }
    });

    return counts;
  }, [residents]);

  // Tower distribution
  const towerStats = useMemo(() => {
    const counts = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      NCC: 0,
    };

    residents.forEach((r) => {
      const { towerId } = getTowerFromApartmentCode(r.apartmentCode);
      if (counts[towerId] !== undefined) {
        counts[towerId]++;
      } else {
        counts.NCC++;
      }
    });

    return counts;
  }, [residents]);

  // Tiền án tiền sự (Nổi đỏ)
  const criminalResidents = useMemo(() => {
    return residents.filter((r) => r.hasCriminalRecord);
  }, [residents]);

  // Tạm trú hết hạn trong 15 ngày tới hoặc quá hạn
  const expiringStats = useMemo(() => {
    return residents
      .map((r) => ({
        resident: r,
        expiryInfo: evaluateExpiry(r.expiryDate, r.residenceStatus),
      }))
      .filter((item) => item.expiryInfo.status === 'expiring_soon' || item.expiryInfo.status === 'expired')
      .sort((a, b) => (a.expiryInfo.daysRemaining ?? 999) - (b.expiryInfo.daysRemaining ?? 999));
  }, [residents]);

  const handleExport = () => {
    exportResidentsToExcel(residents, logs);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-red-700" />
            <span>Báo Cáo Thống Kê Cư Dân & Nhân Khẩu Khu Phố 16</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu tổng hợp tình trạng cư trú, căn hộ các tháp, quan hệ chủ hộ và an ninh trật tự
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors shadow-sm self-start sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Xuất Báo Cáo Excel</span>
        </button>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span>Tổng Cư Dân</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {totalResidents}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Nhân khẩu quản lý</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-blue-700 text-xs mb-1 font-semibold">
            <span>Thường Trú</span>
            <span className="text-[10px] bg-blue-50 px-1.5 py-0.2 rounded font-mono">
              {totalResidents > 0 ? Math.round((statusStats.thuongTru / totalResidents) * 100) : 0}%
            </span>
          </div>
          <div className="text-2xl font-extrabold text-blue-700 tabular-nums">
            {statusStats.thuongTru}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Hộ khẩu thường trú</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 text-xs mb-1 font-semibold">
            <span>Tạm Trú</span>
            <span className="text-[10px] bg-amber-50 px-1.5 py-0.2 rounded font-mono">
              {totalResidents > 0 ? Math.round((statusStats.tamTru / totalResidents) * 100) : 0}%
            </span>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 tabular-nums">
            {statusStats.tamTru}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Đã đăng ký tạm trú</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 text-xs mb-1 font-semibold">
            <span>Chưa Đăng Ký</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700 tabular-nums">
            {statusStats.chuaDangKy}
          </div>
          <span className="text-[11px] text-rose-600 mt-0.5 block font-medium">Cần đôn đốc khai báo</span>
        </div>
      </div>

      {/* CẢNH BÁO TIỀN ÁN TIỀN SỰ (NỔI BẬT NỀN ĐỎ THEO YÊU CẦU) */}
      <div className="bg-white rounded-xl border-2 border-red-500 shadow-sm overflow-hidden">
        <div className="bg-red-700 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-300" />
            <h3 className="text-sm font-bold uppercase tracking-wide">
              Hồ Sơ An Ninh: Đối Tượng Có Tiền Án / Tiền Sự ({criminalResidents.length} người)
            </h3>
          </div>
          <span className="text-xs bg-red-900/80 px-2.5 py-1 rounded font-semibold uppercase">
            Danh sách quản lý đặc thù
          </span>
        </div>

        <div className="p-4 overflow-x-auto">
          {criminalResidents.length === 0 ? (
            <p className="text-xs text-slate-500 p-4 text-center">
              Hiện tại không có cư dân nào trong diện quản lý tiền án / tiền sự.
            </p>
          ) : (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-red-100 text-slate-600">
                  <th className="py-2 px-3">Họ và tên</th>
                  <th className="py-2 px-3">Số CCCD</th>
                  <th className="py-2 px-3">Căn hộ / Tháp</th>
                  <th className="py-2 px-3">Tình trạng cư trú</th>
                  <th className="py-2 px-3">Nội dung tiền án / tiền sự</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {criminalResidents.map((r) => (
                  <tr key={r.id} className="hover:bg-red-50/50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{r.fullName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{r.cccd}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-red-700">{r.apartmentCode}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        {r.residenceStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-red-900 font-medium">{r.criminalRecord}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CẢNH BÁO HẾT HẠN TẠM TRÚ TRONG 15 NGÀY TỚI */}
      <div className="bg-white rounded-xl border-2 border-amber-400 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-200" />
            <h3 className="text-sm font-bold uppercase tracking-wide">
              Theo Dõi Hạn Tạm Trú: Sắp Hết Hạn Trong 15 Ngày Tới ({expiringStats.length} nhân khẩu)
            </h3>
          </div>
          <button
            onClick={() => setActiveTab('residents')}
            className="text-xs bg-white text-amber-900 font-bold px-3 py-1 rounded shadow-sm hover:bg-amber-50 transition-colors"
          >
            Quản lý & Gia hạn
          </button>
        </div>

        <div className="p-4 overflow-x-auto">
          {expiringStats.length === 0 ? (
            <p className="text-xs text-slate-500 p-4 text-center">
              Hiện tại không có cư dân tạm trú nào sắp hết hạn trong 15 ngày tới.
            </p>
          ) : (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-amber-100 text-slate-600">
                  <th className="py-2 px-3">Họ và tên</th>
                  <th className="py-2 px-3">Số CCCD</th>
                  <th className="py-2 px-3">Căn hộ / Tháp</th>
                  <th className="py-2 px-3">Số điện thoại</th>
                  <th className="py-2 px-3">Ngày hết hạn</th>
                  <th className="py-2 px-3">Tình trạng cảnh báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {expiringStats.map(({ resident: r, expiryInfo }) => (
                  <tr key={r.id} className="hover:bg-amber-50/50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{r.fullName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{r.cccd}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{r.apartmentCode}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{r.phoneNumber || 'Chưa có'}</td>
                    <td className="py-2.5 px-3 font-bold text-amber-900">{expiryInfo.formattedDate}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        expiryInfo.status === 'expired'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {expiryInfo.badgeText}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Grid: Thống kê Chủ hộ/Gia đình vs Khách thuê & Quốc tịch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Phân loại Chủ hộ & Mối quan hệ */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Cơ Cấu Quan Hệ Nhân Khẩu Với Chủ Hộ
            </h3>
            <p className="text-xs text-slate-500">
              Chủ hộ, con, cha, mẹ, em, vợ, chồng, khách thuê
            </p>
          </div>

          <div className="space-y-2.5">
            {Object.entries(relationshipStats).map(([rel, count]) => {
              const pct = totalResidents > 0 ? Math.round((count / totalResidents) * 100) : 0;
              return (
                <div key={rel} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{rel}</span>
                    <span className="font-mono text-slate-600 font-bold tabular-nums">
                      {count} người ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        rel === 'Chủ hộ'
                          ? 'bg-slate-900'
                          : rel === 'Khách thuê'
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phân bổ theo Tháp & Khu vực */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Phân Bổ Cư Dân Theo Tháp & Khu Vực
            </h3>
            <p className="text-xs text-slate-500">
              Tháp A, B, C, D Chung cư Bình Phú và Ngoài chung cư
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block">Tháp A</span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                {towerStats.A} <span className="text-xs font-normal text-slate-500">người</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block">Tháp B</span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                {towerStats.B} <span className="text-xs font-normal text-slate-500">người</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block">Tháp C</span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                {towerStats.C} <span className="text-xs font-normal text-slate-500">người</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block">Tháp D</span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                {towerStats.D} <span className="text-xs font-normal text-slate-500">người</span>
              </span>
            </div>

            <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 block">Khu Ngoài Chung Cư (Nhà phố)</span>
                <span className="text-xs text-slate-500">Đường số 7, hẻm Bình Phú...</span>
              </div>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                {towerStats.NCC} <span className="text-xs font-normal text-slate-500">người</span>
              </span>
            </div>
          </div>

          {/* Quốc tịch */}
          <div className="pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase block mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>Thống Kê Quốc Tịch Cư Dân:</span>
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              {nationalityStats.map(([nat, count]) => (
                <span key={nat} className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md font-medium">
                  {nat}: <strong className="text-slate-900">{count} người</strong>
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
