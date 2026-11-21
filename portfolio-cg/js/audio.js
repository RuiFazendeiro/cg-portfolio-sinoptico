(() => {
  function createAudioEngine(options = {}) {
    let ctx = null;
    let masterGain = null;
    let humGain = null;
    let humOsc50 = null;
    let humOsc100 = null;
    let analyser = null;
    let freqData = null;

    let audioElement = null;
    let mediaSource = null;
    let trackPlaying = false;
    let unlocked = false;

    const fftSize = options.fftSize ?? 256;
    const trackSrc = options.trackSrc ?? "assets/track.ogg";

    function init() {
      if (ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.25;
      masterGain.connect(ctx.destination);

      // Zumbido de transformador (50 Hz + 2.ª harmónica 100 Hz filtrada)
      humGain = ctx.createGain();
      humGain.gain.value = 0.0;

      const humFilter = ctx.createBiquadFilter();
      humFilter.type = "lowpass";
      humFilter.frequency.value = 220;

      humOsc50 = ctx.createOscillator();
      humOsc50.type = "sawtooth";
      humOsc50.frequency.value = 50;

      humOsc100 = ctx.createOscillator();
      humOsc100.type = "sine";
      humOsc100.frequency.value = 100;

      const harmGain = ctx.createGain();
      harmGain.gain.value = 0.25;

      humOsc50.connect(humFilter);
      humOsc100.connect(harmGain);
      harmGain.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(masterGain);

      humOsc50.start();
      humOsc100.start();

      // Analisador FFT para a célula de música
      analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.78;
      freqData = new Uint8Array(analyser.frequencyBinCount);

      audioElement = new Audio();
      audioElement.src = trackSrc;
      audioElement.loop = true;
      audioElement.preload = "none";

      try {
        mediaSource = ctx.createMediaElementSource(audioElement);
        mediaSource.connect(analyser);
        analyser.connect(masterGain);
      } catch (_) {
        // Se o ficheiro de áudio não existir ou falhar CORS/codec, o resto continua funcional
      }
    }

    async function unlock() {
      init();
      if (!ctx) return false;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      unlocked = ctx.state === "running";
      if (unlocked && humGain) {
        humGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.15);
      }
      return unlocked;
    }

    function playBreakerClick(energized) {
      if (!unlocked || !ctx || !masterGain) return;
      const now = ctx.currentTime;

      // Impulso curto de ruído branco filtrado para simular contacto mecânico
      const bufferSize = Math.floor(ctx.sampleRate * 0.035);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = energized ? 1650 : 1100;
      filter.Q.value = 2.4;

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.35, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      noise.connect(filter);
      filter.connect(clickGain);
      clickGain.connect(masterGain);
      noise.start(now);
    }

    function updateProximityHum(distanceToCenter, energizedCount, isTrackActive) {
      if (!unlocked || !ctx || !humGain) return;
      const prox = Math.max(0.15, 1.0 - Math.min(distanceToCenter, 25) / 25);
      const loadFactor = 1.0 + energizedCount * 0.12;
      const targetVol = isTrackActive ? 0.008 : 0.028 * prox * loadFactor;
      humGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.12);
    }

    async function setMusicActive(active) {
      if (!unlocked) {
        await unlock();
      }
      if (!audioElement) return false;

      if (active) {
        try {
          await audioElement.play();
          trackPlaying = true;
        } catch (_) {
          trackPlaying = false;
        }
      } else {
        audioElement.pause();
        trackPlaying = false;
      }
      return trackPlaying;
    }

    function getFrequencyBands() {
      if (!analyser || !freqData || !trackPlaying) {
        return { bass: 0, mid: 0, treble: 0, bins: null };
      }
      analyser.getByteFrequencyData(freqData);
      const len = freqData.length;

      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;

      const bassEnd = Math.max(1, Math.floor(len * 0.15));
      const midEnd = Math.max(bassEnd + 1, Math.floor(len * 0.55));

      for (let i = 0; i < bassEnd; i++) bassSum += freqData[i];
      for (let i = bassEnd; i < midEnd; i++) midSum += freqData[i];
      for (let i = midEnd; i < len; i++) trebleSum += freqData[i];

      return {
        bass: bassSum / (bassEnd * 255),
        mid: midSum / ((midEnd - bassEnd) * 255),
        treble: trebleSum / (Math.max(1, len - midEnd) * 255),
        bins: freqData
      };
    }

    return {
      unlock,
      playBreakerClick,
      updateProximityHum,
      setMusicActive,
      getFrequencyBands,
      isUnlocked: () => unlocked,
      isTrackPlaying: () => trackPlaying,
      getFftSize: () => fftSize
    };
  }

  window.PortfolioAudio = {
    createAudioEngine
  };
})();