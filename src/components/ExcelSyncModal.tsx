import React, { useState } from 'react';
import { 
  FileSpreadsheet, Upload, Download, RefreshCw, CheckCircle2, 
  AlertCircle, Copy, Check, Cloud, ArrowUpDown, HelpCircle, X, Database,
  Smartphone, Wifi, Share2, Radio
} from 'lucide-react';
import { useResidents } from '../context/ResidentContext';
import { 
  exportResidentsToExcel, 
  downloadExcelTemplate, 
  parseResidentsFromExcel 
} from '../utils/excelHelper';
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '../utils/googleSheetsSync';

interface ExcelSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelSyncModal: React.FC<ExcelSyncModalProps> = ({ isOpen, onClose }) => {
  const { 
    residents, 
    logs, 
    batchUpdateResidents, 
    sheetConfig, 
    setSheetConfig, 
    syncUpToGoogleSheet, 
    syncDownFromGoogleSheet,
    resetToDefaultData,
    showToast,
    multiDeviceSyncStatus,
    lastServerSyncTime,
    deviceId,
    syncWithServerNow
  } = useResidents();

  const [activeSubTab, setActiveSubTab] = useState<'multidevice' | 'excel' | 'sheets' | 'guide' | 'backup'>('multidevice');
  const [copiedScript, setCopiedScript] = useState(false);
  const [webhookInput, setWebhookInput] = useState(sheetConfig.webhookUrl || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [excelPreviewCount, setExcelPreviewCount] = useState<number | null>(null);
  const [pendingResidents, setPendingResidents] = useState<any[] | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    showToast('Đã sao chép mã Google Apps Script vào bộ nhớ tạm!', 'success');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const parsed = await parseResidentsFromExcel(file);
      setPendingResidents(parsed);
      setExcelPreviewCount(parsed.length);
      showToast(`Đã đọc ${parsed.length} dòng dữ liệu từ file Excel!`, 'info');
    } catch (err: any) {
      showToast('Lỗi đọc file Excel: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyExcelData = () => {
    if (!pendingResidents || pendingResidents.length === 0) return;
    const { added, updated } = batchUpdateResidents(pendingResidents);
    setPendingResidents(null);
    setExcelPreviewCount(null);
  };

  const handleSaveSheetConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSheetConfig({
      ...sheetConfig,
      webhookUrl: webhookInput.trim(),
    });
    showToast('Đã lưu cấu hình Google Sheet!', 'success');
  };

  const handleSyncUp = async () => {
    setIsProcessing(true);
    await syncUpToGoogleSheet();
    setIsProcessing(false);
  };

  const handleSyncDown = async () => {
    setIsProcessing(true);
    await syncDownFromGoogleSheet();
    setIsProcessing(false);
  };

  // Export JSON backup
  const handleExportJson = () => {
    const backupData = {
      residents,
      logs,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SaoLuu_CuTru_KP16_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file sao lưu JSON an toàn!', 'success');
  };

  // Import JSON backup
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.residents && Array.isArray(data.residents)) {
          batchUpdateResidents(data.residents);
          showToast('Khôi phục dữ liệu từ file JSON thành công!', 'success');
        } else {
          showToast('File JSON không đúng cấu trúc sao lưu.', 'error');
        }
      } catch (err: any) {
        showToast('Lỗi giải mã file JSON: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Quản Lý Nhập/Xuất Excel & Đồng Bộ Google Sheet</h3>
              <p className="text-xs text-slate-300">Dữ liệu cư trú Khu phố 16 · Phường Bình Phú, TP.HCM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2 text-xs font-semibold overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveSubTab('multidevice')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'multidevice'
                ? 'border-red-600 text-red-800 bg-white rounded-t-lg font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-red-600" />
            <span>Đa Thiết Bị (Máy Chủ)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>

          <button
            onClick={() => setActiveSubTab('excel')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'excel'
                ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Xử Lý File Excel</span>
          </button>

          <button
            onClick={() => setActiveSubTab('sheets')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'sheets'
                ? 'border-blue-600 text-blue-800 bg-white rounded-t-lg font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4 text-blue-600" />
            <span>Đồng Bộ Google Sheet</span>
          </button>

          <button
            onClick={() => setActiveSubTab('guide')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'guide'
                ? 'border-amber-600 text-amber-800 bg-white rounded-t-lg font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span>Mã Google Apps Script</span>
          </button>

          <button
            onClick={() => setActiveSubTab('backup')}
            className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'backup'
                ? 'border-slate-800 text-slate-900 bg-white rounded-t-lg font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-slate-700" />
            <span>Sao Lưu Dự Phòng</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          
          {/* TAB 0: MULTI-DEVICE CLOUD SYNC */}
          {activeSubTab === 'multidevice' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-red-600 rounded-lg text-white">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Hệ Thống Đồng Bộ Dữ Liệu Đa Thiết Bị Khu Phố 16</h4>
                      <p className="text-xs text-slate-300">Kết nối máy chủ trung tâm · Tự động truyền dữ liệu thời gian thực</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    multiDeviceSyncStatus === 'synced'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : multiDeviceSyncStatus === 'syncing'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {multiDeviceSyncStatus === 'synced'
                      ? '● Đang kết nối máy chủ'
                      : multiDeviceSyncStatus === 'syncing'
                      ? '◐ Đang truyền dữ liệu...'
                      : '○ Ngoại tuyến'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Thiết bị hiện tại:</span>
                    <strong className="text-slate-200 font-mono">{deviceId}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Đồng bộ gần nhất:</span>
                    <strong className="text-slate-200">{lastServerSyncTime || 'Vừa xong'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Cư dân trên máy chủ:</span>
                    <strong className="text-emerald-400 font-mono font-bold text-sm">{residents.length} người</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Lượt kiểm tra:</span>
                    <strong className="text-blue-400 font-mono font-bold text-sm">{logs.length} lượt</strong>
                  </div>
                </div>
              </div>

              {/* Manual Sync Button */}
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={syncWithServerNow}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Đồng Bộ Ngay Với Các Thiết Bị Khác</span>
                </button>
                <span className="text-slate-500 text-xs">
                  Dữ liệu tự động truyền giữa máy tính và điện thoại sau mỗi 4.5 giây mà không cần thao tác thủ công.
                </span>
              </div>

              {/* Share link / Open on other phones */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <Smartphone className="w-4 h-4 text-blue-700" />
                  <span>Cách Sử Dụng Đồng Thời Nhiều Điện Thoại & Máy Tính:</span>
                </div>
                <p className="text-blue-800 text-xs leading-relaxed">
                  Để các cán bộ Công an, Bảo vệ dân phố hoặc Trưởng ban khu phố cùng kiểm tra các tháp khác nhau (Tháp A, Tháp B, Tháp C, Tháp D, Ngoài chung cư):
                  Hãy sao chép liên kết ứng dụng bên dưới và gửi/mở trên các điện thoại di động:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={window.location.href}
                    className="flex-1 p-2 bg-white border border-blue-300 rounded-lg text-slate-800 font-mono text-xs select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      showToast('Đã sao chép liên kết ứng dụng!', 'success');
                    }}
                    className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </button>
                </div>
                <div className="text-[11px] text-blue-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Khi một cán bộ quét CCCD hoặc cập nhật ở căn hộ nào, thông tin sẽ lập tức hiện lên màn hình của các cán bộ khác!</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: EXCEL */}
          {activeSubTab === 'excel' && (
            <div className="space-y-6">
              {/* Export and Template Download */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-700" />
                    <h4 className="font-bold text-emerald-950 text-sm">Xuất Dữ Liệu Ra Excel</h4>
                  </div>
                  <p className="text-emerald-800 text-xs">
                    Xuất toàn bộ {residents.length} cư dân và {logs.length} lượt nhật ký kiểm tra ra file .xlsx có định dạng chuẩn bảng biểu hành chính.
                  </p>
                  <button
                    onClick={() => exportResidentsToExcel(residents, logs)}
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải File Excel Toàn Bộ Dữ Liệu</span>
                  </button>
                </div>

                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                    <h4 className="font-bold text-blue-950 text-sm">Tải File Excel Mẫu Chuẩn</h4>
                  </div>
                  <p className="text-blue-800 text-xs">
                    Tải mẫu file Excel trống đã thiết lập sẵn các cột tiêu đề (Mã căn hộ, Họ tên, CCCD, Tiền án tiền sự, Tạm trú...) để dễ dàng điền dữ liệu.
                  </p>
                  <button
                    onClick={downloadExcelTemplate}
                    className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Về File Mẫu (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Import & Update Residents from Excel */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-700" />
                    <span>Cập Nhật & Nhập Dữ Liệu Bằng File Excel</span>
                  </h4>
                  <p className="text-slate-500 mt-1">
                    Cơ chế thông minh: Nếu <strong>Số CCCD</strong> đã có trong hệ thống, dữ liệu mới trong file Excel sẽ <strong>tự động ghi đè/cập nhật</strong>. Nếu là CCCD mới sẽ được <strong>thêm mới</strong> vào hệ thống.
                  </p>
                </div>

                <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-white transition-all text-center">
                  <Upload className="w-8 h-8 text-emerald-600 mb-2" />
                  <span className="font-bold text-slate-800 text-sm">Bấm để chọn file Excel (.xlsx / .xls)</span>
                  <span className="text-slate-400 text-xs mt-0.5">Hệ thống sẽ tự động quét và phân tích dữ liệu</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleExcelFileSelected}
                    className="hidden"
                  />
                </label>

                {/* Preview and apply button */}
                {excelPreviewCount !== null && (
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-emerald-900 text-sm">
                        Đã sẵn sàng nhập {excelPreviewCount} dòng cư dân!
                      </p>
                      <p className="text-emerald-700 text-xs">
                        Bấm nút xác nhận để thực hiện cập nhật và thêm mới vào cơ sở dữ liệu.
                      </p>
                    </div>
                    <button
                      onClick={handleApplyExcelData}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow transition-colors"
                    >
                      Xác Nhận Cập Nhật
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE SHEETS */}
          {activeSubTab === 'sheets' && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 leading-relaxed">
                <p className="font-bold text-sm">Đồng Bộ 2 Chiều Với Google Sheets (Google Apps Script):</p>
                <p className="mt-1">
                  Đã khắc phục hoàn toàn lỗi CORS và điều hướng Google. Bạn chỉ cần dán URL Web App triển khai từ Google Sheets để đồng bộ trực tiếp hai chiều!
                </p>
              </div>

              <form onSubmit={handleSaveSheetConfig} className="space-y-3">
                <label className="font-bold text-slate-800 block">
                  URL Ứng Dụng Web Google Apps Script (Web App URL):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg"
                  >
                    Lưu URL
                  </button>
                </div>
                {sheetConfig.lastSyncedAt && (
                  <p className="text-slate-500 text-[11px]">
                    Lần đồng bộ gần nhất: <strong>{sheetConfig.lastSyncedAt}</strong>
                  </p>
                )}
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleSyncUp}
                  className="p-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm">ĐẨY DỮ LIỆU LÊN GOOGLE SHEET</span>
                  <span className="text-[11px] font-normal text-emerald-100">
                    Ghi {residents.length} cư dân & {logs.length} nhật ký lên sheet
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleSyncDown}
                  className="p-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span className="text-sm">TẢI DỮ LIỆU TỪ GOOGLE SHEET VỀ</span>
                  <span className="text-[11px] font-normal text-blue-100">
                    Cập nhật danh sách mới nhất từ Google Sheet
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: APPS SCRIPT CODE & GUIDE */}
          {activeSubTab === 'guide' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Mã Nguồn Google Apps Script</h4>
                  <p className="text-slate-500">Dán vào Google Sheet để kết nối đồng bộ không lỗi</p>
                </div>

                <button
                  onClick={handleCopyScript}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors"
                >
                  {copiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScript ? 'Đã sao chép!' : 'Sao chép mã'}</span>
                </button>
              </div>

              {/* Instructions steps */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1.5">
                <p className="font-bold">Các bước thực hiện trong 1 phút:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Mở file Google Sheet của Khu phố 16.</li>
                  <li>Vào menu <strong>Tiện ích mở rộng (Extensions)</strong> &gt; Chọn <strong>Apps Script</strong>.</li>
                  <li>Xóa hết mã cũ và dán toàn bộ đoạn mã bên dưới vào. Bấm <strong>Lưu</strong> (biểu tượng đĩa mềm).</li>
                  <li>Bấm <strong>Triển khai (Deploy)</strong> &gt; <strong>Tùy chọn triển khai mới (New deployment)</strong>.</li>
                  <li>Chọn Loại: <strong>Ứng dụng web (Web app)</strong>.</li>
                  <li>Cấu hình: Thực thi dưới dạng <strong>"Tôi"</strong> và Ai có quyền truy cập: <strong>"Bất kỳ ai (Anyone)"</strong>.</li>
                  <li>Sao chép URL ứng dụng web nhận được và dán vào tab Đồng Bộ Google Sheet!</li>
                </ol>
              </div>

              {/* Code block */}
              <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-64 border border-slate-800">
                {GOOGLE_APPS_SCRIPT_TEMPLATE}
              </pre>
            </div>
          )}

          {/* TAB 4: BACKUP & RESTORE */}
          {activeSubTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">Sao Lưu & Khôi Phục JSON Dự Phòng</h4>
                <p className="text-slate-600">
                  Lưu trữ bản sao lưu đầy đủ toàn bộ cơ sở dữ liệu để phục hồi ngay lập tức trên máy tính hoặc điện thoại khác.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleExportJson}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất Bản Sao Lưu (.json)</span>
                  </button>

                  <label className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg font-bold flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Nhập Bản Sao Lưu (.json)</span>
                    <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <h4 className="font-bold text-rose-900 text-sm">Khôi Phục Dữ Liệu Ban Đầu Của Khu Phố 16</h4>
                <p className="text-rose-700 text-xs">
                  Thiết lập lại danh sách cư dân mẫu (15 nhân khẩu, Tháp A, B, C, D, Ngoài chung cư, đối tượng tiền án/tiền sự và sổ nhật ký).
                </p>
                {isConfirmingReset ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        resetToDefaultData();
                        setIsConfirmingReset(false);
                      }}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs"
                    >
                      Xác Nhận Khôi Phục Ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingReset(false)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingReset(true)}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs"
                  >
                    Khôi Phục Dữ Liệu Mẫu
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
