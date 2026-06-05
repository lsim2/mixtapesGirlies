// =============================================
// AUDIO — Web Audio API sound effects
// No external files required
// =============================================

const AudioFX = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function resume() {
    const c = getCtx();
    if (c.state === 'suspended') c.resume();
  }

  // Mechanical click — short noise burst
  function click() {
    resume();
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 8);
    }
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.55, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
    src.buffer = buf;
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  // Tape fast-forward — 3 seconds of whirring noise with pitch variation
  function fastForward(onDone) {
    resume();
    click();
    const c = getCtx();
    setTimeout(() => {
      const duration = 2.0;
      const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.08;
      }
      const src = c.createBufferSource();
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.001, c.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, c.currentTime + duration - 0.4);
      gain.gain.linearRampToValueAtTime(0.001, c.currentTime + duration);
      src.buffer = buf;
      src.connect(gain);
      gain.connect(c.destination);
      src.start();
      src.onended = onDone || null;
    }, 100);
    // No return needed — onDone callback handles completion
  }

  // Tape stop — brief deceleration thunk
  function stop() {
    resume();
    const c = getCtx();
    const duration = 0.18;
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / c.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / duration, 3) * 0.5;
    }
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.5, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.buffer = buf;
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  function hiss(duration = 1.5) {
    resume();
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.6, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.6, c.currentTime + duration - 0.4);
    gain.gain.linearRampToValueAtTime(0.001, c.currentTime + duration);
    src.buffer = buf;
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
  }
  
  return { click, fastForward, stop, hiss, resume };

})();