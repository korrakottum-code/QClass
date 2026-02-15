/* COPY START (FULL CODE - Timezone Fixed + Delete Support) */
var SPREADSHEET_ID = '1_0jSmY5hjJ-wGoRl3AM4cErV0qmA4guaXLR5sLbyDZo';
var DATA_SHEET_NAME = 'Data';
var CONFIG_SHEET_NAME = 'Config';
var BRANCH_SHEET_NAME = 'Branches';

function doGet(e) {
    var action = e.parameter ? e.parameter.action : '';
    if (action == 'get_dashboard') return getDashboardData(e);
    if (action == 'update_record') return updateRecord(e);
    if (action == 'delete_record') return deleteRecords(e);
    return getConfig();
}

function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        saveDataToSheet(data);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}

function getConfig() {
    var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        services: getServicesFromSheet(ss),
        branches: getBranchesFromSheet(ss)
    })).setMimeType(ContentService.MimeType.JSON);
}

function getServicesFromSheet(ss) {
    var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) sheet = SetupConfigSheet(ss);
    var data = sheet.getDataRange().getValues();
    var services = {};
    for (var i = 1; i < data.length; i++) {
        var cat = data[i][0];
        var sub = data[i][1];
        if (cat && cat !== "") {
            if (!services[cat]) services[cat] = [];
            if (sub && sub !== "" && services[cat].indexOf(sub) === -1) services[cat].push(sub);
        }
    }
    return services;
}

function getBranchesFromSheet(ss) {
    var sheet = ss.getSheetByName(BRANCH_SHEET_NAME);
    if (!sheet) sheet = SetupBranchSheet(ss);
    var data = sheet.getDataRange().getValues();
    var branches = {};
    for (var i = 1; i < data.length; i++) {
        var name = data[i][0];
        var code = data[i][1];
        if (name && name !== "" && code && code !== "") branches[name] = code;
    }
    return branches;
}

function SetupConfigSheet(ss) {
    var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(CONFIG_SHEET_NAME);
        sheet.appendRow(["Service Category", "Sub Services"]);
        sheet.appendRow(["Botox", "ริ้วรอย, กราม, ลิฟกรอบหน้า"]);
    }
    return sheet;
}

function SetupBranchSheet(ss) {
    var sheet = ss.getSheetByName(BRANCH_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(BRANCH_SHEET_NAME);
        sheet.appendRow(["Branch Name", "Branch Code"]);
        sheet.appendRow(["สยาม (SIAM)", "SIAM"]);
    }
    return sheet;
}

// --- OPTIMIZED & TIMEZONE FIXED ---
function getDashboardData(e) {
    var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No Data sheet' })).setMimeType(ContentService.MimeType.JSON);

    var p = e.parameter;
    var limit = p.limit ? parseInt(p.limit) : 3000;
    var startDate = p.startDate;
    var endDate = p.endDate;

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return ContentService.createTextOutput(JSON.stringify({ status: 'success', records: [] })).setMimeType(ContentService.MimeType.JSON);

    var data = [];

    if (startDate && endDate) {
        try {
            var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
            var matchingRows = [];

            // Use Intl to FORCE Bangkok Timezone (YYYY-MM-DD)
            // This matches exactly what you see in the Sheet
            var timeZone = ss.getSpreadsheetTimeZone() || 'Asia/Bangkok';
            var formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            for (var i = 0; i < dates.length; i++) {
                var d = dates[i][0];
                if (!d) continue;

                var dString = "";
                if (d instanceof Date) {
                    dString = formatter.format(d); // "2026-01-01" in Bangkok Time
                } else {
                    dString = String(d).substring(0, 10);
                }

                if (dString >= startDate && dString <= endDate) {
                    matchingRows.push(i + 2);
                }
            }

            if (matchingRows.length > 0) {
                var first = matchingRows[0];
                var last = matchingRows[matchingRows.length - 1];
                var num = last - first + 1;
                data = sheet.getRange(first, 1, num, sheet.getLastColumn()).getValues();
            }
        } catch (err) {
            data = [];
        }
    } else {
        var startRow = 2;
        var numRows = lastRow - 1;
        if (limit > 0 && numRows > limit) {
            startRow = Math.max(2, lastRow - limit + 1);
            numRows = limit;
        }
        data = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
    }

    var records = data.map(function (row) {
        var dateVal = ApiDateToIso(row[0]);
        if (startDate && endDate) {
            if (dateVal < startDate || dateVal > endDate) return null;
        }
        var id = dateVal + '_' + row[1] + '_' + Math.random().toString(36).substr(2, 5);
        return {
            id: id,
            timestamp: dateVal + ' 00:00:00',
            date: dateVal,
            branch: row[1],
            totalQue: row[4],
            items: [{ program: row[2], sub: row[3], que: row[4] }]
        };
    }).filter(function (r) { return r !== null; });

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', records: records })).setMimeType(ContentService.MimeType.JSON);
}

function saveDataToSheet(data) {
    var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(DATA_SHEET_NAME);
        sheet.appendRow(['Day', 'Province', 'Program', 'Sub', 'Que']);
    }
    data.items.forEach(function (item) {
        sheet.appendRow([data.date, data.branch, item.program, item.sub || item.program, item.que]);
    });
}

function updateRecord(e) {
    var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!sheet) return errorResponse('Sheet not found');

    var p = e.parameter;
    var targetDate = p.date;
    var targetBranch = p.branch;
    var targetProgram = p.program;
    var targetSub = p.sub;
    var newQue = p.que;

    var data = sheet.getDataRange().getValues();
    var updated = false;

    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var rowDate = ApiDateToIso(row[0]);
        var matchSub = (row[3] == targetSub) || (!row[3] && !targetSub) || (row[3] === '' && !targetSub);

        if (rowDate === targetDate && row[1] === targetBranch && row[2] === targetProgram && matchSub) {
            sheet.getRange(i + 1, 5).setValue(newQue);
            updated = true;
            break;
        }
    }

    if (updated) return successResponse({ message: 'Updated successfully' });
    else return errorResponse('Record not found');
}

// --- DELETE RECORDS: Actually removes rows from Google Sheet ---
function deleteRecords(e) {
    var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!sheet) return errorResponse('Sheet not found');

    var p = e.parameter;
    var targetDate = p.date;
    var targetBranch = p.branch;

    if (!targetDate || !targetBranch) return errorResponse('Missing date or branch parameter');

    var data = sheet.getDataRange().getValues();
    var timeZone = ss.getSpreadsheetTimeZone() || 'Asia/Bangkok';
    var formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    // Collect row indices to delete (1-indexed, skip header)
    var rowsToDelete = [];
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var rowDate = '';
        if (row[0] instanceof Date) {
            rowDate = formatter.format(row[0]);
        } else {
            rowDate = ApiDateToIso(row[0]);
        }

        if (rowDate === targetDate && row[1] === targetBranch) {
            rowsToDelete.push(i + 1); // +1 because sheet rows are 1-indexed
        }
    }

    if (rowsToDelete.length === 0) {
        return errorResponse('No matching records found');
    }

    // Delete from bottom to top to avoid index shifting
    for (var j = rowsToDelete.length - 1; j >= 0; j--) {
        sheet.deleteRow(rowsToDelete[j]);
    }

    return successResponse({ message: 'Deleted ' + rowsToDelete.length + ' records', deleted: rowsToDelete.length });
}

function successResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(Object.assign({ status: 'success' }, data))).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: message })).setMimeType(ContentService.MimeType.JSON);
}

function ApiDateToIso(dateObj) {
    if (Object.prototype.toString.call(dateObj) === '[object Date]') {
        var y = dateObj.getFullYear();
        var m = dateObj.getMonth() + 1;
        var d = dateObj.getDate();
        return y + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d);
    }
    if (typeof dateObj === 'string') return dateObj.split('T')[0];
    return dateObj;
}
/* COPY END */
