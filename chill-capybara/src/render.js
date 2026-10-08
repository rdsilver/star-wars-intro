#!/usr/bin/env node
// CHILL CAPYBARA renderer harness. See DESIGN.md §1/§4.
//
//   node src/render.js --still 12.5 out.png [--size 1280x720] [--nosubs]
//   node src/render.js --stills 1,5.5,9 out.png        (grid of several times)
//   node src/render.js --sheet s03_spring out.png [--n 20] (contact sheet of a scene)
//   node src/render.js --range 40 52 out.mp4 [--size 640x360]  (preview with audio)
//   node src/render.js --scene s03_spring out.mp4       (preview one scene with audio)
//   node src/render.js --final [--out build/chill_capybara.mp4] [--workers 4] [--size 1920x1080]
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createCanvas } = require('@napi-rs/canvas');
const { registerFonts } = require('./lib/fonts');
const { Timeline } = require('./lib/timeline');
const U = require('./lib/util');

registerFonts();
const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const DW = 1280, DH = 720;

// ------------------------------------------------------------------ args
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const parseSize = (s, def) => { const m = /^(\d+)x(\d+)$/.exec(s || ''); return m ? [+m[1], +m[2]] : def; };

const TIMELINE = opt('--timeline', path.join(BUILD, 'timeline.json'));
const tl = new Timeline(TIMELINE);
const FPS = tl.fps;
const SUBS = !flag('--nosubs');

// ------------------------------------------------------------------ scenes
const sceneCache = {};
function sceneModule(id) {
  if (id in sceneCache) return sceneCache[id];
  const p = path.join(process.env.SCENES_DIR || path.join(__dirname, 'scenes'), id + '.js');
  let mod = null;
  if (fs.existsSync(p)) mod = require(p);
  sceneCache[id] = mod;
  return mod;
}

function placeholder(ctx, S) {
  ctx.fillStyle = '#26303a';
  ctx.fillRect(0, 0, DW, DH);
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '600 44px Fredoka';
  ctx.textAlign = 'center';
  ctx.fillText(`[${S.id}]  cam: ${S.cam()}`, DW / 2, 200);
  ctx.font = '400 26px Fredoka';
  const cues = S.tl.cues.filter((c) => c.scene === S.id && S.T >= c.time - 0.01 && S.T <= c.time + Math.max(c.dur, 0.6));
  cues.forEach((c, i) => ctx.fillText(`${c.name}: ${c.desc}`.slice(0, 90), DW / 2, 270 + i * 34));
  ctx.textAlign = 'left';
}

function drawScene(ctx, scene, T) {
  const S = tl.sceneTime(scene.id, T);
  const mod = sceneModule(scene.id);
  ctx.save();
  try {
    if (mod && mod.render) mod.render(ctx, S.t, S);
    else placeholder(ctx, S);
  } catch (e) {
    ctx.restore();
    ctx.save();
    placeholder(ctx, S);
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '400 18px Nunito';
    String(e.stack || e).split('\n').slice(0, 6).forEach((l, i) => ctx.fillText(l.slice(0, 120), 30, 450 + i * 22));
    if (process.env.STRICT) throw e;
  }
  ctx.restore();
}

// ------------------------------------------------------------------ transitions
const TRANS = 0.5; // seconds
function renderDesign(ctx, T) {
  const scene = tl.sceneAt(T);
  const idx = tl.scenes.indexOf(scene);
  const prev = idx > 0 ? tl.scenes[idx - 1] : null;
  const next = idx + 1 < tl.scenes.length ? tl.scenes[idx + 1] : null;
  const tIn = T - scene.start;
  const tOut = scene.end - T;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, DW, DH);

  if (scene.transition === 'wipe' && prev && tIn < TRANS) {
    // previous scene (held at its last moment) gets pushed off by a soft-edged wipe
    const k = U.ease.inOutCubic(tIn / TRANS);
    const edge = k * (DW + 200) - 100;
    drawScene(ctx, prev, prev.end - 1 / FPS);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-10, -10, edge + 10, DH + 20);
    ctx.clip();
    drawScene(ctx, scene, T);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.fillRect(edge - 6, 0, 12, DH);
  } else {
    drawScene(ctx, scene, T);
  }

  // fades: a scene with transition 'fade' fades in from black, and the scene before it fades out
  let black = 0;
  if (scene.transition === 'fade' && tIn < TRANS) black = Math.max(black, 1 - tIn / TRANS);
  if (next && next.transition === 'fade' && tOut < TRANS) black = Math.max(black, 1 - tOut / TRANS);
  if (idx === 0 && tIn < 0.8) black = Math.max(black, 1 - tIn / 0.8);
  if (!next && tOut < 1.0) black = Math.max(black, 1 - tOut / 1.0);
  if (scene.transition === 'iris' && tIn < TRANS * 1.6) {
    const k = U.ease.inOutCubic(tIn / (TRANS * 1.6));
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.rect(0, 0, DW, DH);
    ctx.arc(DW / 2, DH / 2, k * 800 + 1, 0, U.TAU, true);
    ctx.fill('evenodd');
    ctx.restore();
  }
  if (black > 0) {
    ctx.fillStyle = `rgba(0,0,0,${U.clamp(black)})`;
    ctx.fillRect(0, 0, DW, DH);
  }

  // gentle vignette for a filmic look
  if (scene.setting !== 'title') {
    const g = ctx.createRadialGradient(DW / 2, DH / 2, DH * 0.45, DW / 2, DH / 2, DH * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,10,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, DW, DH);
  }

  if (SUBS) drawSubtitles(ctx, T);
}

// ------------------------------------------------------------------ subtitles
function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawSubtitles(ctx, T) {
  const active = tl.linesAt(T);
  if (!active.length) return;
  ctx.save();
  ctx.font = '800 27px Nunito';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const LH = 34;
  let y = DH - 34;
  // newest line at the bottom
  const blocks = active.slice().sort((a, b) => b.start - a.start).map((l) => {
    const wrapped = wrap(ctx, l.text, 980);
    // long lines: show the portion being spoken now (2 rows at a time)
    let rows = wrapped;
    if (wrapped.length > 2) {
      const k = U.clamp((T - l.start) / Math.max(0.01, l.end - l.start));
      const pages = Math.ceil(wrapped.length / 2);
      const p = Math.min(pages - 1, Math.floor(k * pages));
      rows = wrapped.slice(p * 2, p * 2 + 2);
    }
    return { l, rows };
  });
  for (const { l, rows } of blocks) {
    const color = (tl.cast[l.char] && tl.cast[l.char].color) || '#fff';
    const a = U.clamp(Math.min((T - l.start) / 0.12, (l.end - T) / 0.12 + 0.3));
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const w = ctx.measureText(row).width;
      ctx.fillStyle = `rgba(10,8,14,${0.55 * a})`;
      U.roundRect(ctx, DW / 2 - w / 2 - 14, y - 26, w + 28, LH, 10);
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = `rgba(0,0,0,${0.8 * a})`;
      ctx.strokeText(row, DW / 2, y);
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.fillText(row, DW / 2, y);
      ctx.globalAlpha = 1;
      y -= LH + 2;
    }
    y -= 8;
  }
  ctx.restore();
}

// ------------------------------------------------------------------ frame → buffer
function makeRenderer(W, H) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  return {
    canvas, ctx,
    frame(T) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(W / DW, H / DH);
      renderDesign(ctx, T);
      return canvas;
    },
  };
}

function ffmpegWriter(out, W, H, { audio = null, aStart = 0, aDur = null, crf = 18, preset = 'medium', threads = 0 } = {}) {
  const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-'];
  if (audio) {
    args.push('-ss', String(aStart));
    if (aDur) args.push('-t', String(aDur));
    args.push('-i', audio);
  }
  args.push('-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-tune', 'animation');
  if (threads) args.push('-threads', String(threads));
  if (audio) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-movflags', '+faststart', out);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return {
    async write(buf) {
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    },
    async end() { ff.stdin.end(); await done; },
  };
}

async function renderVideo(out, T0, T1, W, H, withAudio, extra = {}) {
  const r = makeRenderer(W, H);
  const audio = withAudio && fs.existsSync(path.join(BUILD, 'audio.wav')) ? path.join(BUILD, 'audio.wav') : null;
  const f0 = Math.round(T0 * FPS), f1 = Math.round(T1 * FPS);
  const wr = ffmpegWriter(out, W, H, { audio, aStart: f0 / FPS, aDur: (f1 - f0) / FPS, ...extra });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    r.frame(f / FPS);
    await wr.write(r.canvas.data());
    if (!extra.quiet && (f - f0) % (FPS * 10) === 0) {
      const el = (Date.now() - t0) / 1000;
      process.stderr.write(`  frame ${f - f0}/${f1 - f0}  ${(el / Math.max(1, f - f0) * 1000).toFixed(0)} ms/f\n`);
    }
  }
  await wr.end();
}

// ------------------------------------------------------------------ sheets
function sheetTimes(sceneId, n) {
  const sc = tl.byScene[sceneId];
  if (!sc) throw new Error('no scene ' + sceneId);
  const times = new Set();
  for (const c of tl.cams) if (c.scene === sceneId) times.add(+(c.time + 0.4).toFixed(2));
  for (const c of tl.cues) if (c.scene === sceneId) { times.add(+(c.time + Math.max(0.05, c.dur * 0.5)).toFixed(2)); if (c.dur > 1) times.add(+(c.time + c.dur * 0.9).toFixed(2)); }
  for (const l of tl.lines) if (l.scene === sceneId) times.add(+((l.start + l.end) / 2).toFixed(2));
  let arr = [...times].filter((t) => t >= sc.start && t < sc.end).sort((a, b) => a - b);
  if (arr.length > n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
    arr = out;
  }
  return arr;
}

function gridPng(out, times, cols = 4, tw = 480, th = 270) {
  const rows = Math.ceil(times.length / cols);
  const LBL = 22;
  const sheet = createCanvas(cols * tw, rows * (th + LBL));
  const sx = sheet.getContext('2d');
  sx.fillStyle = '#111';
  sx.fillRect(0, 0, sheet.width, sheet.height);
  const r = makeRenderer(tw, th);
  times.forEach((T, i) => {
    r.frame(T);
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + LBL);
    sx.drawImage(r.canvas, x, y + LBL);
    const sc = tl.sceneAt(T);
    const S = tl.sceneTime(sc.id, T);
    sx.fillStyle = '#ddd';
    sx.font = '600 14px Nunito';
    sx.fillText(`${T.toFixed(2)}s  ${sc.id} +${S.t.toFixed(2)}  cam:${S.cam()}`, x + 6, y + 16);
  });
  fs.writeFileSync(out, sheet.toBuffer('image/png'));
}

// ------------------------------------------------------------------ main
async function main() {
  if (flag('--still')) {
    const T = parseFloat(opt('--still'));
    const out = argv[argv.indexOf('--still') + 2];
    const [W, H] = parseSize(opt('--size'), [DW, DH]);
    const r = makeRenderer(W, H);
    r.frame(T);
    fs.writeFileSync(out, r.canvas.toBuffer('image/png'));
    console.log('wrote', out);
  } else if (flag('--stills')) {
    const times = opt('--stills').split(',').map(Number);
    const out = argv[argv.indexOf('--stills') + 2];
    gridPng(out, times, +opt('--cols', Math.min(4, times.length)));
    console.log('wrote', out);
  } else if (flag('--sheet')) {
    const id = opt('--sheet');
    const out = argv[argv.indexOf('--sheet') + 2];
    gridPng(out, sheetTimes(id, +opt('--n', 20)), +opt('--cols', 4));
    console.log('wrote', out);
  } else if (flag('--range') || flag('--scene')) {
    let T0, T1, out;
    if (flag('--range')) {
      const i = argv.indexOf('--range');
      T0 = parseFloat(argv[i + 1]); T1 = parseFloat(argv[i + 2]); out = argv[i + 3];
    } else {
      const i = argv.indexOf('--scene');
      const sc = tl.byScene[argv[i + 1]];
      T0 = sc.start; T1 = sc.end; out = argv[i + 2];
    }
    const [W, H] = parseSize(opt('--size'), [640, 360]);
    await renderVideo(out, T0, T1, W, H, !flag('--noaudio'), { preset: 'veryfast', crf: 23 });
    console.log('wrote', out);
  } else if (flag('--segment')) {
    // internal: worker for --final
    const i = argv.indexOf('--segment');
    const f0 = +argv[i + 1], f1 = +argv[i + 2], out = argv[i + 3];
    const [W, H] = parseSize(opt('--size'), [1920, 1080]);
    await renderVideo(out, f0 / FPS, f1 / FPS, W, H, false, { crf: +opt('--crf', 18), preset: opt('--preset', 'medium'), threads: 2, quiet: !flag('--verbose') });
  } else if (flag('--final')) {
    const out = path.resolve(opt('--out', path.join(BUILD, 'chill_capybara.mp4')));
    const [W, H] = parseSize(opt('--size'), [1920, 1080]);
    const workers = +opt('--workers', 4);
    const total = Math.round(tl.duration * FPS);
    const segDir = path.join(BUILD, 'segments');
    fs.mkdirSync(segDir, { recursive: true });
    const per = Math.ceil(total / workers);
    const t0 = Date.now();
    const jobs = [];
    const files = [];
    for (let k = 0; k < workers; k++) {
      const f0 = k * per, f1 = Math.min(total, (k + 1) * per);
      if (f1 <= f0) continue;
      const f = path.join(segDir, `seg_${k}.mp4`);
      files.push(f);
      const args = [__filename, '--segment', String(f0), String(f1), f, '--size', `${W}x${H}`, '--timeline', TIMELINE, '--crf', opt('--crf', '18'), '--preset', opt('--preset', 'medium')];
      if (!SUBS) args.push('--nosubs');
      if (k === 0) args.push('--verbose');
      jobs.push(new Promise((res, rej) => {
        const p = spawn(process.execPath, args, { stdio: 'inherit' });
        p.on('close', (c) => (c === 0 ? res() : rej(new Error(`segment ${k} failed`))));
      }));
    }
    await Promise.all(jobs);
    const list = path.join(segDir, 'list.txt');
    fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
    const audio = path.join(BUILD, 'audio.wav');
    const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
    if (fs.existsSync(audio)) args.push('-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest');
    args.push('-c:v', 'copy', '-movflags', '+faststart', out);
    await new Promise((res, rej) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed')))));
    console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } else {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 10).join('\n'));
  }
}

module.exports = { renderDesign, makeRenderer };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
