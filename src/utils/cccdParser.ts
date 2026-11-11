import { TowerId } from '../types/resident';

export interface ParsedCccdQr {
  cccd: string;
  cmndOld: string;
  fullName: string;
  birthDate: string; // formatted dd/mm/yyyy
  birthDateIso: string; // yyyy-mm-dd
  gender: 'Nam' | 'Nữ' | 'Khác';
  permanentAddress: string;
  issueDate: string; // formatted dd/mm/yyyy
  raw: string;
}

/**
 * Attempts to repair UTF-8 text incorrectly decoded as ISO-8859-1 (Latin1)
 */
function repairMojibake(text: string): string {
  if (!text) return '';
  try {
    // If text contains sequences typical of double-encoded UTF-8
    if (/[\u00C0-\u00FF]/.test(text) && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) {
      const bytes = new Uint8Array(Array.from(text).map(c => c.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder('utf-8').decode(bytes);
      if (decoded && decoded.length > 0 && !decoded.includes('\uFFFD')) {
        return decoded;
      }
    }
  } catch {}
  return text;
}

/**
 * Parses Vietnamese CCCD QR code:
 * Format standard: CCCD|CMND cũ|Họ và tên|Ngày sinh (ddmmyyyy)|Giới tính|Địa chỉ thường trú|Ngày cấp (ddmmyyyy)
 */
export function parseCccdQrCode(qrText: string): ParsedCccdQr | null {
  if (!qrText || typeof qrText !== 'string') return null;
  const rawText = repairMojibake(qrText.trim());

  // 1. Try pipe-separated format (standard on Vietnam Citizen ID Card)
  if (rawText.includes('|')) {
    const parts = rawText.split('|').map(p => p.trim());
    if (parts.length >= 3) {
      // Find 12-digit or 9-digit CCCD in parts
      let cccd = parts[0];
      let cmndOld = parts[1] || '';
      let fullName = parts[2] || '';
      let rawDob = parts[3] || '';
      let genderRaw = (parts[4] || '').toLowerCase();
      let permanentAddress = parts[5] || '';
      let rawIssueDate = parts[6] || '';

      // If parts[0] doesn't look like CCCD but parts has 12 digits anywhere
      if (!/^\d{9,12}$/.test(cccd)) {
        const foundCccdIdx = parts.findIndex(p => /^\d{12}$/.test(p));
        if (foundCccdIdx !== -1) {
          cccd = parts[foundCccdIdx];
          if (foundCccdIdx + 2 < parts.length) {
            fullName = parts[foundCccdIdx + 2];
          }
        }
      }

      const { formatted: birthDate, iso: birthDateIso } = parseVnDate(rawDob);
      const { formatted: issueDate } = parseVnDate(rawIssueDate);

      let gender: 'Nam' | 'Nữ' | 'Khác' = 'Khác';
      if (genderRaw.includes('nam') || genderRaw === 'm' || genderRaw === 'male') {
        gender = 'Nam';
      } else if (genderRaw.includes('nữ') || genderRaw.includes('nu') || genderRaw === 'f' || genderRaw === 'female') {
        gender = 'Nữ';
      }

      return {
        cccd,
        cmndOld,
        fullName: fullName.toUpperCase(),
        birthDate,
        birthDateIso,
        gender,
        permanentAddress,
        issueDate,
        raw: rawText,
      };
    }
  }

  // 2. Try JSON format
  try {
    const obj = JSON.parse(rawText);
    if (obj.cccd || obj.id || obj.fullName) {
      const cccd = (obj.cccd || obj.id || '').trim();
      const cmndOld = (obj.cmndOld || obj.cmnd || '').trim();
      const fullName = (obj.fullName || obj.name || '').trim();
      const { formatted: birthDate, iso: birthDateIso } = parseVnDate(obj.birthDate || obj.dob || '');
      const gender = (obj.gender === 'Nữ' || obj.gender === 'Female') ? 'Nữ' : 'Nam';
      const permanentAddress = (obj.permanentAddress || obj.address || '').trim();
      const { formatted: issueDate } = parseVnDate(obj.issueDate || '');

      return {
        cccd,
        cmndOld,
        fullName: fullName.toUpperCase(),
        birthDate,
        birthDateIso,
        gender,
        permanentAddress,
        issueDate,
        raw: rawText,
      };
    }
  } catch {}

  // 3. Fallback: Search for 12 digits anywhere in raw text
  const match12 = rawText.match(/\b(\d{12})\b/);
  if (match12) {
    return {
      cccd: match12[1],
      cmndOld: '',
      fullName: '',
      birthDate: '',
      birthDateIso: '',
      gender: 'Nam',
      permanentAddress: '',
      issueDate: '',
      raw: rawText,
    };
  }

  return null;
}

/**
 * Parses date string in ddmmyyyy, dd/mm/yyyy, or yyyy-mm-dd
 */
export function parseVnDate(raw: string): { formatted: string; iso: string } {
  if (!raw) return { formatted: '', iso: '' };
  const clean = raw.trim();

  // 8 digits: ddmmyyyy (e.g. 15081995)
  if (/^\d{8}$/.test(clean)) {
    const day = clean.substring(0, 2);
    const month = clean.substring(2, 4);
    const year = clean.substring(4, 8);
    return {
      formatted: `${day}/${month}/${year}`,
      iso: `${year}-${month}-${day}`,
    };
  }

  // dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/');
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    return {
      formatted: `${day}/${month}/${y}`,
      iso: `${y}-${month}-${day}`,
    };
  }

  // yyyy-mm-dd
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) {
    const [y, m, d] = clean.split('-');
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    return {
      formatted: `${day}/${month}/${y}`,
      iso: `${y}-${month}-${day}`,
    };
  }

  return { formatted: clean, iso: '' };
}

/**
 * Determines Tower from Apartment Code
 * Ký tự đầu của mã căn hộ:
 * A -> Tháp A
 * B -> Tháp B
 * C -> Tháp C
 * D -> Tháp D
 * Còn lại -> Ngoài chung cư
 */
export function getTowerFromApartmentCode(code: string): {
  towerId: TowerId;
  towerName: string;
} {
  if (!code || typeof code !== 'string') {
    return { towerId: 'NCC', towerName: 'Ngoài chung cư' };
  }
  const trimmed = code.trim().toUpperCase();
  const firstChar = trimmed.charAt(0);

  if (firstChar === 'A') {
    return { towerId: 'A', towerName: 'Tháp A' };
  }
  if (firstChar === 'B') {
    return { towerId: 'B', towerName: 'Tháp B' };
  }
  if (firstChar === 'C') {
    return { towerId: 'C', towerName: 'Tháp C' };
  }
  if (firstChar === 'D') {
    return { towerId: 'D', towerName: 'Tháp D' };
  }
  return { towerId: 'NCC', towerName: 'Ngoài chung cư' };
}

/**
 * Sample CCCD QR strings for demonstration and testing without physical cards
 */
export const SAMPLE_CCCD_QRS = [
  {
    label: 'Nguyễn Văn An (Chủ hộ - Tháp A)',
    qr: '079201004567|025684992|NGUYỄN VĂN AN|15081990|Nam|Số 123 Đường Số 7, Phường Bình Phú, Quận 6, TP.HCM|20042021',
  },
  {
    label: 'Trần Thị Mai (Vợ - Tháp A)',
    qr: '079095012345||TRẦN THỊ MAI|02111993|Nữ|Số 123 Đường Số 7, Phường Bình Phú, Quận 6, TP.HCM|15102022',
  },
  {
    label: 'Lê Hoàng Nam (Khách thuê - Tháp B - CÓ TIỀN ÁN)',
    qr: '079188009876|024198231|LÊ HOÀNG NAM|25121988|Nam|Phường 2, Thành phố Tân An, Long An|10062020',
  },
  {
    label: 'Phạm Minh Đức (Chưa đăng ký - Tháp C - Người mới)',
    qr: '079203008899||PHẠM MINH ĐỨC|05042003|Nam|Thị trấn Cần Giuộc, Huyện Cần Giuộc, Long An|08032023',
  },
];
