// Google Apps Script — deploy as Web App
// Spreadsheet: TRACKER PLANNER
const SHEET_ID = '1Js4xwYQUQ_M8ti5upLr_v-2cneBDDiNJ7sFw5YefkgA';

function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    switch (action) {
      case 'getTeam':
        result = getTeam();
        break;
      case 'getSchedule':
        result = getSchedule(e.parameter.month, e.parameter.year);
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  let result;

  try {
    switch (action) {
      case 'addTeamMember':
        result = addTeamMember(data);
        break;
      case 'removeTeamMember':
        result = removeTeamMember(data.row);
        break;
      case 'saveSchedule':
        result = saveSchedule(data);
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── TEAM tab: columns A=LEAD, B=SUPPORT ──

function getTeam() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TEAM');
  const data = sheet.getDataRange().getValues();
  const members = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] || data[i][1]) {
      members.push({
        row: i + 1,
        lead: data[i][0] || '',
        support: data[i][1] || ''
      });
    }
  }
  return { members };
}

function addTeamMember(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TEAM');
  sheet.appendRow([data.lead || '', data.support || '']);
  return { success: true };
}

function removeTeamMember(row) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TEAM');
  sheet.deleteRow(row);
  return { success: true };
}

// ── SCHEDULE tab: columns A=DATE, B=TIME, C=LEAD, D=SUPPORT ──

function getSchedule(month, year) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('SCHEDULE');
  const data = sheet.getDataRange().getValues();
  const schedule = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      const dateVal = data[i][0];
      const dateStr = (dateVal instanceof Date) ? formatDate(dateVal) : dateVal.toString();
      schedule.push({
        row: i + 1,
        date: dateStr,
        time: data[i][1] || '',
        lead: data[i][2] || '',
        support: data[i][3] || ''
      });
    }
  }

  if (month && year) {
    const m = parseInt(month);
    const y = parseInt(year);
    return {
      schedule: schedule.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === m && d.getFullYear() === y;
      })
    };
  }

  return { schedule };
}

function saveSchedule(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('SCHEDULE');
  const allData = sheet.getDataRange().getValues();

  let existingRow = -1;
  for (let i = 1; i < allData.length; i++) {
    const rowDate = allData[i][0] instanceof Date ? formatDate(allData[i][0]) : (allData[i][0] || '').toString();
    if (rowDate === data.date && allData[i][1] === data.time) {
      existingRow = i + 1;
      break;
    }
  }

  const rowData = [data.date, data.time, data.lead, data.support];

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, 4).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { success: true };
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
