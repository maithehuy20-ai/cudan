export type TowerId = 'A' | 'B' | 'C' | 'D' | 'NCC';

export type ResidenceStatus = 'Thường trú' | 'Tạm trú' | 'Chưa đăng ký' | 'Đã chuyển đi';

export type Relationship = 
  | 'Chủ hộ'
  | 'Vợ'
  | 'Chồng'
  | 'Con'
  | 'Cha'
  | 'Mẹ'
  | 'Em'
  | 'Anh/Chị'
  | 'Ông/Bà'
  | 'Cháu'
  | 'Khách thuê'
  | 'Khác';

export type MaritalStatus = 'Độc thân' | 'Đã kết hôn' | 'Ly hôn' | 'Góa' | 'Chưa xác định';

export interface Resident {
  id: string;
  apartmentCode: string; // e.g. A.1204, B.0502, C.0801, D.1503, NCC.01
  fullName: string;
  birthDate: string; // dd/mm/yyyy or yyyy-mm-dd
  gender: 'Nam' | 'Nữ' | 'Khác';
  cccd: string; // 12 digits
  cmndOld?: string; // 9 digits if available
  phoneNumber: string;
  relationship: Relationship;
  residenceStatus: ResidenceStatus;
  nationality: string; // Default: 'Việt Nam'
  
  // Demographics details
  permanentAddress: string; // Nơi thường trú
  temporaryAddress: string; // Nơi tạm trú
  currentAddress: string;   // Nơi ở hiện tại
  headOfHousehold: string;  // Họ tên chủ hộ
  fatherName?: string;      // Họ tên cha
  motherName?: string;      // Họ tên mẹ
  maritalStatus: MaritalStatus;
  spouseName?: string;      // Họ tên vợ/chồng
  registrationDate: string; // Ngày đăng ký cư trú
  expiryDate?: string;      // Ngày hết hạn tạm trú

  // Criminal record info - highlighted red if exists
  criminalRecord: string; // Nếu rỗng hoặc "Không" -> 'Không tiền án/tiền sự'
  hasCriminalRecord: boolean;

  // Media
  avatarUrl?: string; // Real person image (base64 or URL)
  cccdFrontUrl?: string;
  cccdBackUrl?: string;

  createdAt: string;
  updatedAt: string;
}

export type LogActionType = 
  | 'QUÉT QR CCCD'
  | 'KIỂM TRA CƯ TRÚ'
  | 'TỰ ĐỘNG THÊM NHÂN KHẨU'
  | 'CẬP NHẬT HỒ SƠ'
  | 'GIA HẠN TẠM TRÚ'
  | 'XÁC MINH CƯ TRÚ'
  | 'NHẬP DỮ LIỆU EXCEL';

export interface CheckLog {
  id: string;
  checkDateTime: string; // ISO string or formatted datetime
  apartmentCode: string;
  officerName: string; // Cán bộ kiểm tra
  
  // Hành động kiểm tra / tác nghiệp
  actionType: LogActionType;
  actionDescription?: string;

  // Scanned / resident info
  cccd: string;
  cmndOld?: string;
  fullName: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  birthDate: string;
  permanentAddress: string;
  issueDate?: string; // Ngày cấp CCCD
  residenceStatus: ResidenceStatus;
  
  // Photos captured during check
  cccdFrontUrl?: string;
  cccdBackUrl?: string;
  personPhotoUrl?: string;

  resultStatus: 'Hợp lệ' | 'Vi phạm chưa đăng ký' | 'Quá hạn tạm trú' | 'Cần xác minh thêm';
  notes: string;
  matchedResidentId?: string; // linked resident ID if matched
}

export interface GoogleSheetConfig {
  webhookUrl: string; // Google Apps Script web app URL
  sheetName: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}
