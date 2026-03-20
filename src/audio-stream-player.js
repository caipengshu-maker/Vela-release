function hexToUint8Array(hex) {
  const normalizedHex = String(hex || "").replace(/\s+/g, "");
  const length = Math.floor(normalizedHex.length / 2);
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Number.parseInt(
      normalizedHex.slice(index * 2, index * 2 + 2),
      16
    );
  }

  return bytes;
}

export class AudioStreamPlayer {
  constructor() {
    this.audio = null;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.queue = [];
    this.objectUrl = "";
    this.sessionId = null;
    this.mimeType = "audio/mpeg";
    this.endRequested = false;
    this.flushBound = null;
  }

  attach(audioElement) {
    this.audio = audioElement;
  }

  reset() {
    this.queue = [];
    this.endRequested = false;
    this.sessionId = null;

    if (this.sourceBuffer && this.flushBound) {
      this.sourceBuffer.removeEventListener("updateend", this.flushBound);
    }

    this.sourceBuffer = null;

    if (this.mediaSource && this.mediaSource.readyState === "open") {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // Ignore shutdown races during interrupt/reset.
      }
    }

    this.mediaSource = null;

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = "";
    }
  }

  ensureSession(sessionId, mimeType = "audio/mpeg") {
    if (this.sessionId === sessionId && this.mediaSource) {
      return;
    }

    this.reset();

    if (!window.MediaSource || !this.audio) {
      return;
    }

    this.sessionId = sessionId;
    this.mimeType = mimeType;
    this.mediaSource = new MediaSource();
    this.flushBound = () => {
      this.flush();
    };
    this.objectUrl = URL.createObjectURL(this.mediaSource);
    this.audio.src = this.objectUrl;

    this.mediaSource.addEventListener("sourceopen", () => {
      if (!this.mediaSource || this.sourceBuffer) {
        return;
      }

      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
      this.sourceBuffer.mode = "sequence";
      this.sourceBuffer.addEventListener("updateend", this.flushBound);
      this.flush();
    });
  }

  appendChunk({ sessionId, mimeType = "audio/mpeg", hex }) {
    if (!hex) {
      return;
    }

    this.ensureSession(sessionId || "vela-audio", mimeType);

    if (!this.mediaSource) {
      return;
    }

    this.queue.push(hexToUint8Array(hex));
    this.flush();
  }

  finish(sessionId) {
    if (sessionId && this.sessionId && sessionId !== this.sessionId) {
      return;
    }

    this.endRequested = true;
    this.flush();
  }

  flush() {
    if (!this.audio || !this.sourceBuffer || this.sourceBuffer.updating) {
      return;
    }

    const nextChunk = this.queue.shift();

    if (nextChunk) {
      this.sourceBuffer.appendBuffer(nextChunk);
      void this.audio.play().catch(() => {});
      return;
    }

    if (this.endRequested && this.mediaSource?.readyState === "open") {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // Ignore end-of-stream races while buffered audio drains.
      }
    }
  }
}
