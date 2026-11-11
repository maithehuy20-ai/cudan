import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Resident, CheckLog, LogActionType, GoogleSheetConfig } from '../types/resident';
import { INITIAL_RESIDENTS, INITIAL_CHECK_LOGS } from '../data/initialData';
import { pushToGoogleSheet, pullFromGoogleSheet } from '../utils/googleSheetsSync';

export type MultiDeviceSyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

interface ResidentContextType {
  residents: Resident[];
  logs: CheckLog[];
  activeTab: 'residents' | 'apartments' | 'check' | 'statistics' | 'logs';
  setActiveTab: (tab: 'residents' | 'apartments' | 'check' | 'statistics' | 'logs') => void;
  selectedResidentForEdit: Resident | null;
  setSelectedResidentForEdit: (r: Resident | null) => void;
  inspectTargetCccd: string | null;
  setInspectTargetCccd: (cccd: string | null) => void;
  
  // Resident CRUD
  addResident: (data: Omit<Resident, 'id' | 'createdAt' | 'updatedAt'>) => Resident;
  updateResident: (id: string, data: Partial<Resident>) => void;
  deleteResident: (id: string) => void;
  batchUpdateResidents: (incoming: Resident[]) => { added: number; updated: number };
  
  // Inspection logs
  addCheckLog: (log: Omit<CheckLog, 'id'>) => CheckLog;
  deleteCheckLog: (id: string) => void;
  logAction: (
    actionType: LogActionType,
    description: string,
    extra?: Partial<Omit<CheckLog, 'id' | 'actionType' | 'actionDescription'>>
  ) => CheckLog;
  
  // Lookups
  findResidentByCccd: (cccd: string) => Resident | undefined;
  getMembersOfApartment: (apartmentCode: string) => Resident[];
  
  // Multi-Device Cloud Sync
  multiDeviceSyncStatus: MultiDeviceSyncStatus;
  lastServerSyncTime: string | null;
  deviceId: string;
  syncWithServerNow: () => Promise<boolean>;

  // Google sheet sync
  sheetConfig: GoogleSheetConfig;
  setSheetConfig: (config: GoogleSheetConfig) => void;
  syncUpToGoogleSheet: () => Promise<{ success: boolean; message: string }>;
  syncDownFromGoogleSheet: () => Promise<{ success: boolean; message: string }>;

  // Notification Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  
  resetToDefaultData: () => void;
}

const ResidentContext = createContext<ResidentContextType | undefined>(undefined);

const STORAGE_RESIDENTS_KEY = 'kp16_residents_data_v1';
const STORAGE_LOGS_KEY = 'kp16_check_logs_v1';
const STORAGE_SHEET_KEY = 'kp16_sheet_config_v1';
const STORAGE_DEVICE_KEY = 'kp16_device_id_v1';

export const ResidentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<'residents' | 'apartments' | 'check' | 'statistics' | 'logs'>('residents');
  const [selectedResidentForEdit, setSelectedResidentForEdit] = useState<Resident | null>(null);
  const [inspectTargetCccd, setInspectTargetCccd] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Multi-device sync states
  const [multiDeviceSyncStatus, setMultiDeviceSyncStatus] = useState<MultiDeviceSyncStatus>('syncing');
  const [lastServerSyncTime, setLastServerSyncTime] = useState<string | null>(null);
  const isSyncingRef = useRef(false);
  const lastSyncTimestampRef = useRef<string | null>(null);

  // Persistent Device ID
  const [deviceId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DEVICE_KEY);
      if (saved) return saved;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const generated = (isMobile ? 'Mobile_' : 'Desktop_') + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem(STORAGE_DEVICE_KEY, generated);
      return generated;
    } catch {
      return 'ThietBi_' + Math.random().toString(36).substring(2, 6);
    }
  });

  // Initialize residents from LocalStorage or default
  const [residents, setResidents] = useState<Resident[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_RESIDENTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load residents from localStorage', e);
    }
    return INITIAL_RESIDENTS;
  });

  // Initialize logs from LocalStorage or default
  const [logs, setLogs] = useState<CheckLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LOGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load check logs from localStorage', e);
    }
    return INITIAL_CHECK_LOGS;
  });

  // Google Sheet Config
  const [sheetConfig, setSheetConfigState] = useState<GoogleSheetConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SHEET_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      webhookUrl: '',
      sheetName: 'DanhSachCuDan',
      autoSync: false,
    };
  });

  // Save changes to LocalStorage immediately (local resilience)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_RESIDENTS_KEY, JSON.stringify(residents));
    } catch (e) {
      console.error('Failed to save residents to localStorage', e);
    }
  }, [residents]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save logs to localStorage', e);
    }
  }, [logs]);

  const setSheetConfig = (config: GoogleSheetConfig) => {
    setSheetConfigState(config);
    try {
      localStorage.setItem(STORAGE_SHEET_KEY, JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // --- MULTI-DEVICE SYNC ENGINE ---
  // Push full state to server
  const pushToServer = async (latestResidents: Resident[], latestLogs: CheckLog[]) => {
    try {
      setMultiDeviceSyncStatus('syncing');
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residents: latestResidents,
          logs: latestLogs,
          sheetConfig,
          deviceId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMultiDeviceSyncStatus('synced');
        lastSyncTimestampRef.current = data.lastUpdated;
        setLastServerSyncTime(new Date().toLocaleTimeString('vi-VN'));
      } else {
        setMultiDeviceSyncStatus('error');
      }
    } catch (err) {
      console.warn('Cannot push to server (offline or server starting):', err);
      setMultiDeviceSyncStatus('offline');
    }
  };

  // Pull state from server
  const pullFromServer = useCallback(async (isInitial = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const res = await fetch('/api/sync/pull');
      if (res.ok) {
        const data = await res.json();
        
        // If server database is not yet seeded, push our local state to initialize it!
        if (!data.seeded || !data.residents || data.residents.length === 0) {
          await pushToServer(residents, logs);
        } else {
          // If server has data, check if newer than our last sync
          if (data.lastUpdated !== lastSyncTimestampRef.current) {
            setResidents(data.residents);
            if (data.logs && Array.isArray(data.logs)) {
              setLogs(data.logs);
            }
            if (data.sheetConfig) {
              setSheetConfigState(data.sheetConfig);
            }
            lastSyncTimestampRef.current = data.lastUpdated;
            setLastServerSyncTime(new Date().toLocaleTimeString('vi-VN'));

            if (!isInitial) {
              showToast('Dữ liệu đã tự động cập nhật từ thiết bị khác trong khu phố!', 'info');
            }
          }
        }
        setMultiDeviceSyncStatus('synced');
      } else {
        setMultiDeviceSyncStatus('offline');
      }
    } catch (err) {
      setMultiDeviceSyncStatus('offline');
    } finally {
      isSyncingRef.current = false;
    }
  }, [residents, logs, sheetConfig, deviceId, showToast]);

  // Initial pull and periodic multi-device heartbeat sync
  useEffect(() => {
    pullFromServer(true);

    // Heartbeat polling every 4.5 seconds to synchronize between multiple devices
    const interval = setInterval(() => {
      // Only poll if document is visible to save bandwidth
      if (!document.hidden) {
        pullFromServer(false);
      }
    }, 4500);

    const handleOnline = () => {
      setMultiDeviceSyncStatus('syncing');
      pullFromServer(false);
    };
    const handleOffline = () => setMultiDeviceSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pullFromServer]);

  // Manual Trigger for Multi-Device Sync
  const syncWithServerNow = async (): Promise<boolean> => {
    showToast('Đang đồng bộ dữ liệu giữa các thiết bị...', 'info');
    setMultiDeviceSyncStatus('syncing');
    try {
      await pullFromServer(false);
      await pushToServer(residents, logs);
      showToast('Đã đồng bộ thành công với toàn bộ các thiết bị!', 'success');
      return true;
    } catch (e) {
      showToast('Đồng bộ thất bại. Kiểm tra kết nối mạng.', 'error');
      return false;
    }
  };

  // --- CRUD ACTIONS WITH REAL-TIME MULTI-DEVICE PROPAGATION ---

  const addResident = (data: Omit<Resident, 'id' | 'createdAt' | 'updatedAt'>): Resident => {
    const now = new Date().toISOString();
    const newResident: Resident = {
      ...data,
      id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      hasCriminalRecord: !!data.criminalRecord && 
        !data.criminalRecord.toLowerCase().includes('không') && 
        !data.criminalRecord.toLowerCase().includes('khong'),
      createdAt: now,
      updatedAt: now,
    };

    const nextList = [newResident, ...residents];
    setResidents(nextList);
    showToast(`Đã thêm cư dân: ${newResident.fullName} (${newResident.apartmentCode})`, 'success');
    
    // Broadcast to server immediately for multi-device sync
    pushToServer(nextList, logs);
    return newResident;
  };

  const updateResident = (id: string, data: Partial<Resident>) => {
    let targetName = '';
    const nextList = residents.map((r) => {
      if (r.id !== id) return r;
      targetName = r.fullName;
      const updatedCriminal = data.criminalRecord !== undefined ? data.criminalRecord : r.criminalRecord;
      const hasCriminalRecord = !!updatedCriminal && 
        !updatedCriminal.toLowerCase().includes('không') && 
        !updatedCriminal.toLowerCase().includes('khong');

      return {
        ...r,
        ...data,
        hasCriminalRecord,
        updatedAt: new Date().toISOString(),
      };
    });

    setResidents(nextList);
    showToast(`Đã cập nhật: ${targetName}`, 'success');
    pushToServer(nextList, logs);
  };

  const deleteResident = (id: string) => {
    const target = residents.find((r) => r.id === id);
    const nextList = residents.filter((r) => r.id !== id);
    setResidents(nextList);
    showToast(`Đã xóa cư dân: ${target?.fullName || id}`, 'info');
    pushToServer(nextList, logs);
  };

  const batchUpdateResidents = (incoming: Resident[]) => {
    let added = 0;
    let updated = 0;

    const mapByCccd = new Map<string, Resident>();
    residents.forEach((r) => {
      if (r.cccd) mapByCccd.set(r.cccd.trim(), r);
    });

    const nextList = [...residents];

    for (const item of incoming) {
      const cccdKey = (item.cccd || '').trim();
      if (cccdKey && mapByCccd.has(cccdKey)) {
        // Update existing
        const existing = mapByCccd.get(cccdKey)!;
        const idx = nextList.findIndex((r) => r.id === existing.id);
        if (idx !== -1) {
          nextList[idx] = {
            ...existing,
            ...item,
            id: existing.id,
            updatedAt: new Date().toISOString(),
          };
          updated++;
        }
      } else {
        // Add new
        nextList.push({
          ...item,
          id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        added++;
      }
    }

    setResidents(nextList);
    showToast(`Nhập dữ liệu thành công: Đã cập nhật ${updated}, Thêm mới ${added} cư dân`, 'success');
    pushToServer(nextList, logs);
    return { added, updated };
  };

  const addCheckLog = (logData: Omit<CheckLog, 'id'>): CheckLog => {
    const newLog: CheckLog = {
      ...logData,
      actionType: logData.actionType || 'KIỂM TRA CƯ TRÚ',
      actionDescription: logData.actionDescription || `Kiểm tra hành chính cư trú tại căn hộ ${logData.apartmentCode}`,
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    };
    const nextLogs = [newLog, ...logs];
    setLogs(nextLogs);
    showToast(`Đã lưu nhật ký [${newLog.actionType}]: ${newLog.fullName} (${newLog.apartmentCode})`, 'success');
    pushToServer(residents, nextLogs);
    return newLog;
  };

  const logAction = (
    actionType: LogActionType,
    description: string,
    extra?: Partial<Omit<CheckLog, 'id' | 'actionType' | 'actionDescription'>>
  ): CheckLog => {
    const now = new Date().toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const newLog: CheckLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      checkDateTime: extra?.checkDateTime || now,
      apartmentCode: extra?.apartmentCode || 'A.1201',
      officerName: extra?.officerName || 'Cán bộ quản lý KP16',
      actionType,
      actionDescription: description,
      cccd: extra?.cccd || '',
      cmndOld: extra?.cmndOld || '',
      fullName: extra?.fullName || 'CHƯA RÕ',
      gender: extra?.gender || 'Nam',
      birthDate: extra?.birthDate || '',
      permanentAddress: extra?.permanentAddress || '',
      residenceStatus: extra?.residenceStatus || 'Tạm trú',
      resultStatus: extra?.resultStatus || 'Hợp lệ',
      notes: extra?.notes || description,
      matchedResidentId: extra?.matchedResidentId,
      cccdFrontUrl: extra?.cccdFrontUrl,
      cccdBackUrl: extra?.cccdBackUrl,
      personPhotoUrl: extra?.personPhotoUrl,
    };

    const nextLogs = [newLog, ...logs];
    setLogs(nextLogs);
    pushToServer(residents, nextLogs);
    return newLog;
  };

  const deleteCheckLog = (id: string) => {
    const nextLogs = logs.filter((l) => l.id !== id);
    setLogs(nextLogs);
    showToast('Đã xóa lượt kiểm tra khỏi nhật ký', 'info');
    pushToServer(residents, nextLogs);
  };

  const findResidentByCccd = (cccd: string): Resident | undefined => {
    if (!cccd) return undefined;
    const clean = cccd.trim();
    return residents.find(
      (r) => (r.cccd && r.cccd.trim() === clean) || (r.cmndOld && r.cmndOld.trim() === clean)
    );
  };

  const getMembersOfApartment = (apartmentCode: string): Resident[] => {
    if (!apartmentCode) return [];
    const clean = apartmentCode.trim().toLowerCase();
    return residents.filter((r) => (r.apartmentCode || '').trim().toLowerCase() === clean);
  };

  const syncUpToGoogleSheet = async () => {
    if (!sheetConfig.webhookUrl) {
      showToast('Chưa cấu hình URL Webhook Google Sheet!', 'error');
      return { success: false, message: 'Chưa cấu hình URL Webhook' };
    }
    showToast('Đang đồng bộ dữ liệu lên Google Sheet...', 'info');
    const result = await pushToGoogleSheet(sheetConfig.webhookUrl, residents, logs);
    if (result.success) {
      setSheetConfig({
        ...sheetConfig,
        lastSyncedAt: new Date().toLocaleString('vi-VN'),
      });
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
    return result;
  };

  const syncDownFromGoogleSheet = async () => {
    if (!sheetConfig.webhookUrl) {
      showToast('Chưa cấu hình URL Google Sheet!', 'error');
      return { success: false, message: 'Chưa cấu hình URL' };
    }
    showToast('Đang tải dữ liệu từ Google Sheet...', 'info');
    const result = await pullFromGoogleSheet(sheetConfig.webhookUrl);
    if (result.success && result.data) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
    return result;
  };

  const resetToDefaultData = () => {
    setResidents(INITIAL_RESIDENTS);
    setLogs(INITIAL_CHECK_LOGS);
    localStorage.removeItem(STORAGE_RESIDENTS_KEY);
    localStorage.removeItem(STORAGE_LOGS_KEY);
    pushToServer(INITIAL_RESIDENTS, INITIAL_CHECK_LOGS);
    showToast('Đã khôi phục dữ liệu mẫu ban đầu của Khu Phố 16', 'info');
  };

  return (
    <ResidentContext.Provider
      value={{
        residents,
        logs,
        activeTab,
        setActiveTab,
        selectedResidentForEdit,
        setSelectedResidentForEdit,
        inspectTargetCccd,
        setInspectTargetCccd,
        addResident,
        updateResident,
        deleteResident,
        batchUpdateResidents,
        addCheckLog,
        deleteCheckLog,
        logAction,
        findResidentByCccd,
        getMembersOfApartment,
        multiDeviceSyncStatus,
        lastServerSyncTime,
        deviceId,
        syncWithServerNow,
        sheetConfig,
        setSheetConfig,
        syncUpToGoogleSheet,
        syncDownFromGoogleSheet,
        toast,
        showToast,
        resetToDefaultData,
      }}
    >
      {children}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-400'
                : toast.type === 'error'
                ? 'bg-rose-500'
                : 'bg-amber-400'
            }`}
          />
          <p className="text-sm font-medium leading-relaxed">{toast.message}</p>
        </div>
      )}
    </ResidentContext.Provider>
  );
};

export const useResidents = () => {
  const context = useContext(ResidentContext);
  if (!context) {
    throw new Error('useResidents must be used within a ResidentProvider');
  }
  return context;
};
