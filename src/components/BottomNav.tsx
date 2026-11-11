import React, { useState, useRef, useEffect } from 'react';
import { Users, Building2, ScanLine, BarChart3, Clock } from 'lucide-react';
import { useResidents } from '../context/ResidentContext';

interface NavItem {
  id: 'residents' | 'apartments' | 'check' | 'statistics' | 'logs';
  shortLabel: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  highlight?: boolean;
}

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, residents } = useResidents();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const navItems: NavItem[] = [
    {
      id: 'residents',
      shortLabel: 'Cư trú',
      label: 'Quản lý cư trú',
      description: `Quản lý hồ sơ nhân khẩu KP16 (${residents.length} người)`,
      icon: Users,
      count: residents.length,
    },
    {
      id: 'apartments',
      shortLabel: 'Căn hộ',
      label: 'Quản lý căn hộ',
      description: 'Phân loại Tháp A, B, C, D & Ngoài chung cư',
      icon: Building2,
    },
    {
      id: 'check',
      shortLabel: 'Kiểm tra',
      label: 'Kiểm tra cư trú',
      description: 'Quét mã QR CCCD & Tự động lưu kiểm tra',
      icon: ScanLine,
      highlight: true,
    },
    {
      id: 'statistics',
      shortLabel: 'Thống kê',
      label: 'Báo cáo thống kê',
      description: 'Số liệu thường trú, tạm trú & cảnh báo hết hạn',
      icon: BarChart3,
    },
    {
      id: 'logs',
      shortLabel: 'Nhật ký',
      label: 'Nhật ký kiểm tra',
      description: 'Lịch sử tra cứu CCCD và tuần tra cư trú',
      icon: Clock,
    },
  ];

  // Auto-dismiss tooltip after 2.8 seconds on touch
  const showTooltip = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveTooltip(id);
    timerRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 2800);
  };

  const hideTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveTooltip(null);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <nav
      aria-label="Điều hướng chính cuối trang"
      className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] print:hidden"
    >
      <div className="max-w-xl mx-auto px-2 py-1.5">
        <div className="grid grid-cols-5 gap-1 items-center justify-between">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isTooltipOpen = activeTooltip === item.id;

            return (
              <div key={item.id} className="relative flex flex-col items-center">
                {/* Chú thích / Tooltip hiển thị khi chạm hoặc hover */}
                <div
                  className={`absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-200 z-50 ${
                    isTooltipOpen
                      ? 'opacity-100 scale-100 translate-y-0'
                      : 'opacity-0 scale-95 translate-y-1 pointer-events-none'
                  }`}
                >
                  <div className="bg-slate-950 text-white border border-slate-700/80 rounded-lg shadow-2xl px-3 py-2 text-center min-w-[170px] max-w-[220px]">
                    <div className="font-bold text-xs text-amber-300 flex items-center justify-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-amber-400" />
                      <span>{item.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      {item.description}
                    </div>
                    {item.count !== undefined && (
                      <div className="mt-1 inline-block bg-red-900/60 text-red-200 border border-red-700/50 text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                        {item.count} nhân khẩu
                      </div>
                    )}
                    {/* Tooltip caret arrow */}
                    <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-700/80 transform rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
                  </div>
                </div>

                {/* Compact Button vừa vặn với trang */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    showTooltip(item.id);
                  }}
                  onTouchStart={() => showTooltip(item.id)}
                  onMouseEnter={() => showTooltip(item.id)}
                  onMouseLeave={hideTooltip}
                  onFocus={() => showTooltip(item.id)}
                  onBlur={hideTooltip}
                  aria-label={item.label}
                  className={`w-full py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all select-none relative group ${
                    isActive
                      ? item.highlight
                        ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/50 font-bold'
                        : 'bg-red-700 text-white shadow-md font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80 active:bg-slate-800'
                  }`}
                >
                  {/* Subtle active glow pill on top */}
                  {isActive && (
                    <span
                      className={`absolute -top-1 w-6 h-0.5 rounded-full ${
                        item.highlight ? 'bg-amber-400' : 'bg-red-500'
                      }`}
                    />
                  )}

                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                        isActive
                          ? item.highlight
                            ? 'text-slate-950'
                            : 'text-amber-300'
                          : item.highlight
                          ? 'text-amber-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />

                    {/* Subtle dot badge for count if available */}
                    {item.count !== undefined && !isActive && (
                      <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
                    )}
                  </div>

                  {/* Compact Short Label */}
                  <span
                    className={`text-[11px] mt-0.5 tracking-tight truncate max-w-full leading-tight ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {item.shortLabel}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
