import * as XLSX from 'xlsx';
import { Resident, CheckLog } from '../types/resident';
import { getTowerFromApartmentCode } from './cccdParser';

/**
 * Generates an Excel file containing all Residents, Tower summary, and Check Logs
 */
export function exportResidentsToExcel(residents: Resident[], logs: CheckLog[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Danh sách cư dân
  const residentRows = residents.map((r, index) => {
    const tower = getTowerFromApartmentCode(r.apartmentCode);
    return {
      'STT': index + 1,
      'Mã căn hộ': r.apartmentCode,
      'Tháp': tower.towerName,
      'Họ và tên': r.fullName,
      'Ngày sinh': r.birthDate,
      'Giới tính': r.gender,
      'Số CCCD': r.cccd,
      'Số CMND cũ': r.cmndOld || '',
      'Số điện thoại': r.phoneNumber,
      'Quan hệ chủ hộ': r.relationship,
      'Tình trạng cư trú': r.residenceStatus,
      'Quốc tịch': r.nationality || 'Việt Nam',
      'Chủ hộ': r.headOfHousehold,
      'Nơi thường trú': r.permanentAddress,
      'Nơi tạm trú': r.temporaryAddress || '',
      'Nơi ở hiện tại': r.currentAddress,
      'Họ tên Cha': r.fatherName || '',
      'Họ tên Mẹ': r.motherName || '',
      'Hôn nhân': r.maritalStatus,
      'Họ tên Vợ/Chồng': r.spouseName || '',
      'Ngày đăng ký': r.registrationDate,
      'Ngày hết hạn tạm trú': r.expiryDate || '',
      'Tiền án / Tiền sự': r.hasCriminalRecord ? r.criminalRecord : 'Không tiền án/tiền sự',
    };
  });
  const wsResidents = XLSX.utils.json_to_sheet(residentRows);
  XLSX.utils.book_append_sheet(wb, wsResidents, 'DanhSachCuDan');

  // Sheet 2: Nhật ký kiểm tra cư trú
  const logRows = logs.map((l, index) => ({
    'STT': index + 1,
    'Ngày giờ kiểm tra': l.checkDateTime,
    'Hành động': l.actionType || 'KIỂM TRA CƯ TRÚ',
    'Chi tiết hành động': l.actionDescription || '',
    'Mã căn hộ': l.apartmentCode,
    'Cán bộ kiểm tra': l.officerName,
    'Họ và tên': l.fullName,
    'Số CCCD': l.cccd,
    'Số CMND cũ': l.cmndOld || '',
    'Giới tính': l.gender,
    'Ngày sinh': l.birthDate,
    'Nơi thường trú': l.permanentAddress,
    'Tình trạng cư trú': l.residenceStatus,
    'Kết quả kiểm tra': l.resultStatus,
    'Ghi chú': l.notes,
  }));
  const wsLogs = XLSX.utils.json_to_sheet(logRows);
  XLSX.utils.book_append_sheet(wb, wsLogs, 'NhatKyKiemTra');

  const nowStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `QuanLyCuTru_KP16_BinhPhu_${nowStr}.xlsx`);
}

/**
 * Downloads a standardized Excel template for adding or updating residents
 */
export function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new();
  const sampleData = [
    {
      'Mã căn hộ': 'A.1201',
      'Họ và tên': 'NGUYỄN VĂN AN',
      'Ngày sinh': '15/08/1990',
      'Giới tính': 'Nam',
      'Số CCCD': '079201004567',
      'Số CMND cũ': '025684992',
      'Số điện thoại': '0908123456',
      'Quan hệ chủ hộ': 'Chủ hộ',
      'Tình trạng cư trú': 'Thường trú',
      'Quốc tịch': 'Việt Nam',
      'Chủ hộ': 'NGUYỄN VĂN AN',
      'Nơi thường trú': 'Số 123 Đường Số 7, Phường Bình Phú, Quận 6, TP.HCM',
      'Nơi tạm trú': '',
      'Nơi ở hiện tại': 'Căn A.1201 Chung cư Bình Phú, KP16, Bình Phú',
      'Họ tên Cha': 'Nguyễn Văn Ba',
      'Họ tên Mẹ': 'Lê Thị Tư',
      'Hôn nhân': 'Đã kết hôn',
      'Họ tên Vợ/Chồng': 'Trần Thị Mai',
      'Ngày đăng ký': '10/01/2021',
      'Ngày hết hạn tạm trú': '',
      'Tiền án / Tiền sự': 'Không tiền án/tiền sự',
    },
    {
      'Mã căn hộ': 'B.0405',
      'Họ và tên': 'LÊ HOÀNG NAM',
      'Ngày sinh': '25/12/1988',
      'Giới tính': 'Nam',
      'Số CCCD': '079188009876',
      'Số CMND cũ': '024198231',
      'Số điện thoại': '0912345678',
      'Quan hệ chủ hộ': 'Khách thuê',
      'Tình trạng cư trú': 'Tạm trú',
      'Quốc tịch': 'Việt Nam',
      'Chủ hộ': 'Trần Văn Bảo',
      'Nơi thường trú': 'Phường 2, TP Tân An, Long An',
      'Nơi tạm trú': 'Căn B.0405 Chung cư Bình Phú',
      'Nơi ở hiện tại': 'Căn B.0405 Chung cư Bình Phú',
      'Họ tên Cha': 'Lê Văn Hoàng',
      'Họ tên Mẹ': 'Ngô Thị Liễu',
      'Hôn nhân': 'Độc thân',
      'Họ tên Vợ/Chồng': '',
      'Ngày đăng ký': '01/06/2024',
      'Ngày hết hạn tạm trú': '01/06/2026',
      'Tiền án / Tiền sự': 'Năm 2018 gây rối trật tự công cộng (Đã chấp hành xong)',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Lieu');
  XLSX.writeFile(wb, 'Mau_Danh_Sach_Cu_Tru_KP16.xlsx');
}

/**
 * Parses an uploaded Excel file and returns normalized Resident objects
 */
export async function parseResidentsFromExcel(file: File): Promise<Resident[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws);

  const parsedResidents: Resident[] = [];

  for (const row of rawRows) {
    const cccd = String(row['Số CCCD'] || row['CCCD'] || row['cccd'] || '').trim();
    const fullName = String(row['Họ và tên'] || row['Họ tên'] || row['fullName'] || '').trim();
    const apartmentCode = String(row['Mã căn hộ'] || row['Căn hộ'] || row['apartmentCode'] || 'NCC.01').trim();

    if (!cccd && !fullName) continue; // skip empty rows

    const criminalRaw = String(row['Tiền án / Tiền sự'] || row['Tiền án tiền sự'] || row['criminalRecord'] || '').trim();
    const hasCriminalRecord = criminalRaw !== '' && 
      !criminalRaw.toLowerCase().includes('không') && 
      !criminalRaw.toLowerCase().includes('khong');

    const genderRaw = String(row['Giới tính'] || row['gender'] || 'Nam').trim();
    let gender: 'Nam' | 'Nữ' | 'Khác' = 'Nam';
    if (genderRaw.toLowerCase().includes('nữ') || genderRaw.toLowerCase() === 'female') {
      gender = 'Nữ';
    } else if (genderRaw.toLowerCase().includes('khác')) {
      gender = 'Khác';
    }

    const relRaw = String(row['Quan hệ chủ hộ'] || row['Mối quan hệ'] || row['relationship'] || 'Chủ hộ').trim();
    const residenceStatusRaw = String(row['Tình trạng cư trú'] || row['residenceStatus'] || 'Thường trú').trim();

    const resident: Resident = {
      id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      apartmentCode: apartmentCode || 'NCC.01',
      fullName: fullName || 'Chưa rõ',
      birthDate: String(row['Ngày sinh'] || row['birthDate'] || '01/01/1990').trim(),
      gender,
      cccd: cccd || '000000000000',
      cmndOld: String(row['Số CMND cũ'] || row['CMND'] || '').trim(),
      phoneNumber: String(row['Số điện thoại'] || row['phoneNumber'] || '').trim(),
      relationship: (relRaw as any) || 'Chủ hộ',
      residenceStatus: (residenceStatusRaw as any) || 'Thường trú',
      nationality: String(row['Quốc tịch'] || 'Việt Nam').trim(),
      permanentAddress: String(row['Nơi thường trú'] || '').trim(),
      temporaryAddress: String(row['Nơi tạm trú'] || '').trim(),
      currentAddress: String(row['Nơi ở hiện tại'] || row['Địa chỉ hiện tại'] || '').trim(),
      headOfHousehold: String(row['Chủ hộ'] || row['Họ tên chủ hộ'] || fullName).trim(),
      fatherName: String(row['Họ tên Cha'] || '').trim(),
      motherName: String(row['Họ tên Mẹ'] || '').trim(),
      maritalStatus: (row['Hôn nhân'] as any) || 'Độc thân',
      spouseName: String(row['Họ tên Vợ/Chồng'] || '').trim(),
      registrationDate: String(row['Ngày đăng ký'] || new Date().toISOString().slice(0, 10)).trim(),
      expiryDate: String(row['Ngày hết hạn tạm trú'] || '').trim(),
      criminalRecord: hasCriminalRecord ? criminalRaw : 'Không tiền án/tiền sự',
      hasCriminalRecord,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    parsedResidents.push(resident);
  }

  return parsedResidents;
}
