// Combines js/booking-rules.js + apps-script/server.js into apps-script/Code.gs (the file you paste into Google).
// Run with:  node scripts/build-apps-script.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rules = fs.readFileSync(path.join(root, 'js/booking-rules.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'apps-script/server.js'), 'utf8');
const out = '/* =====================================================================\n' +
  ' * SMOOVE CAFE BOOKINGS – paste this WHOLE file into Google Apps Script.\n' +
  ' * Generated automatically from js/booking-rules.js + apps-script/server.js.\n' +
  ' * Do not edit here; edit those files and run: node scripts/build-apps-script.js\n' +
  ' * ===================================================================== */\n\n' +
  server + '\n\n' + rules;
const target = path.join(root, 'apps-script/Code.gs');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== out) {
    console.error('apps-script/Code.gs is out of date. Run: node scripts/build-apps-script.js');
    process.exit(1);
  }
  console.log('Code.gs is up to date.');
} else {
  fs.writeFileSync(target, out);
  console.log('Wrote apps-script/Code.gs');
}
