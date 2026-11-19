// Checks that the files you edit by hand (menu, details) still load without typos.
const fs = require('fs');
const vm = require('vm');
let failed = false;
for (const [file, key] of [['js/menu.js', 'SMOOVE_MENU'], ['js/site-details.js', 'SMOOVE']]) {
  const ctx = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
    if (!ctx.window[key]) throw new Error('window.' + key + ' is missing');
    console.log('OK  ' + file);
  } catch (e) {
    failed = true;
    console.error('PROBLEM in ' + file + ': ' + e.message);
    console.error('Tip: check for a missing quote mark \' or comma near the line mentioned above.');
  }
}
const m = (() => { const c = { window: {} }; try { vm.runInNewContext(fs.readFileSync('js/menu.js', 'utf8'), c); } catch (e) {} return c.window.SMOOVE_MENU; })();
if (m) for (const part of ['food', 'drinks']) for (const s of m[part] || []) for (const i of s.items || []) {
  if (!i.name) { failed = true; console.error('PROBLEM: an item in "' + s.title + '" has no name'); }
}
process.exit(failed ? 1 : 0);
