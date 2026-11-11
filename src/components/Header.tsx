import React from 'react';
import { Shield, ScanLine, FileSpreadsheet } from 'lucide-react';
import { useResidents } from '../context/ResidentContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  onOpenSyncModal: () => void;
  onOpenQuickScan: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSyncModal, onOpenQuickScan }) => {
  const { 
    multiDeviceSyncStatus, 
    lastServerSyncTime, 
    syncWithServerNow 
  } = useResidents();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-lg bg-red-700 border border-red-500/40 flex items-center justify-center text-white shadow-md">
              <Shield className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wide text-sm sm:text-base text-white uppercase font-sans">
                  Khu Phố 16
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-900/60 text-red-200 border border-red-700/50 uppercase">
                  Bình Phú
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-tight">
                Hệ thống Quản lý Cư trú & Kiểm tra CCCD
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-Device Cloud Sync Status Indicator */}
            <button
              onClick={syncWithServerNow}
              title={`Đồng bộ đa thiết bị: ${
                multiDeviceSyncStatus === 'synced'
                  ? `Đã kết nối máy chủ (${lastServerSyncTime || 'vừa xong'})`
                  : multiDeviceSyncStatus === 'syncing'
                  ? 'Đang đồng bộ...'
                  : 'Ngoại tuyến'
              }. Bấm để đồng bộ ngay.`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                multiDeviceSyncStatus === 'synced'
                  ? 'bg-emerald-400 animate-pulse'
                  : multiDeviceSyncStatus === 'syncing'
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-rose-400'
              }`} />
              <span className="hidden sm:inline text-[11px]">
                {multiDeviceSyncStatus === 'synced'
                  ? 'Đa thiết bị'
                  : multiDeviceSyncStatus === 'syncing'
                  ? 'Đang đồng bộ'
                  : 'Ngoại tuyến'}
              </span>
            </button>

            <button
              onClick={onOpenSyncModal}
              title="Đồng bộ Google Sheet & Nhập/Xuất Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Excel & Sheet</span>
            </button>

            <PWAInstallButton variant="header" />

            <button
              onClick={onOpenQuickScan}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 active:scale-95"
            >
              <ScanLine className="w-4 h-4 text-slate-950" />
              <span className="hidden xs:inline sm:inline">Quét QR CCCD</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
