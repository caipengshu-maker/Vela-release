/**
 * Streaming audio player using MediaSource Extensions (MSE).
 *
 * MSE handles MP3 frame boundaries natively, eliminating the micro-gaps
 * that Web Audio API's decodeAudioData introduces between chunks.
 */

function decodeBase64ToUint8Array(input) {
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

  return bytes;
}

function decodeHexToUint8Array(input) {
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

  return bytes;
}

function resolveChunkBytes(chunk) {
  if (!chunk) {
    return null;
  }

  if (chunk.base64) {
    return decodeBase64ToUint8Array(chunk.base64);
  }

  if (chunk.audioBase64) {
    return decodeBase64ToUint8Array(chunk.audioBase64);
  }

  if (chunk.audio) {
    return decodeBase64ToUint8Array(chunk.audio);
  }

  if (chunk.hex) {
    return decodeHexToUint8Array(chunk.hex);
  }

  return null;
}

const MSE_MIME = "audio/mpeg";

export class AudioPlayerService {
  constructor() {
    this.audio = null;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.pendingChunks = [];
    this.sessionId = null;
    this.playbackToken = 0;
    this.isAppending = false;
    this.streamFinished = false;
    this.sourceOpen = false;
    this.initialized = false;
  }

  _createElements() {
    if (this.audio) {
      return;
    }

    this.audio = document.createElement("audio");
    this.audio.style.display = "none";
    document.body.appendChild(this.audio);
  }

  _initMediaSource() {
    if (this.initialized) {
      return;
    }

    this._createElements();
    this.initialized = true;

    this.mediaSource = new MediaSource();
    this.audio.src = URL.createObjectURL(this.mediaSource);

    this.mediaSource.addEventListener("sourceopen", () => {
      this.sourceOpen = true;

      try {
        this.sourceBuffer = this.mediaSource.addSourceBuffer(MSE_MIME);
        this.sourceBuffer.mode = "sequence";

        this.sourceBuffer.addEventListener("updateend", () => {
          this.isAppending = false;
          this._drainQueue();
        });

        this._drainQueue();
      } catch (error) {
        console.error("[AudioPlayer] Failed to add SourceBuffer:", error);
      }
    });
  }

  _drainQueue() {
    if (
      this.isAppending ||
      !this.sourceBuffer ||
      !this.sourceOpen ||
      this.pendingChunks.length === 0
    ) {
      if (
        this.streamFinished &&
        this.pendingChunks.length === 0 &&
        !this.isAppending &&
        this.sourceOpen &&
        this.mediaSource?.readyState === "open"
      ) {
        try {
          this.mediaSource.endOfStream();
        } catch {
          // Ignore if already ended.
        }
      }

      return;
    }

    const chunk = this.pendingChunks.shift();
    this.isAppending = true;

    try {
      this.sourceBuffer.appendBuffer(chunk);
    } catch (error) {
      console.error("[AudioPlayer] appendBuffer failed:", error);
      this.isAppending = false;
    }
  }

  beginSession(sessionId) {
    const nextSessionId = String(sessionId || "vela-tts").trim() || "vela-tts";
    if (this.sessionId === nextSessionId && this.initialized) {
      return;
    }

    this.reset();
    this.sessionId = nextSessionId;
    this._initMediaSource();
  }

  appendChunk(chunk) {
    const bytes = resolveChunkBytes(chunk);
    if (!bytes) {
      return;
    }

    this.beginSession(chunk?.sessionId);
    this.pendingChunks.push(bytes);

    if (this.sourceBuffer && this.sourceOpen) {
      this._drainQueue();
    }

    // Start playback as soon as we have data.
    if (this.audio && this.audio.paused) {
      this.audio.play().catch(() => {
        // Autoplay may be blocked; user interaction will resume.
      });
    }
  }

  finish(sessionId) {
    if (sessionId && this.sessionId && sessionId !== this.sessionId) {
      return;
    }

    this.streamFinished = true;

    if (
      this.pendingChunks.length === 0 &&
      !this.isAppending &&
      this.sourceOpen &&
      this.mediaSource?.readyState === "open"
    ) {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // Ignore.
      }
    }
  }

  reset() {
    this.playbackToken += 1;
    this.pendingChunks = [];
    this.isAppending = false;
    this.streamFinished = false;
    this.sourceOpen = false;
    this.initialized = false;

    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }

    if (this.sourceBuffer) {
      try {
        this.mediaSource.removeSourceBuffer(this.sourceBuffer);
      } catch {
        // Ignore cleanup errors.
      }

      this.sourceBuffer = null;
    }

    if (this.mediaSource) {
      if (this.audio?.src) {
        URL.revokeObjectURL(this.audio.src);
        this.audio.removeAttribute("src");
        this.audio.load();
      }

      this.mediaSource = null;
    }

    this.sessionId = null;
  }

  async dispose() {
    this.reset();

    if (this.audio) {
      this.audio.remove();
      this.audio = null;
    }
  }
}
