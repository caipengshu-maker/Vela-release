import { BrowserWindow } from "electron";

const RENDERER_BRIDGE_KEY = "__velaWebSpeechBridge";
const VOICE_FALLBACK_PATTERN = /chinese|mandarin|putonghua|cantonese/i;

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numericValue));
}

function serializeForRenderer(value) {
  return JSON.stringify(value);
}

function getActiveWindow() {
  const windows = BrowserWindow.getAllWindows().filter(
    (windowInstance) => !windowInstance.isDestroyed()
  );

  if (windows.length === 0) {
    throw new Error("Web Speech renderer window is not available");
  }

  return windows[0];
}

async function runInRenderer(expression) {
  const windowInstance = getActiveWindow();
  return windowInstance.webContents.executeJavaScript(expression, true);
}

async function ensureRendererBridge() {
  return runInRenderer(`
    (() => {
      const bridgeKey = ${serializeForRenderer(RENDERER_BRIDGE_KEY)};
      const existing = window[bridgeKey];
      if (existing) {
        return true;
      }

      const waitForVoices = () =>
        new Promise((resolve) => {
          const synth = window.speechSynthesis;
          const finish = () => {
            resolve(Array.from(synth?.getVoices?.() || []));
          };

          if (!synth || typeof window.SpeechSynthesisUtterance !== "function") {
            finish();
            return;
          }

          const voices = synth.getVoices();
          if (Array.isArray(voices) && voices.length > 0) {
            finish();
            return;
          }

          let settled = false;
          const handleVoicesChanged = () => {
            if (settled) {
              return;
            }

            settled = true;
            if (typeof synth.removeEventListener === "function") {
              synth.removeEventListener("voiceschanged", handleVoicesChanged);
            }

            if (synth.onvoiceschanged === handleVoicesChanged) {
              synth.onvoiceschanged = null;
            }

            finish();
          };

          if (typeof synth.addEventListener === "function") {
            synth.addEventListener("voiceschanged", handleVoicesChanged, {
              once: true
            });
          } else {
            synth.onvoiceschanged = handleVoicesChanged;
          }

          window.setTimeout(handleVoicesChanged, 1200);
        });

      const resolveVoice = async (voiceId) => {
        const voices = await waitForVoices();
        if (!Array.isArray(voices) || voices.length === 0) {
          return null;
        }

        const requestedVoice = voices.find((voice) => voice.name === voiceId);
        if (requestedVoice) {
          return requestedVoice;
        }

        const chineseVoice =
          voices.find((voice) => /^zh(?:-|$)/i.test(voice.lang || "")) ||
          voices.find((voice) =>
            ${VOICE_FALLBACK_PATTERN.toString()}.test(voice.name || "")
          ) ||
          null;

        return chineseVoice || voices[0] || null;
      };

      window[bridgeKey] = {
        currentUtterance: null,
        waitForVoices,
        resolveVoice
      };

      return true;
    })()
  `);
}

async function speakViaRenderer({ text, voiceId, rate, volume }) {
  return runInRenderer(`
    (async () => {
      const bridgeKey = ${serializeForRenderer(RENDERER_BRIDGE_KEY)};
      const bridge = window[bridgeKey];
      const synth = window.speechSynthesis;
      if (!bridge || !synth || typeof window.SpeechSynthesisUtterance !== "function") {
        throw new Error("Web Speech API is not available in this renderer");
      }

      const voice = await bridge.resolveVoice(${serializeForRenderer(voiceId)});
      const utterance = new window.SpeechSynthesisUtterance(
        ${serializeForRenderer(text)}
      );

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || utterance.lang;
      }

      utterance.rate = ${serializeForRenderer(rate)};
      utterance.volume = ${serializeForRenderer(volume)};

      return await new Promise((resolve, reject) => {
        bridge.currentUtterance = utterance;

        utterance.onend = () => {
          if (bridge.currentUtterance === utterance) {
            bridge.currentUtterance = null;
          }

          resolve({
            cancelled: false,
            voiceName: voice?.name || "",
            voiceLang: voice?.lang || ""
          });
        };

        utterance.onerror = (event) => {
          if (bridge.currentUtterance === utterance) {
            bridge.currentUtterance = null;
          }

          const errorCode = String(event?.error || "").trim().toLowerCase();
          if (
            errorCode === "interrupted" ||
            errorCode === "canceled" ||
            errorCode === "cancelled" ||
            errorCode === "aborted"
          ) {
            resolve({
              cancelled: true,
              error: errorCode
            });
            return;
          }

          reject(
            new Error(errorCode || "Web Speech utterance failed")
          );
        };

        synth.speak(utterance);
      });
    })()
  `);
}

async function cancelRendererSpeech() {
  return runInRenderer(`
    (() => {
      const synth = window.speechSynthesis;
      if (!synth) {
        return false;
      }

      synth.cancel();
      return true;
    })()
  `);
}

class WebSpeechTtsSession {
  constructor({ config, onEvent }) {
    this.config = config;
    this.onEvent = onEvent;
    this.closed = false;
    this.started = false;
    this.cancelled = false;
    this.pendingWork = Promise.resolve();
  }

  emit(event) {
    if (!this.closed || event.type === "done" || event.type === "error") {
      this.onEvent?.(event);
    }
  }

  getVoiceConfig() {
    const voiceSettings = this.config?.tts?.voiceSettings || {};

    return {
      voiceId: String(this.config?.tts?.voiceId || "").trim(),
      rate: clampNumber(voiceSettings.speed, 0.5, 2, 1),
      volume: clampNumber(voiceSettings.volume, 0, 1, 1)
    };
  }

  async start() {
    if (this.started || this.closed) {
      return;
    }

    await ensureRendererBridge();
    this.started = true;
    this.emit({
      type: "status",
      status: "ready"
    });
  }

  async pushText(text, meta = {}) {
    const normalizedText = String(text || "").trim();
    if (!normalizedText || this.closed) {
      return;
    }

    await this.start();

    const task = this.pendingWork.then(async () => {
      if (this.closed || this.cancelled) {
        return;
      }

      this.emit({
        type: "status",
        status: "queued"
      });
      this.emit({
        type: "segment-started",
        text: normalizedText,
        segmentId: meta.segmentId || null
      });
      this.emit({
        type: "status",
        status: "speaking"
      });

      const result = await speakViaRenderer({
        text: normalizedText,
        ...this.getVoiceConfig()
      });

      if (this.closed || this.cancelled || result?.cancelled) {
        return;
      }

      this.emit({
        type: "segment-complete",
        text: normalizedText,
        segmentId: meta.segmentId || null,
        isFinal: true
      });
      this.emit({
        type: "status",
        status: "ready"
      });
    });

    this.pendingWork = task.catch(() => {});
    await task;
  }

  async finish() {
    if (this.closed) {
      return;
    }

    await this.pendingWork;
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.emit({
      type: "done"
    });
  }

  async cancel() {
    if (this.closed) {
      return;
    }

    this.cancelled = true;
    this.closed = true;

    try {
      await cancelRendererSpeech();
    } catch {
      // Best effort. The session still settles locally.
    }

    this.emit({
      type: "done",
      cancelled: true
    });
  }
}

export const webSpeechTtsProvider = {
  id: "webspeech",
  label: "Browser Web Speech",
  defaultApiKeyEnv: "",
  requiresApiKey: false,
  capabilities: {
    streamAudio: false,
    acceptsTextDeltas: true
  },
  createSession({ config, onEvent }) {
    return new WebSpeechTtsSession({
      config,
      onEvent
    });
  }
};
