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
      case 'addPerson':
        result = addPerson(data.role, data.name);
        break;
      case 'removePerson':
        result = removePerson(data.role, data.row);
        break;
      case 'removePersonByName':
        result = removePersonByName(data.role, data.name);
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
  const leads = [];
  const supports = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] || data[i][1]) {
      members.push({
        row: i + 1,
        lead: data[i][0] || '',
        support: data[i][1] || ''
      });
    }
    if (data[i][0]) leads.push({ row: i + 1, name: data[i][0].toString() });
    if (data[i][1]) supports.push({ row: i + 1, name: data[i][1].toString() });
  }
  return { members, leads, supports };
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

function addPerson(role, name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TEAM');
  const col = role === 'lead' ? 1 : 2;
  const data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (!data[i][col - 1]) {
      sheet.getRange(i + 1, col).setValue(name);
      return { success: true };
    }
  }
  var newRow = data.length + 1;
  sheet.getRange(newRow, col).setValue(name);
  return { success: true };
}

function removePerson(role, row) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TEAM');
  const col = role === 'lead' ? 1 : 2;
  sheet.getRange(row, col).clearContent();
  var data = sheet.getDataRange().getValues();
  if (row <= data.length && !data[row - 1][0] && !data[row - 1][1]) {
    sheet.deleteRow(row);
  }
  return { success: true };
}

function removePersonByName(role, name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('TEAM');
  const col = role === 'lead' ? 1 : 2;
  const data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if ((data[i][col - 1] || '').toString().toUpperCase() === name.toUpperCase()) {
      sheet.getRange(i + 1, col).clearContent();
      if (!data[i][0] && !data[i][1] || (col === 1 && !data[i][1]) || (col === 2 && !data[i][0])) {
        // Check if entire row is now empty
        var updated = sheet.getRange(i + 1, 1, 1, 2).getValues()[0];
        if (!updated[0] && !updated[1]) sheet.deleteRow(i + 1);
      }
      return { success: true };
    }
  }
  return { error: 'Not found' };
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

  var matchingRows = [];
  for (var i = 1; i < allData.length; i++) {
    var rowDate = allData[i][0] instanceof Date ? formatDate(allData[i][0]) : (allData[i][0] || '').toString().trim();
    var rowTime = (allData[i][1] || '').toString().trim();
    if (rowDate === data.date && rowTime === data.time) {
      matchingRows.push(i + 1);
    }
  }

  var rowData = [data.date, data.time, data.lead || '', data.support || ''];

  if (matchingRows.length > 0) {
    sheet.getRange(matchingRows[0], 1, 1, 4).setValues([rowData]);
    for (var j = matchingRows.length - 1; j >= 1; j--) {
      sheet.deleteRow(matchingRows[j]);
    }
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
