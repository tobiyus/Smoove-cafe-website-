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
  const sheets = {};           // name -> array of rows (row 1 = headers)
  const mail = [];
  const cache = {};
  const triggers = [];
  let lockHeld = false;

  function makeSheet(rows) {
    function range(r, c, nr = 1, nc = 1) {
      return {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')),
        setValues: (vals) => vals.forEach((row, i) => row.forEach((v, j) => {
          rows[r - 1 + i] = rows[r - 1 + i] || [];
          rows[r - 1 + i][c - 1 + j] = v;
        })),
        setValue: (v) => { rows[r - 1] = rows[r - 1] || []; rows[r - 1][c - 1] = v; },
        setNumberFormat: () => {},
        sort: (specs) => {
          const block = rows.slice(r - 1, r - 1 + nr);
          block.sort((x, y) => {
            for (const s of specs) {
              const a = String(x[s.column - 1] ?? ''), b = String(y[s.column - 1] ?? '');
              if (a !== b) return (a < b ? -1 : 1) * (s.ascending === false ? -1 : 1);
            }
            return 0;
          });
          rows.splice(r - 1, nr, ...block);
        }
      };
    }
    return { getRange: range, getLastRow: () => rows.length, getMaxRows: () => 1000, setFrozenRows: () => {} };
  }
  const sheetObjs = {};
  const ss = {
    getSheetByName: (n) => sheetObjs[n] || null,
    insertSheet: (n) => { sheets[n] = []; sheetObjs[n] = makeSheet(sheets[n]); return sheetObjs[n]; }
  };
  // Bookings tab exists up front so tests can read gas.rows
  ss.insertSheet('Bookings');
  const rows = sheets.Bookings;
  // setup() would normally add headers; mimic the first-time header row when the code creates it
  delete sheetObjs.Bookings;
  const realInsert = ss.insertSheet;
  ss.insertSheet = (n) => {
    if (n === 'Bookings') { sheetObjs.Bookings = makeSheet(rows); return sheetObjs.Bookings; }
    return realInsert(n);
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
    ScriptApp: {
      getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t.handler, _t: t })),
      deleteTrigger: (t) => { triggers.splice(triggers.indexOf(t._t), 1); },
      newTrigger: (handler) => {
        const t = { handler };
        const b = { timeBased: () => b, everyDays: (n) => { t.days = n; return b; }, atHour: (h) => { t.hour = h; return b; },
          inTimezone: (z) => { t.tz = z; return b; }, create: () => { triggers.push(t); return t; } };
        return b;
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), context);

  return {
    clock, rows, sheets, mail, cache, context, triggers,
    get(payload) { return JSON.parse(context.doGet().text); },
    call(payload) {
      const out = context.doPost({ postData: { contents: JSON.stringify(payload) } });
      return JSON.parse(out.text);
    },
    setNow(isoOrMs) { clock.now = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs); }
  };
}

module.exports = { createGas };
