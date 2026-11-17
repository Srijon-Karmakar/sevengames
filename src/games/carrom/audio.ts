/* Carrom sounds, synthesised with Web Audio (no files to download).

   Built to sound like a real wooden board rather than generic beeps:
   - every impact is a short noise transient + a few inharmonic wooden "modes" (damped sines),
     plus a low thump from the board itself resonating underneath
   - discs slide on powder: a continuous soft hiss that follows how fast things are moving
   - the pocket: tick on the brass rim, "tok" on the wooden jaw, a muffled drop into the net,
     then a tiny clack as it lands on the coins already in there
   - sounds are panned by where they happen on the board and sent through a small room reverb
   Volume follows impact strength; bursts are rate-limited so a big break never gets harsh. */

const MUTE_KEY = "senevon:carrom-mute";

type Mode = [freq: number, decay: number, amp: number];

class CarromAudio {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private slideGain: GainNode | null = null;
  private slideFilter: BiquadFilterNode | null = null;
  private recent: number[] = [];
  muted = (() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  })();

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = new AC();
    this.ctx = c;

    // master -> gentle compressor -> speakers
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    comp.connect(c.destination);
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(comp);

    // white noise, shared by every voice
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // small wooden room: a short, dark, decaying stereo impulse
    const irLen = Math.floor(c.sampleRate * 0.55);
    const ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const o = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < irLen; i++) {
        const t = i / c.sampleRate;
        lp += ((Math.random() * 2 - 1) - lp) * 0.35; // one-pole low-pass = darker tail
        o[i] = lp * Math.exp(-t * 9) * (t < 0.004 ? t / 0.004 : 1);
      }
    }
    const verb = c.createConvolver();
    verb.buffer = ir;
    this.wet = c.createGain();
    this.wet.gain.value = 0.22;
    this.wet.connect(verb).connect(this.master);

    // continuous powder slide: looped noise through a soft band-pass, silent until things move
    const slide = c.createBufferSource();
    slide.buffer = this.noise;
    slide.loop = true;
    this.slideFilter = c.createBiquadFilter();
    this.slideFilter.type = "bandpass";
    this.slideFilter.frequency.value = 1100;
    this.slideFilter.Q.value = 0.6;
    const soften = c.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 3200;
    this.slideGain = c.createGain();
    this.slideGain.gain.value = 0;
    slide.connect(this.slideFilter).connect(soften).connect(this.slideGain).connect(this.master);
    slide.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  private ready() {
    return !this.muted && !!this.ctx && !!this.master && this.ctx.state === "running";
  }

  /** Rate limiter for impact bursts. */
  private ok() {
    if (!this.ready()) return false;
    const now = performance.now();
    this.recent = this.recent.filter((t) => now - t < 90);
    if (this.recent.length > 9) return false;
    this.recent.push(now);
    return true;
  }

  /** Output for one sound: panned by board x (0..1000), with a send to the room reverb. */
  private out(x = 500, dry = 1, send = 1): AudioNode {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.value = dry;
    let node: AudioNode = g;
    if (typeof c.createStereoPanner === "function") {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-0.7, Math.min(0.7, (x / 1000) * 2 - 1)) * 0.8;
      g.connect(p);
      node = p;
    }
    node.connect(this.master!);
    const s = c.createGain();
    s.gain.value = send;
    node.connect(s).connect(this.wet!);
    return g;
  }

  /** Filtered noise burst starting `at` seconds from now. */
  private burst(dest: AudioNode, at: number, type: BiquadFilterType, freq: number, q: number, dur: number, vol: number, attack = 0.001) {
    const c = this.ctx!;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.6, attack + dur + 0.03);
  }

  /** A set of damped sine modes (the ringing of hard wood), with an optional pitch sag. */
  private modes(dest: AudioNode, at: number, list: Mode[], vol: number, sag = 0.97) {
    const c = this.ctx!;
    const t = c.currentTime + at;
    for (const [freq, decay, amp] of list) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * sag, t + decay);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * amp), t + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + decay + 0.03);
    }
  }

  /** Coin / striker collision. */
  hit(strength: number, striker: boolean, x = 500) {
    if (!this.ok()) return;
    const v = Math.min(1, strength / 1500);
    const vol = 0.06 + Math.pow(v, 0.75) * 0.7;
    const base = (striker ? 1180 : 1850) * (0.94 + Math.random() * 0.12);
    const life = striker ? 1.35 : 1;
    const o = this.out(x, 1, 0.8);
    // sharp click of the contact
    this.burst(o, 0, "highpass", 3600, 0.7, 0.012, vol * 0.55);
    // the discs ringing (inharmonic, like real wood)
    this.modes(
      o,
      0,
      [
        [base, 0.055 * life, 1],
        [base * 1.53, 0.04 * life, 0.55],
        [base * 2.31, 0.028 * life, 0.32],
        [base * 3.07, 0.018 * life, 0.16],
      ],
      vol * 0.5,
    );
    // the board underneath answering
    this.modes(o, 0.002, [[165 + Math.random() * 25, 0.1, 1]], vol * (striker ? 0.32 : 0.18), 0.9);
  }

  /** Disc into the rubber-lined frame. */
  wall(strength: number, x = 500) {
    if (!this.ok()) return;
    const v = Math.min(1, strength / 1600);
    const vol = 0.07 + Math.pow(v, 0.8) * 0.65;
    const o = this.out(x, 1, 1);
    this.burst(o, 0, "lowpass", 420, 0.8, 0.09, vol * 0.7, 0.003);
    this.modes(o, 0, [[104, 0.13, 1]], vol * 0.55, 0.7);
    this.modes(o, 0.001, [[540, 0.05, 1], [870, 0.03, 0.4]], vol * 0.2);
  }

  /** Disc into a pocket: rim, jaw, drop into the net, landing on the coins inside. */
  pot(kind: string, speed: number, x = 500) {
    if (!this.ok()) return;
    const v = Math.min(1, speed / 1400);
    const o = this.out(x, 1, 1.2);
    if (speed > 250) this.modes(o, 0, [[2450, 0.02, 1], [3600, 0.014, 0.5]], 0.08 + v * 0.18);
    // wooden jaw of the pocket
    this.modes(o, 0.05, [[640, 0.065, 1], [310, 0.1, 0.8]], 0.3 + v * 0.25, 0.9);
    this.burst(o, 0.05, "bandpass", 900, 1.4, 0.04, 0.18 + v * 0.15);
    // muffled fall into the net (cloth + a low thud)
    this.burst(o, 0.17, "lowpass", 650, 0.7, 0.22, 0.32, 0.01);
    this.modes(o, 0.18, [[138, 0.15, 1]], 0.38, 0.7);
    // tiny clack landing on the coins already in the pocket
    this.modes(o, 0.33, [[1900, 0.025, 1], [2950, 0.018, 0.5]], 0.09);
    this.modes(o, 0.39, [[2300, 0.02, 1]], 0.05);
    if (kind === "queen") {
      // a bright chime so the queen feels special
      this.modes(this.out(x, 0.7, 1.6), 0.08, [[1318, 0.6, 1], [1975, 0.45, 0.5], [2637, 0.3, 0.25]], 0.12, 1);
    }
  }

  /** Fast coin clipping the pocket jaw and bouncing back out. */
  rattle(x = 500) {
    if (!this.ok()) return;
    const o = this.out(x, 1, 1);
    this.modes(o, 0, [[1420, 0.03, 1], [2130, 0.02, 0.5]], 0.4);
    this.modes(o, 0.045, [[1580, 0.028, 1]], 0.28);
    this.modes(o, 0.085, [[1490, 0.022, 1]], 0.14);
  }

  /** The finger flicking the striker. */
  flick(power: number, x = 500) {
    if (!this.ok()) return;
    const o = this.out(x, 1, 0.6);
    this.burst(o, 0, "bandpass", 3200, 1, 0.009, 0.25 + power * 0.4);
    this.modes(o, 0, [[270, 0.04, 1], [520, 0.025, 0.4]], 0.22 + power * 0.4, 0.75);
  }

  /** Striker nudged along the baseline (slider). */
  scrape(x = 500) {
    if (!this.ok()) return;
    this.burst(this.out(x, 1, 0.3), 0, "bandpass", 1500, 0.9, 0.05, 0.05, 0.01);
  }

  /** Clock tick for the last seconds of a turn. */
  tick(urgent: boolean) {
    if (!this.ready()) return;
    const o = this.out(500, 1, 0.4);
    this.modes(o, 0, [[urgent ? 3100 : 2500, 0.018, 1], [urgent ? 4650 : 3800, 0.01, 0.4]], urgent ? 0.2 : 0.12, 1);
  }

  /** Time ran out: two low wooden knocks. */
  timeout() {
    if (!this.ready()) return;
    const o = this.out(500, 1, 0.8);
    this.modes(o, 0, [[330, 0.12, 1], [660, 0.05, 0.3]], 0.35, 0.95);
    this.modes(o, 0.16, [[220, 0.18, 1], [440, 0.06, 0.3]], 0.35, 0.95);
  }

  /** Your turn starts: a soft two-note wooden cue. */
  turn() {
    if (!this.ready()) return;
    const o = this.out(500, 0.8, 0.8);
    this.modes(o, 0, [[784, 0.12, 1]], 0.09, 1);
    this.modes(o, 0.09, [[1175, 0.16, 1]], 0.08, 1);
  }

  /** Continuous slide hiss, driven every frame by the summed speed of moving discs (0 = silent). */
  slide(totalSpeed: number) {
    if (!this.ctx || !this.slideGain || !this.slideFilter) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, totalSpeed / 2600);
    const g = this.muted ? 0 : 0.11 * Math.pow(k, 0.8);
    this.slideGain.gain.setTargetAtTime(g, t, 0.06);
    this.slideFilter.frequency.setTargetAtTime(700 + k * 1300, t, 0.08);
  }
}

export const carromAudio = new CarromAudio();
