import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xl border border-amber-400/50 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
      <span>Chế độ ngoại tuyến: Dữ liệu được lưu an toàn trên máy</span>
    </div>
  );
};
