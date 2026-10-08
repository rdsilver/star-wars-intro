// Registers the film's fonts with @napi-rs/canvas.
'use strict';
const path = require('path');
const { GlobalFonts } = require('@napi-rs/canvas');

const FS = path.join(__dirname, '..', 'node_modules', '@fontsource');
let done = false;
function registerFonts() {
  if (done) return;
  done = true;
  const reg = (pkg, file, family) => GlobalFonts.registerFromPath(path.join(FS, pkg, 'files', file), family);
  for (const w of [400, 500, 600, 700]) reg('fredoka', `fredoka-latin-${w}-normal.woff2`, 'Fredoka');
  reg('shrikhand', 'shrikhand-latin-400-normal.woff2', 'Shrikhand');
  reg('yeseva-one', 'yeseva-one-latin-400-normal.woff2', 'Yeseva');
  for (const w of [400, 600, 700, 800, 900]) {
    try { reg('nunito', `nunito-latin-${w}-normal.woff2`, 'Nunito'); } catch (e) { /* optional weight */ }
  }
  try { reg('nunito', 'nunito-latin-700-italic.woff2', 'Nunito'); } catch (e) { /* optional */ }
}
module.exports = { registerFonts };
