#!/usr/bin/env node
// Asset lab: render showcase sheets exported by a lib module, for visual review.
//
//   node src/lab.js <module> <sheet> out.png [--t 1.5] [--frames 8 --dt 0.125] [--size 1280x720]
//
// Each lib module (characters, props, env) exports `lab = { sheetName(ctx, t) { ... } }`
// that draws on a 1280x720 design canvas. With --frames N, renders N frames
// (t, t+dt, ...) into a grid so animation (blinks, talking, flapping) can be checked.
'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const { registerFonts } = require('./lib/fonts');
registerFonts();

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const [modName, sheet, out] = argv;
if (!modName || !sheet || !out) {
  console.log('usage: node src/lab.js <module> <sheet> out.png [--t 0] [--frames N --dt S]');
  process.exit(1);
}
const mod = require(path.join(__dirname, 'lib', modName + '.js'));
if (!mod.lab || !mod.lab[sheet]) {
  console.log(`module ${modName} has no lab sheet "${sheet}". available: ${Object.keys(mod.lab || {}).join(', ')}`);
  process.exit(1);
}
const t0 = +opt('--t', 0);
const frames = +opt('--frames', 1);
const dt = +opt('--dt', 0.125);
const [W, H] = (opt('--size', '1280x720')).split('x').map(Number);

function one(t) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.scale(W / 1280, H / 720);
  ctx.fillStyle = '#5a6b7a';
  ctx.fillRect(0, 0, 1280, 720);
  mod.lab[sheet](ctx, t);
  return c;
}

if (frames <= 1) {
  fs.writeFileSync(out, one(t0).toBuffer('image/png'));
} else {
  const cols = Math.min(4, frames), rows = Math.ceil(frames / cols);
  const tw = 640, th = 360;
  const g = createCanvas(cols * tw, rows * th);
  const gx = g.getContext('2d');
  for (let i = 0; i < frames; i++) {
    const c = one(t0 + i * dt);
    gx.drawImage(c, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
    gx.fillStyle = '#fff';
    gx.font = '600 18px Nunito';
    gx.fillText(`t=${(t0 + i * dt).toFixed(3)}`, (i % cols) * tw + 8, Math.floor(i / cols) * th + 22);
  }
  fs.writeFileSync(out, g.toBuffer('image/png'));
}
console.log('wrote', out);
