// A small fake of the Google Apps Script services, so the real Code.gs can be tested on a computer.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function formatDate(d, tz, fmt) {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).forEach(p => { parts[p.type] = p.value; });
  const map = { yyyy: parts.year, MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute, H: String(+parts.hour), m: String(+parts.minute) };
  return fmt.replace(/yyyy|MM|dd|HH|mm|H|m/g, k => map[k]);
}

function createGas({ now = Date.now(), properties = { ADMIN_PASSWORD: 'letmein' } } = {}) {
  const clock = { now };
  const rows = [];             // the fake spreadsheet (array of arrays, row 1 = headers)
  const mail = [];
  const cache = {};
  let lockHeld = false;

  function range(r, c, nr = 1, nc = 1) {
    return {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')),
      setValues: (vals) => vals.forEach((row, i) => row.forEach((v, j) => {
        rows[r - 1 + i] = rows[r - 1 + i] || [];
        rows[r - 1 + i][c - 1 + j] = v;
      })),
      setValue: (v) => { rows[r - 1] = rows[r - 1] || []; rows[r - 1][c - 1] = v; },
      setNumberFormat: () => {}
    };
  }
  const sheet = {
    getRange: range,
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    setFrozenRows: () => {}
  };
  let sheetExists = false;
  const ss = {
    getSheetByName: () => (sheetExists ? sheet : null),
    insertSheet: () => { sheetExists = true; return sheet; }
  };

  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); }
    static now() { return clock.now; }
  }

  const context = {
    console: { log() {}, warn() {}, error() {} },
    Date: FakeDate, Intl, JSON, Math, String, Number, Object, Array, RegExp, encodeURIComponent, isNaN,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (lockHeld) return false; lockHeld = true; return true; }, releaseLock: () => { lockHeld = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => properties[k] ?? null }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
    MailApp: { sendEmail: (o) => mail.push(o) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    Utilities: { formatDate, getUuid: () => require('crypto').randomUUID() },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => ({ text: s }) }) },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), context);

  return {
    clock, rows, mail, cache, context,
    call(payload) {
      const out = context.doPost({ postData: { contents: JSON.stringify(payload) } });
      return JSON.parse(out.text);
    },
    setNow(isoOrMs) { clock.now = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs); }
  };
}

module.exports = { createGas };
