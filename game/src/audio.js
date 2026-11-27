// Synthesised sound for Golden Hour — Valley Run.
// No audio files: every sound is built from oscillators and filtered
// noise at run time, so the game ships no assets and loads nothing.
// The engine drone follows the throttle, the wind follows the speed.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();

      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2 = context.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped noise through a bandpass, loudness follows speed.
      const length = context.sampleRate * 2;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 900;
      windFilter.Q.value = 0.6;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(context.destination);
      windSource.start();

      started = true;
    } catch {
      // No audio on this browser: the game plays silent, never crashes.
      context = null;
    }
  }

  function tone(freq, seconds, type, volume, when = 0) {
    if (!context || muted) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }

  return {
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },
    isMuted() {
      return muted;
    },
    // Called every frame while flying: throttle 0..1, speed in knots.
    update(throttle, speed, flying) {
      if (!context || muted || !started) return;
      const target = flying ? 0.05 + throttle * 0.075 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      const base = 52 + throttle * 68 + speed * 0.05;
      engineOsc.frequency.setTargetAtTime(base, context.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(base * 1.007 + 3, context.currentTime, 0.1);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 900, context.currentTime, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.09, speed * 0.00016) : 0, context.currentTime, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 2.2, context.currentTime, 0.15);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.22);
      tone(1318, 0.5, 'sine', 0.18, 0.07);
    },
    gate() {
      tone(659, 0.25, 'sine', 0.2);
      tone(988, 0.4, 'sine', 0.16, 0.06);
    },
    gear() {
      tone(180, 0.12, 'square', 0.12);
      tone(120, 0.18, 'square', 0.12, 0.1);
    },
    touchdown() {
      if (!context || muted) return;
      const t = context.currentTime;
      const noise = context.createBufferSource();
      const length = context.sampleRate * 0.25;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      noise.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      const gain = context.createGain();
      gain.gain.value = 0.5;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      noise.start(t);
      tone(70, 0.4, 'sine', 0.3);
    },
    crash() {
      if (!context || muted) return;
      const t = context.currentTime;
      const noise = context.createBufferSource();
      const length = context.sampleRate * 0.7;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      noise.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = context.createGain();
      gain.gain.value = 0.6;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      noise.start(t);
      tone(55, 0.8, 'sine', 0.35);
    },
    warning() {
      tone(1046, 0.12, 'square', 0.07);
    },
  };
}
