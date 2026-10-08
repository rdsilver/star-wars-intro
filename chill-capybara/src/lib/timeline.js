// Timeline + per-scene time helpers (see DESIGN.md §3/§4).
'use strict';
const fs = require('fs');
const path = require('path');
const { clamp, rng } = require('./util');

class Timeline {
  constructor(file) {
    file = file || path.join(__dirname, '..', '..', 'build', 'timeline.json');
    const tl = JSON.parse(fs.readFileSync(file, 'utf8'));
    Object.assign(this, tl);
    this.byScene = {};
    for (const s of this.scenes) this.byScene[s.id] = s;
  }
  sceneAt(T) {
    for (const s of this.scenes) if (T >= s.start && T < s.end) return s;
    return this.scenes[this.scenes.length - 1];
  }
  sceneTime(sceneId, T) {
    return new SceneTime(this, this.byScene[sceneId], T);
  }
  // Lines whose time range covers T (for subtitles).
  linesAt(T) {
    return this.lines.filter((l) => T >= l.start && T < l.end);
  }
}

class SceneTime {
  constructor(tl, scene, T) {
    if (!scene) throw new Error('unknown scene');
    this.tl = tl;
    this.scene = scene;
    this.T = T;
    this.t = T - scene.start;
    this.duration = scene.end - scene.start;
    this.id = scene.id;
    this._cues = {};
    for (const c of tl.cues) if (c.scene === scene.id) this._cues[c.name] = c;
    this._lines = tl.lines.filter((l) => l.scene === scene.id);
    this._cams = tl.cams.filter((c) => c.scene === scene.id);
  }
  has(name) { return name in this._cues; }
  cue(name) {
    const c = this._cues[name];
    if (!c) throw new Error(`scene ${this.id}: no cue/beat named "${name}" (have: ${Object.keys(this._cues).join(', ')})`);
    return c.time - this.scene.start;
  }
  cueDur(name) { this.cue(name); return this._cues[name].dur; }
  since(name) { return this.t - this.cue(name); }
  prog(name, dur) {
    const d = dur != null ? dur : this.cueDur(name) || 1;
    return clamp((this.t - this.cue(name)) / d);
  }
  // all lines of this scene (scene-local times added as ls/le)
  lines(char) {
    return this._lines
      .filter((l) => !char || l.char === char)
      .map((l) => ({ ...l, ls: l.start - this.scene.start, le: l.end - this.scene.start }));
  }
  line(char) {
    const T = this.T;
    return this._lines.find((l) => l.char === char && T >= l.start && T < l.end) || null;
  }
  lastLine(char) {
    let best = null;
    for (const l of this._lines) if ((!char || l.char === char) && l.start <= this.T) best = l;
    return best;
  }
  // nth line of the scene by this char (0-based), with scene-local ls/le
  nthLine(char, n) { return this.lines(char)[n] || null; }
  speaking(char) { return !!this.line(char); }
  talk(char) {
    const l = this.line(char);
    if (!l) return 0;
    const i = Math.floor((this.T - l.start) * this.tl.fps);
    const e = l.env;
    if (!e || !e.length) return 0;
    const a = e[Math.min(e.length - 1, Math.max(0, i))];
    const b = e[Math.min(e.length - 1, Math.max(0, i + 1))];
    const f = (this.T - l.start) * this.tl.fps - i;
    return a + (b - a) * f;
  }
  // who is speaking right now (first match), or null
  speaker() {
    const l = this._lines.find((x) => this.T >= x.start && this.T < x.end);
    return l ? l.char : null;
  }
  cam() {
    let name = null;
    for (const c of this._cams) if (c.time <= this.T + 1e-6) name = c.name;
    return name || (this._cams[0] && this._cams[0].name) || 'default';
  }
  camTime() {
    let tm = this.scene.start;
    for (const c of this._cams) if (c.time <= this.T + 1e-6) tm = c.time;
    return this.T - tm;
  }
  // scene-local start time of the k-th occurrence of a camera name
  camStart(name, k = 0) {
    const c = this._cams.filter((x) => x.name === name)[k];
    return c ? c.time - this.scene.start : null;
  }
  rng(seed) { return rng(seed); }
}

module.exports = { Timeline, SceneTime };
