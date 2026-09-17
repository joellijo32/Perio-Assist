// ponytail: two engines behind one start/stop - CDN Vosk global, swap to npm import if bundling matters
const GRAMMAR = JSON.stringify([
  'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty',
  'bleeding blood bop repeat jump go next back skip miss missing clear scratch tooth',
  'mb b db ml l dl mesiobuccal buccal distobuccal mesiolingual lingual distolingual mesial distal at on',
  '[unk]',
]);

export function createRecognizer({ onPartial, onFinal, onStatus, onStop }) {
  let web = null;
  let vosk = null; // { rec, stream, node }
  let modelPromise = null;

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
    web.onend = () => onStop('Stopped (silence/timeout). Click Start again.');
    try {
      web.start();
    } catch (err) {
      onStatus(`Start failed: ${err.message}`);
      return false;
    }
    onStatus('Listening (cloud): speak triplets like "three two three".');
    return true;
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
      const rec = new model.KaldiRecognizer(16000, GRAMMAR);
      rec.on('result', (m) => m.result.text && onFinal(m.result.text));
      rec.on('partialresult', (m) => m.result.partial && onPartial(m.result.partial));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 },
      });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx({ sampleRate: 16000 });
      if (ctx.state === 'suspended') await ctx.resume();
      const node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => {
        try { rec.acceptWaveform(e.inputBuffer); } catch { /* torn down */ }
      };
      ctx.createMediaStreamSource(stream).connect(node);
      node.connect(ctx.destination);
      vosk = { rec, stream, node, ctx };
    } catch (err) {
      onStatus(`Vosk failed: ${err.message}.`);
      return false;
    }
    onStatus('Vosk on-device live: speak triplets like "three two three".');
    return true;
  }

  return {
    start(kind) {
      return kind === 'vosk' ? startVosk() : startWeb();
    },
    stop() {
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
