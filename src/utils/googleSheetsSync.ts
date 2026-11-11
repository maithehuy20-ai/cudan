import { Resident, CheckLog } from '../types/resident';

/**
 * Ready-to-copy Google Apps Script template for Google Sheets
 * Users can paste this directly into: Extensions > Apps Script in Google Sheets
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// === GOOGLE APPS SCRIPT ĐỒNG BỘ CƯ TRÚ KHU PHỐ 16 ===
// Cách cài đặt:
// 1. Mở Google Sheet > Mở Tiện ích mở rộng (Extensions) > Apps Script
// 2. Dán toàn bộ mã này vào và bấm 'Lưu' (Save)
// 3. Bấm 'Triển khai' (Deploy) > 'Tùy chọn triển khai mới' (New deployment)
// 4. Chọn Loại: Ứng dụng web (Web app)
// 5. Cấu hình: 
//    - Thực thi dưới dạng (Execute as): 'Tôi' (Me)
//    - Ai có quyền truy cập (Who has access): 'Bất kỳ ai' (Anyone)
// 6. Sao chép URL ứng dụng web (Web App URL) dán vào phần mềm Quản lý Cư trú.

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('DanhSachCuDan') || ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({ success: true, residents: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var headers = data[0];
  var residents = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    residents.push(obj);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true, residents: residents }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Lưu Danh Sách Cư Dân
    if (contents.residents && contents.residents.length > 0) {
      var sheet = ss.getSheetByName('DanhSachCuDan');
      if (!sheet) {
        sheet = ss.insertSheet('DanhSachCuDan');
      } else {
        sheet.clear();
      }
      
      var headers = [
        'Mã căn hộ', 'Họ và tên', 'Ngày sinh', 'Giới tính', 'Số CCCD', 'Số CMND cũ',
        'Số điện thoại', 'Quan hệ chủ hộ', 'Tình trạng cư trú', 'Quốc tịch', 'Chủ hộ',
        'Nơi thường trú', 'Nơi tạm trú', 'Nơi ở hiện tại', 'Họ tên Cha', 'Họ tên Mẹ',
        'Hôn nhân', 'Họ tên Vợ/Chồng', 'Ngày đăng ký', 'Ngày hết hạn tạm trú', 'Tiền án / Tiền sự'
      ];
      
      var rows = [headers];
      for (var k = 0; k < contents.residents.length; k++) {
        var r = contents.residents[k];
        rows.push([
          r.apartmentCode || '',
          r.fullName || '',
          r.birthDate || '',
          r.gender || '',
          r.cccd || '',
          r.cmndOld || '',
          r.phoneNumber || '',
          r.relationship || '',
          r.residenceStatus || '',
          r.nationality || 'Việt Nam',
          r.headOfHousehold || '',
          r.permanentAddress || '',
          r.temporaryAddress || '',
          r.currentAddress || '',
          r.fatherName || '',
          r.motherName || '',
          r.maritalStatus || '',
          r.spouseName || '',
          r.registrationDate || '',
          r.expiryDate || '',
          r.hasCriminalRecord ? r.criminalRecord : 'Không tiền án/tiền sự'
        ]);
      }
      
      sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    }
    
    // Lưu Nhật Ký Kiểm Tra (nếu có)
    if (contents.logs && contents.logs.length > 0) {
      var logSheet = ss.getSheetByName('NhatKyKiemTra');
      if (!logSheet) {
        logSheet = ss.insertSheet('NhatKyKiemTra');
      } else {
        logSheet.clear();
      }
      
      var logHeaders = [
        'Ngày giờ kiểm tra', 'Mã căn hộ', 'Cán bộ kiểm tra', 'Họ tên', 'Số CCCD',
        'Giới tính', 'Ngày sinh', 'Nơi thường trú', 'Tình trạng cư trú', 'Kết quả kiểm tra', 'Ghi chú'
      ];
      
      var logRows = [logHeaders];
      for (var l = 0; l < contents.logs.length; l++) {
        var item = contents.logs[l];
        logRows.push([
          item.checkDateTime || '',
          item.apartmentCode || '',
          item.officerName || '',
          item.fullName || '',
          item.cccd || '',
          item.gender || '',
          item.birthDate || '',
          item.permanentAddress || '',
          item.residenceStatus || '',
          item.resultStatus || '',
          item.notes || ''
        ]);
      }
      
      logSheet.getRange(1, 1, logRows.length, logHeaders.length).setValues(logRows);
      logSheet.getRange(1, 1, 1, logHeaders.length).setFontWeight('bold').setBackground('#047857').setFontColor('#ffffff');
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      message: 'Đồng bộ thành công ' + contents.residents.length + ' cư dân!',
      updatedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

/**
 * Push data to Google Sheets via Apps Script Webhook
 */
export async function pushToGoogleSheet(
  webhookUrl: string,
  residents: Resident[],
  logs: CheckLog[]
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, message: 'URL Webhook Google Apps Script không hợp lệ.' };
  }

  try {
    const payload = {
      action: 'sync_up',
      residents,
      logs,
      timestamp: new Date().toISOString(),
    };

    // Google Apps Script requires text/plain or direct POST to avoid CORS preflight failures
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Máy chủ Google phản hồi mã lỗi: ${response.status}`);
    }

    const resJson = await response.json();
    if (resJson.success) {
      return {
        success: true,
        message: resJson.message || `Đã đồng bộ ${residents.length} cư dân lên Google Sheet thành công!`,
      };
    } else {
      return {
        success: false,
        message: resJson.error || 'Google Apps Script trả về lỗi xử lý.',
      };
    }
  } catch (error: any) {
    console.error('Google Sheet Sync Error:', error);
    // Provide actionable diagnosis
    return {
      success: false,
      message: `Lỗi kết nối: ${error.message || 'Không thể gửi dữ liệu'}. Vui lòng kiểm tra quyền "Ai có quyền truy cập: Bất kỳ ai" trong triển khai Apps Script.`,
    };
  }
}

/**
 * Pull data from Google Sheets via Apps Script GET or Published CSV
 */
export async function pullFromGoogleSheet(
  fetchUrl: string
): Promise<{ success: boolean; data?: any[]; message: string }> {
  if (!fetchUrl || !fetchUrl.startsWith('http')) {
    return { success: false, message: 'URL Google Sheet không hợp lệ.' };
  }

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Mã lỗi HTTP: ${response.status}`);
    }

    const text = await response.text();

    // Check if it's JSON from Google Apps Script
    try {
      const json = JSON.parse(text);
      if (json.residents && Array.isArray(json.residents)) {
        return {
          success: true,
          data: json.residents,
          message: `Tải thành công ${json.residents.length} bản ghi từ Google Sheet!`,
        };
      }
    } catch {
      // not direct JSON, could be CSV
    }

    return {
      success: false,
      message: 'Định dạng phản hồi không khớp với cấu trúc danh sách cư dân.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Không thể kết nối lấy dữ liệu: ${err.message}`,
    };
  }
}
