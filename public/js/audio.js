// 零外部音频依赖 Web Audio API 程序化音效合成器（还原饥荒打击、采集与恐怖氛围音效）

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, endFreq, duration = 0.14, type = 'triangle', gainVal = 0.16) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playNoise(duration = 0.12, filterFreq = 900, gainVal = 0.14) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
  }

  play(kind) {
    if (this.muted) return;
    switch (kind) {
      case 'chop':
        this.playTone(170, 68, 0.11, 'triangle', 0.22);
        this.playNoise(0.07, 650, 0.14);
        break;
      case 'mine':
        this.playTone(1150, 520, 0.13, 'sine', 0.18);
        this.playTone(1780, 960, 0.09, 'triangle', 0.12);
        break;
      case 'dig':
      case 'rustle':
        this.playNoise(0.11, 1400, 0.12);
        break;
      case 'pickup':
        this.playTone(420, 680, 0.09, 'sine', 0.14);
        break;
      case 'eat':
        this.playNoise(0.09, 800, 0.14);
        setTimeout(() => this.playTone(260, 320, 0.08, 'triangle', 0.12), 75);
        break;
      case 'sizzle':
        this.playNoise(0.22, 2600, 0.13);
        break;
      case 'cook_done':
      case 'gold_toss':
        this.playTone(523, 659, 0.12, 'triangle', 0.16);
        setTimeout(() => this.playTone(659, 880, 0.18, 'triangle', 0.16), 95);
        break;
      case 'craft':
      case 'build':
        this.playTone(330, 495, 0.13, 'triangle', 0.16);
        this.playNoise(0.08, 1100, 0.1);
        break;
      case 'hit':
        this.playTone(190, 75, 0.12, 'sawtooth', 0.16);
        this.playNoise(0.08, 700, 0.15);
        break;
      case 'player_hit':
        this.playTone(150, 55, 0.22, 'sawtooth', 0.22);
        break;
      case 'charlie_warn':
        this.playNoise(0.45, 420, 0.18);
        this.playTone(195, 130, 0.45, 'sine', 0.14);
        break;
      case 'charlie_hit':
        this.playNoise(0.32, 1200, 0.28);
        this.playTone(280, 48, 0.35, 'sawtooth', 0.28);
        break;
      case 'hound_warn':
      case 'hound_attack':
        this.playTone(160, 260, 0.28, 'sawtooth', 0.18);
        setTimeout(() => this.playTone(240, 110, 0.35, 'sawtooth', 0.18), 180);
        break;
      case 'boss_roar':
      case 'ice_slam':
        this.playTone(95, 38, 0.55, 'sawtooth', 0.26);
        this.playNoise(0.42, 350, 0.22);
        break;
      case 'revive':
        this.playTone(392, 784, 0.35, 'triangle', 0.2);
        setTimeout(() => this.playTone(587, 1046, 0.4, 'sine', 0.18), 120);
        break;
      default:
        break;
    }
  }
}

export const sound = new SoundEngine();
