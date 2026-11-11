import React, { useState, useMemo } from 'react';
import { 
  Clock, Search, Filter, ShieldCheck, AlertTriangle, 
  Trash2, Eye, Printer, FileSpreadsheet, User, Building2,
  QrCode, UserPlus, Edit3, Calendar, PlusCircle, CheckCircle2,
  Sparkles, Shield
} from 'lucide-react';
import { useResidents } from '../context/ResidentContext';
import { CheckLog, LogActionType } from '../types/resident';
import { exportResidentsToExcel } from '../utils/excelHelper';
import { getTowerFromApartmentCode } from '../utils/cccdParser';

export const InspectionLogs: React.FC = () => {
  const { logs, deleteCheckLog, residents, addCheckLog, showToast } = useResidents();

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<CheckLog | null>(null);
  const [isManualLogModalOpen, setIsManualLogModalOpen] = useState(false);

  // Manual Quick Log Form State
  const [manualForm, setManualForm] = useState({
    apartmentCode: 'A.1201',
    officerName: 'Đ/c Thiếu tá Lê Văn Thành (CSKV KP16)',
    actionType: 'KIỂM TRA CƯ TRÚ' as LogActionType,
    fullName: '',
    cccd: '',
    residenceStatus: 'Tạm trú' as 'Thường trú' | 'Tạm trú' | 'Chưa đăng ký',
    resultStatus: 'Hợp lệ' as 'Hợp lệ' | 'Vi phạm chưa đăng ký' | 'Quá hạn tạm trú' | 'Cần xác minh thêm',
    notes: 'Kiểm tra hành chính trật tự địa bàn theo kế hoạch.',
  });

  // Calculate Action Stats
  const stats = useMemo(() => {
    let qrCount = 0;
    let checkCount = 0;
    let autoAddCount = 0;
    let extendCount = 0;

    logs.forEach((l) => {
      if (l.actionType === 'QUÉT QR CCCD') qrCount++;
      else if (l.actionType === 'KIỂM TRA CƯ TRÚ') checkCount++;
      else if (l.actionType === 'TỰ ĐỘNG THÊM NHÂN KHẨU') autoAddCount++;
      else if (l.actionType === 'GIA HẠN TẠM TRÚ') extendCount++;
    });

    return { total: logs.length, qrCount, checkCount, autoAddCount, extendCount };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        (log.fullName && log.fullName.toLowerCase().includes(q)) ||
        (log.cccd && log.cccd.toLowerCase().includes(q)) ||
        (log.apartmentCode && log.apartmentCode.toLowerCase().includes(q)) ||
        (log.officerName && log.officerName.toLowerCase().includes(q)) ||
        (log.actionDescription && log.actionDescription.toLowerCase().includes(q)) ||
        (log.notes && log.notes.toLowerCase().includes(q));

      const matchAction = actionFilter === 'ALL' || log.actionType === actionFilter;
      const matchResult = resultFilter === 'ALL' || log.resultStatus === resultFilter;

      return matchSearch && matchAction && matchResult;
    });
  }, [logs, searchTerm, actionFilter, resultFilter]);

  const handleExport = () => {
    exportResidentsToExcel(residents, logs);
  };

  const handleCreateManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.apartmentCode || !manualForm.fullName) {
      showToast('Vui lòng nhập Mã căn hộ và Họ tên công dân!', 'error');
      return;
    }

    const nowFormatted = new Date().toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    addCheckLog({
      checkDateTime: nowFormatted,
      apartmentCode: manualForm.apartmentCode.toUpperCase(),
      officerName: manualForm.officerName,
      actionType: manualForm.actionType,
      actionDescription: `Ghi nhận trực tiếp: ${manualForm.actionType} - Căn ${manualForm.apartmentCode.toUpperCase()}`,
      cccd: manualForm.cccd,
      cmndOld: '',
      fullName: manualForm.fullName.toUpperCase(),
      gender: 'Nam',
      birthDate: 'Chưa rõ',
      permanentAddress: 'Khu phố 16, Phường Bình Phú',
      residenceStatus: manualForm.residenceStatus,
      resultStatus: manualForm.resultStatus,
      notes: manualForm.notes,
    });

    setIsManualLogModalOpen(false);
    setManualForm({
      apartmentCode: 'A.1201',
      officerName: 'Đ/c Thiếu tá Lê Văn Thành (CSKV KP16)',
      actionType: 'KIỂM TRA CƯ TRÚ',
      fullName: '',
      cccd: '',
      residenceStatus: 'Tạm trú',
      resultStatus: 'Hợp lệ',
      notes: 'Kiểm tra hành chính trật tự địa bàn theo kế hoạch.',
    });
    showToast('Đã thêm ghi nhận kiểm tra vào nhật ký thành công!', 'success');
  };

  // Helper badge for action types
  const renderActionBadge = (actionType?: LogActionType) => {
    const act = actionType || 'KIỂM TRA CƯ TRÚ';
    switch (act) {
      case 'QUÉT QR CCCD':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <QrCode className="w-3.5 h-3.5 text-amber-700" />
            <span>Quét QR CCCD</span>
          </span>
        );
      case 'KIỂM TRA CƯ TRÚ':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
            <span>Kiểm tra cư trú</span>
          </span>
        );
      case 'TỰ ĐỘNG THÊM NHÂN KHẨU':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
            <span>Tự động thêm nhân khẩu</span>
          </span>
        );
      case 'CẬP NHẬT HỒ SƠ':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <Edit3 className="w-3.5 h-3.5 text-purple-700" />
            <span>Cập nhật hồ sơ</span>
          </span>
        );
      case 'GIA HẠN TẠM TRÚ':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300">
            <Calendar className="w-3.5 h-3.5 text-orange-700" />
            <span>Gia hạn tạm trú</span>
          </span>
        );
      case 'XÁC MINH CƯ TRÚ':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-300">
            <Search className="w-3.5 h-3.5 text-cyan-700" />
            <span>Xác minh cư trú</span>
          </span>
        );
      case 'NHẬP DỮ LIỆU EXCEL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300">
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
            <span>Nhập Excel</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span>{act}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-700" />
            <span>Nhật Ký Tác Nghiệp & Kiểm Tra Cư Trú Hành Chính</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Lịch sử toàn bộ các hành động: Quét QR CCCD, Kiểm tra cư trú, Tự động thêm nhân khẩu, Gia hạn tạm trú tại Khu phố 16
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsManualLogModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>Ghi Nhật Ký Trực Tiếp</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Tổng nhật ký</span>
          <span className="text-xl font-extrabold text-slate-900 font-mono mt-0.5 block">{stats.total}</span>
          <span className="text-[10px] text-slate-400">Toàn bộ lượt tác nghiệp</span>
        </div>

        <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-amber-600" />
            Quét QR CCCD
          </span>
          <span className="text-xl font-extrabold text-amber-950 font-mono mt-0.5 block">{stats.qrCount}</span>
          <span className="text-[10px] text-amber-700">Camera & đối chiếu</span>
        </div>

        <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Kiểm tra cư trú
          </span>
          <span className="text-xl font-extrabold text-blue-950 font-mono mt-0.5 block">{stats.checkCount}</span>
          <span className="text-[10px] text-blue-700">Lập biên bản thực địa</span>
        </div>

        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
            Tự động thêm mới
          </span>
          <span className="text-xl font-extrabold text-emerald-950 font-mono mt-0.5 block">{stats.autoAddCount}</span>
          <span className="text-[10px] text-emerald-700">Từ quét QR chưa có</span>
        </div>

        <div className="bg-orange-50/70 p-3.5 rounded-xl border border-orange-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-orange-800 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-orange-600" />
            Gia hạn tạm trú
          </span>
          <span className="text-xl font-extrabold text-orange-950 font-mono mt-0.5 block">{stats.extendCount}</span>
          <span className="text-[10px] text-orange-700">Gia hạn 2 năm</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo họ tên, CCCD, căn hộ, cán bộ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full sm:w-auto py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
            >
              <option value="ALL">Tất cả hành động ({logs.length})</option>
              <option value="QUÉT QR CCCD">Quét QR CCCD ({stats.qrCount})</option>
              <option value="KIỂM TRA CƯ TRÚ">Kiểm tra cư trú ({stats.checkCount})</option>
              <option value="TỰ ĐỘNG THÊM NHÂN KHẨU">Tự động thêm nhân khẩu ({stats.autoAddCount})</option>
              <option value="GIA HẠN TẠM TRÚ">Gia hạn tạm trú ({stats.extendCount})</option>
              <option value="CẬP NHẬT HỒ SƠ">Cập nhật hồ sơ</option>
              <option value="XÁC MINH CƯ TRÚ">Xác minh cư trú</option>
              <option value="NHẬP DỮ LIỆU EXCEL">Nhập dữ liệu Excel</option>
            </select>
          </div>

          <div className="flex-1 sm:flex-initial">
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full sm:w-auto py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
            >
              <option value="ALL">Tất cả kết quả</option>
              <option value="Hợp lệ">Hợp lệ</option>
              <option value="Vi phạm chưa đăng ký">Vi phạm chưa đăng ký</option>
              <option value="Quá hạn tạm trú">Quá hạn tạm trú</option>
              <option value="Cần xác minh thêm">Cần xác minh thêm</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table with Prominent Hành Động Column */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Chưa có nhật ký hành động nào khớp với bộ lọc.</p>
            <p className="text-[11px] text-slate-400 mt-1">Khi bạn quét QR CCCD, kiểm tra cư trú hoặc thêm cư dân, hành động sẽ tự động cập nhật ngay tại đây.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Hành động</th>
                  <th className="py-3 px-4">Căn hộ / Tháp</th>
                  <th className="py-3 px-4">Họ tên & CCCD</th>
                  <th className="py-3 px-4">Tình trạng</th>
                  <th className="py-3 px-4">Kết quả kiểm tra</th>
                  <th className="py-3 px-4">Cán bộ thực hiện</th>
                  <th className="py-3 px-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredLogs.map((log) => {
                  const tower = getTowerFromApartmentCode(log.apartmentCode);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Ngày giờ */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                        {log.checkDateTime}
                      </td>

                      {/* HÀNH ĐỘNG (ACTION) - NỔI BẬT THEO YÊU CẦU */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderActionBadge(log.actionType)}
                        {log.actionDescription && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-[200px] mt-0.5" title={log.actionDescription}>
                            {log.actionDescription}
                          </span>
                        )}
                      </td>

                      {/* Căn hộ / Tháp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {log.apartmentCode}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {tower.towerName}
                        </span>
                      </td>

                      {/* Họ tên & CCCD */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 uppercase block">
                          {log.fullName}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {log.cccd || 'Chưa có CCCD'}
                        </span>
                      </td>

                      {/* Tình trạng */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          log.residenceStatus === 'Thường trú'
                            ? 'bg-blue-50 text-blue-700'
                            : log.residenceStatus === 'Tạm trú'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {log.residenceStatus}
                        </span>
                      </td>

                      {/* Kết quả */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          log.resultStatus === 'Hợp lệ'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.resultStatus === 'Vi phạm chưa đăng ký'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {log.resultStatus}
                        </span>
                      </td>

                      {/* Cán bộ */}
                      <td className="py-3 px-4 text-slate-600 truncate max-w-[150px]" title={log.officerName}>
                        {log.officerName}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedLog(log)}
                            title="Xem chi tiết hành động"
                            className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCheckLog(log.id)}
                            title="Xóa khỏi nhật ký"
                            className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL FOR CHECK LOG */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold uppercase">
                    Chi Tiết Nhật Ký: {selectedLog.fullName}
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  Thời gian: {selectedLog.checkDateTime} · Căn: {selectedLog.apartmentCode}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-white/80 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Hành động banner */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Hành động ghi nhận:</span>
                  <div className="mt-1">{renderActionBadge(selectedLog.actionType)}</div>
                  {selectedLog.actionDescription && (
                    <p className="text-xs text-slate-700 font-medium mt-1.5">
                      {selectedLog.actionDescription}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Kết quả đánh giá:</span>
                  <strong className={`text-xs block mt-1 ${
                    selectedLog.resultStatus === 'Hợp lệ' ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {selectedLog.resultStatus}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Cán bộ thực hiện:</span>
                  <strong className="text-slate-900">{selectedLog.officerName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Tình trạng cư trú:</span>
                  <strong className="text-slate-900">{selectedLog.residenceStatus}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Số CCCD:</span>
                  <strong className="text-slate-900 font-mono">{selectedLog.cccd || 'Chưa cập nhật'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Số CMND cũ:</span>
                  <strong className="text-slate-900 font-mono">{selectedLog.cmndOld || 'Không có'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Ngày sinh:</span>
                  <strong className="text-slate-900">{selectedLog.birthDate || 'Chưa rõ'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Nơi thường trú:</span>
                  <strong className="text-slate-900">{selectedLog.permanentAddress || 'Chưa có thông tin'}</strong>
                </div>
              </div>

              <div>
                <span className="text-slate-600 font-bold block mb-1">Nội dung ghi chú tác nghiệp:</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-medium text-slate-800 leading-relaxed">
                  {selectedLog.notes || 'Không có ghi chú thêm.'}
                </p>
              </div>

              {/* Photos attached if any */}
              {(selectedLog.cccdFrontUrl || selectedLog.cccdBackUrl || selectedLog.personPhotoUrl) && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-700 block">Hình ảnh lưu trữ tại thời điểm tác nghiệp:</span>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedLog.cccdFrontUrl && (
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-1">CCCD Mặt trước</span>
                        <img src={selectedLog.cccdFrontUrl} alt="CCCD mặt trước" className="w-full h-24 object-cover rounded border" />
                      </div>
                    )}
                    {selectedLog.cccdBackUrl && (
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-1">CCCD Mặt sau</span>
                        <img src={selectedLog.cccdBackUrl} alt="CCCD mặt sau" className="w-full h-24 object-cover rounded border" />
                      </div>
                    )}
                    {selectedLog.personPhotoUrl && (
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-1">Ảnh người thực tế</span>
                        <img src={selectedLog.personPhotoUrl} alt="Ảnh người" className="w-full h-24 object-cover rounded border" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>In Bản Ghi Này</span>
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GHI NHẬT KÝ KIỂM TRA TRỰC TIẾP */}
      {isManualLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">Ghi Nhận Kiểm Tra Vào Sổ Nhật Ký</h3>
              </div>
              <button
                onClick={() => setIsManualLogModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualLog} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Mã căn hộ (*)</label>
                  <input
                    type="text"
                    required
                    value={manualForm.apartmentCode}
                    onChange={(e) => setManualForm({ ...manualForm, apartmentCode: e.target.value })}
                    placeholder="VD: A.1201, B.0504..."
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 uppercase font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Hành động tác nghiệp</label>
                  <select
                    value={manualForm.actionType}
                    onChange={(e) => setManualForm({ ...manualForm, actionType: e.target.value as LogActionType })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-semibold"
                  >
                    <option value="KIỂM TRA CƯ TRÚ">Kiểm tra cư trú thực tế</option>
                    <option value="QUÉT QR CCCD">Quét QR CCCD</option>
                    <option value="TỰ ĐỘNG THÊM NHÂN KHẨU">Tự động thêm nhân khẩu</option>
                    <option value="GIA HẠN TẠM TRÚ">Gia hạn tạm trú</option>
                    <option value="XÁC MINH CƯ TRÚ">Xác minh cư trú</option>
                    <option value="CẬP NHẬT HỒ SƠ">Cập nhật hồ sơ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Họ tên công dân / Cư dân (*)</label>
                <input
                  type="text"
                  required
                  value={manualForm.fullName}
                  onChange={(e) => setManualForm({ ...manualForm, fullName: e.target.value })}
                  placeholder="Nhập họ và tên..."
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 uppercase font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Số CCCD (12 số)</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={manualForm.cccd}
                    onChange={(e) => setManualForm({ ...manualForm, cccd: e.target.value })}
                    placeholder="VD: 079201004567"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tình trạng cư trú</label>
                  <select
                    value={manualForm.residenceStatus}
                    onChange={(e) => setManualForm({ ...manualForm, residenceStatus: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="Tạm trú">Tạm trú</option>
                    <option value="Thường trú">Thường trú</option>
                    <option value="Chưa đăng ký">Chưa đăng ký</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Cán bộ kiểm tra</label>
                  <input
                    type="text"
                    value={manualForm.officerName}
                    onChange={(e) => setManualForm({ ...manualForm, officerName: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Đánh giá kết quả</label>
                  <select
                    value={manualForm.resultStatus}
                    onChange={(e) => setManualForm({ ...manualForm, resultStatus: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-semibold"
                  >
                    <option value="Hợp lệ">Hợp lệ</option>
                    <option value="Vi phạm chưa đăng ký">Vi phạm chưa đăng ký</option>
                    <option value="Quá hạn tạm trú">Quá hạn tạm trú</option>
                    <option value="Cần xác minh thêm">Cần xác minh thêm</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nội dung / Ghi chú kiểm tra</label>
                <textarea
                  rows={3}
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsManualLogModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold"
                >
                  Lưu Vào Nhật Ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
