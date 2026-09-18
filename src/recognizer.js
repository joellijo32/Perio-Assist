// ponytail: two engines behind one start/stop - CDN Vosk global, swap to npm import if bundling matters
// grammar lives in grammar.json (single source - the acoustic harness reads the same file)
import GRAMMAR_WORDS from './grammar.json';

const GRAMMAR = JSON.stringify(GRAMMAR_WORDS);

export function createRecognizer({ onPartial, onFinal, onStatus, onStop }) {
  let web = null;
  let vosk = null; // { rec, stream, node, ctx, active }
  let modelPromise = null;
  let kind = null;
  let webPaused = false;
  let suppressEnd = false;
  let paused = false; // ponytail: stale TTS endings must not resurrect a stopped session

  function startWeb() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onStatus('No voice API: use Chrome/Edge, or type below.');
      return false;
    }
    web = new SR();
    web.lang = 'en-US';
    web.continuous = true;
    web.interimResults = true;
    web.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinal(r[0].transcript);
        else onPartial(r[0].transcript);
      }
    };
    web.onerror = (e) => onStatus(`Mic error: ${e.error}. Check permission + https/localhost + internet.`);
    web.onend = () => {
      if (suppressEnd) return;
      onStop('Stopped (silence/timeout). Click Start again.');
    };
    try {
      web.start();
    } catch (err) {
      onStatus(`Start failed: ${err.message}`);
      return false;
    }
    onStatus('Listening (cloud): speak triplets like "three two three".');
    return true;
  }

  function makeVoskRec(model) {
    try {
      const rec = new model.KaldiRecognizer(16000, GRAMMAR);
      rec.on('result', (m) => m.result.text && onFinal(m.result.text));
      rec.on('partialresult', (m) => m.result.partial && onPartial(m.result.partial));
      return rec;
    } catch {
      return null;
    }
  }

  async function startVosk() {
    const Vosk = globalThis.Vosk;
    if (!Vosk) {
      onStatus('Vosk lib not loaded (need internet once for CDN).');
      return false;
    }
    onStatus('Loading on-device model (/model.tar.gz, ~40MB, first run only)...');
    try {
      modelPromise ??= Vosk.createModel('/model.tar.gz');
      const model = await modelPromise;
      const rec = makeVoskRec(model);
      if (!rec) throw new Error('recognizer init failed');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 },
      });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx({ sampleRate: 16000 });
      if (ctx.state === 'suspended') await ctx.resume();
      const node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => {
        if (!vosk?.active) return;
        try { vosk.rec.acceptWaveform(e.inputBuffer); } catch { /* torn down */ }
      };
      ctx.createMediaStreamSource(stream).connect(node);
      node.connect(ctx.destination);
      vosk = { rec, stream, node, ctx, active: true };
    } catch (err) {
      onStatus(`Vosk failed: ${err.message}.`);
      return false;
    }
    onStatus('Vosk on-device live: speak triplets like "three two three".');
    return true;
  }

  return {
    start(k) {
      kind = k;
      paused = false;
      return k === 'vosk' ? startVosk() : startWeb();
    },
    // ponytail: full teardown around TTS, not muting - while our voice plays no recognizer
    // exists, so nothing can be misrecognized; mic stream and model stay warm for fast resume
    pause() {
      // ponytail: returns whether anything was actually torn down - TTS speaks only on true
      let did = false;
      paused = true;
      if (web) {
        suppressEnd = true;
        try { web.stop(); } catch { /* already stopped */ }
        web = null;
        webPaused = true;
        did = true;
      }
      if (vosk) {
        try { vosk.rec.remove(); } catch { /* noop */ }
        vosk.rec = null;
        vosk.active = false;
        did = true;
      }
      return did;
    },
    async resume() {
      if (!paused) return true;
      paused = false;
      if (webPaused) {
        webPaused = false;
        await new Promise((r) => setTimeout(r, 300)); // ponytail: Chrome needs a beat between stop and start
        suppressEnd = false;
        return startWeb();
      }
      if (vosk) {
        try {
          const model = await modelPromise;
          const rec = makeVoskRec(model);
          if (!rec) throw new Error('recognizer init failed');
          vosk.rec = rec;
          vosk.active = true;
          return true;
        } catch (err) {
          onStatus(`Resume failed: ${err.message}. Press Start.`);
          return false;
        }
      }
      return true;
    },
    stop() {
      paused = false;
      suppressEnd = false;
      webPaused = false;
      try { web?.stop(); } catch { /* already stopped */ }
      web = null;
      if (vosk) {
        try { vosk.node.disconnect(); } catch { /* noop */ }
        vosk.stream.getTracks().forEach((t) => t.stop());
        try { vosk.rec.remove(); } catch { /* noop */ }
        vosk.ctx.close().catch(() => {});
        vosk = null;
      }
    },
  };
}
