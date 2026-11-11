import React, { useState } from 'react';
import { ResidentProvider, useResidents } from './context/ResidentContext';
import { Header } from './components/Header';
import { ResidentManagement } from './components/ResidentManagement';
import { ApartmentManagement } from './components/ApartmentManagement';
import { ResidenceCheck } from './components/ResidenceCheck';
import { Statistics } from './components/Statistics';
import { InspectionLogs } from './components/InspectionLogs';
import { ExcelSyncModal } from './components/ExcelSyncModal';
import { QrScannerModal } from './components/QrScannerModal';
import { BottomNav } from './components/BottomNav';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ParsedCccdQr } from './utils/cccdParser';
import { MapPin } from 'lucide-react';

function AppContent() {
  const { activeTab, setActiveTab, setInspectTargetCccd } = useResidents();
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isQuickScanOpen, setIsQuickScanOpen] = useState(false);
  const [isInstallBannerDismissed, setIsInstallBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('kp16_pwa_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissBanner = () => {
    setIsInstallBannerDismissed(true);
    try {
      sessionStorage.setItem('kp16_pwa_banner_dismissed', 'true');
    } catch {}
  };

  const handleQuickScanSuccess = (parsed: ParsedCccdQr) => {
    // Route to check tab and set target CCCD
    setInspectTargetCccd(parsed.cccd);
    setActiveTab('check');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />
      
      {/* Official State Banner / National Header */}
      <div className="bg-red-800 text-white py-1.5 px-4 text-center text-[11px] font-semibold tracking-wider uppercase border-b border-red-900 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 print:hidden">
        <span>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM · ĐỘC LẬP - TỰ DO - HẠNH PHÚC</span>
        <span className="hidden md:inline text-red-300">|</span>
        <span className="text-amber-200">ỦY BAN NHÂN DÂN PHƯỜNG BÌNH PHÚ · BAN ĐIỀU HÀNH KHU PHỐ 16</span>
      </div>

      {/* PWA Mobile & Tablet Install Prompt Banner (Auto-suppresses once installed) */}
      {!isInstallBannerDismissed && (
        <PWAInstallButton variant="banner" onDismissBanner={handleDismissBanner} />
      )}

      {/* Main Top Navigation Bar */}
      <Header
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenQuickScan={() => setIsQuickScanOpen(true)}
      />

      {/* Sub-header / Breadcrumb Context Bar */}
      <div className="bg-white border-b border-slate-200 py-3 px-4 sm:px-6 lg:px-8 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="w-4 h-4 text-red-600 shrink-0" />
            <span>Địa bàn: <strong>Chung cư Bình Phú (Tháp A, B, C, D) & Khu dân cư ngoài chung cư</strong></span>
          </div>

          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
            <span>Đường dây nóng CSKV: <strong>028.3875.xxxx</strong></span>
            <span>·</span>
            <span>Phiên bản nghiệp vụ <strong>2026.1</strong></span>
          </div>
        </div>
      </div>

      {/* Main Application Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-24">
        {activeTab === 'residents' && <ResidentManagement />}
        {activeTab === 'apartments' && <ApartmentManagement />}
        {activeTab === 'check' && <ResidenceCheck />}
        {activeTab === 'statistics' && <Statistics />}
        {activeTab === 'logs' && <InspectionLogs />}
      </main>

      {/* Modals */}
      <ExcelSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />

      <QrScannerModal
        isOpen={isQuickScanOpen}
        onClose={() => setIsQuickScanOpen(false)}
        onScanSuccess={handleQuickScanSuccess}
        title="Quét Nhanh Mã QR CCCD · Chuyển Đến Kiểm Tra"
      />

      {/* Administrative Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 px-4 text-xs mt-auto mb-16 sm:mb-16 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-700 text-white flex items-center justify-center font-bold text-[10px]">
              16
            </div>
            <div>
              <p className="font-bold text-white text-xs">HỆ THỐNG QUẢN LÝ CƯ TRÚ KHU PHỐ 16</p>
              <p className="text-[11px] text-slate-400">Phường Bình Phú, Quận 6, Thành phố Hồ Chí Minh</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center sm:text-right">
            Phục vụ công tác quản lý cư trú, an ninh trật tự & phòng chống tội phạm địa bàn.
          </p>
        </div>
      </footer>

      {/* Docked Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ResidentProvider>
      <AppContent />
    </ResidentProvider>
  );
}
