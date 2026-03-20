function decodeBase64ToArrayBuffer(input) {
  const normalized = String(input || "")
    .trim()
    .replace(/^data:audio\/[^;]+;base64,/, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  if (!normalized) {
    return null;
  }

  const padLength = (4 - (normalized.length % 4)) % 4;
  const binary = window.atob(`${normalized}${"=".repeat(padLength)}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function decodeHexToArrayBuffer(input) {
  const normalized = String(input || "").replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  const byteLength = Math.floor(normalized.length / 2);
  const bytes = new Uint8Array(byteLength);

  for (let index = 0; index < byteLength; index += 1) {
    bytes[index] = Number.parseInt(
      normalized.slice(index * 2, index * 2 + 2),
      16
    );
  }

  return bytes.buffer;
}

function resolveChunkBuffer(chunk) {
  if (!chunk) {
    return null;
  }

  if (chunk.base64) {
    return decodeBase64ToArrayBuffer(chunk.base64);
  }

  if (chunk.audioBase64) {
    return decodeBase64ToArrayBuffer(chunk.audioBase64);
  }

  if (chunk.audio) {
    return decodeBase64ToArrayBuffer(chunk.audio);
  }

  if (chunk.hex) {
    return decodeHexToArrayBuffer(chunk.hex);
  }

  return null;
}

function getAudioContextCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.AudioContext || window.webkitAudioContext || null;
}

export class AudioPlayerService {
  constructor({ lookAheadSeconds = 0.02 } = {}) {
    this.lookAheadSeconds = lookAheadSeconds;
    this.audioContext = null;
    this.activeSources = new Set();
    this.decodeChain = Promise.resolve();
    this.playhead = 0;
    this.sessionId = null;
    this.playbackToken = 0;
  }

  ensureContext() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) {
      return null;
    }

    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  async ensureContextReady() {
    const context = this.ensureContext();
    if (!context) {
      return null;
    }

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        // Ignore autoplay-like resume failures in background states.
      }
    }

    return context;
  }

  beginSession(sessionId) {
    const nextSessionId = String(sessionId || "vela-tts").trim() || "vela-tts";
    if (this.sessionId === nextSessionId) {
      return;
    }

    this.reset();
    this.sessionId = nextSessionId;
  }

  appendChunk(chunk) {
    const audioBuffer = resolveChunkBuffer(chunk);
    if (!audioBuffer) {
      return;
    }

    this.beginSession(chunk?.sessionId);
    const tokenAtSchedule = this.playbackToken;

    this.decodeChain = this.decodeChain
      .then(async () => {
        if (tokenAtSchedule !== this.playbackToken) {
          return;
        }

        const context = await this.ensureContextReady();
        if (!context) {
          return;
        }

        let decoded;
        try {
          decoded = await context.decodeAudioData(audioBuffer.slice(0));
        } catch {
          return;
        }

        if (tokenAtSchedule !== this.playbackToken) {
          return;
        }

        this.scheduleDecodedBuffer(decoded);
      })
      .catch(() => {});
  }

  scheduleDecodedBuffer(decoded) {
    if (!decoded || !this.audioContext) {
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = decoded;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime + this.lookAheadSeconds;
    const startAt = Math.max(now, this.playhead || 0);
    this.playhead = startAt + decoded.duration;

    this.activeSources.add(source);
    source.addEventListener("ended", () => {
      this.activeSources.delete(source);
    });

    source.start(startAt);
  }

  finish(sessionId) {
    if (sessionId && this.sessionId && sessionId !== this.sessionId) {
      return;
    }
  }

  reset() {
    this.playbackToken += 1;
    this.decodeChain = Promise.resolve();
    this.playhead = 0;
    this.sessionId = null;

    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Ignore sources that already ended.
      }
    }

    this.activeSources.clear();
  }

  async dispose() {
    this.reset();

    if (!this.audioContext) {
      return;
    }

    try {
      await this.audioContext.close();
    } catch {
      // Ignore context close errors during shutdown.
    }

    this.audioContext = null;
  }
}
