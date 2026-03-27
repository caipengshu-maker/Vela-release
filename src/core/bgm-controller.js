const DEFAULT_VOLUME = 0.42;
const DUCK_RATIO = 0.2;
const CROSSFADE_MS = 650;

function toPlayableUrl(source) {
  if (typeof source === "string" && source.length > 0) {
    return { url: source, revoke() {} };
  }

  let blob = null;

  if (source instanceof Blob) {
    blob = source;
  } else if (source instanceof ArrayBuffer) {
    blob = new Blob([source], { type: "audio/mpeg" });
  } else if (ArrayBuffer.isView(source)) {
    blob = new Blob(
      [source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)],
      { type: "audio/mpeg" }
    );
  }

  if (!blob) {
    return null;
  }

  const url = URL.createObjectURL(blob);
  return {
    url,
    revoke() {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore stale object URL cleanup errors.
      }
    }
  };
}

function getTimestamp() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export class BgmController {
  constructor() {
    this._currentTrack = null;
    this._outgoingTrack = null;
    this._enabled = true;
    this._ducked = false;
    this._unlocked = false;
    this._unlockHandler = null;
    this._loadId = 0;
    this._fadeFrame = null;
    this._fadeToken = 0;
    this._fadeProgress = 0;
  }

  _createAudioElement() {
    if (typeof document === "undefined") {
      return null;
    }

    const audio = document.createElement("audio");
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    return audio;
  }

  _createTrack(playable, label) {
    const audio = this._createAudioElement();
    if (!audio) {
      return null;
    }

    audio.src = playable.url;

    return {
      audio,
      label,
      revoke: playable.revoke
    };
  }

  _pauseTrack(track) {
    try {
      track?.audio?.pause();
    } catch {
      // Ignore pause failures from a torn-down element.
    }
  }

  _destroyTrack(track) {
    if (!track) {
      return;
    }

    this._pauseTrack(track);

    try {
      track.audio.removeAttribute("src");
      track.audio.load();
    } catch {
      // Ignore cleanup failures from a torn-down element.
    }

    track.revoke?.();
  }

  _getTargetVolume() {
    if (!this._enabled) {
      return 0;
    }

    return this._ducked ? DEFAULT_VOLUME * DUCK_RATIO : DEFAULT_VOLUME;
  }

  _applyTrackVolume(track, factor = 1) {
    if (!track?.audio) {
      return;
    }

    const volume = Math.max(0, Math.min(1, this._getTargetVolume() * factor));
    track.audio.volume = volume;
    track.audio.muted = volume <= 0;
  }

  _syncTrackVolumes() {
    if (this._outgoingTrack) {
      this._applyTrackVolume(this._outgoingTrack, 1 - this._fadeProgress);
    }

    if (this._currentTrack) {
      this._applyTrackVolume(
        this._currentTrack,
        this._outgoingTrack ? this._fadeProgress : 1
      );
    }
  }

  _cancelCrossfade() {
    if (this._fadeFrame) {
      window.cancelAnimationFrame(this._fadeFrame);
      this._fadeFrame = null;
    }

    this._fadeToken += 1;
    this._fadeProgress = 0;

    if (this._outgoingTrack) {
      this._destroyTrack(this._outgoingTrack);
      this._outgoingTrack = null;
    }

    this._syncTrackVolumes();
  }

  async _playTrack(track) {
    if (!track?.audio?.src || !this._enabled) {
      return false;
    }

    try {
      await track.audio.play();
      return true;
    } catch {
      return false;
    }
  }

  async _swapTrack(nextTrack) {
    this._cancelCrossfade();

    if (!this._currentTrack) {
      this._currentTrack = nextTrack;
      this._syncTrackVolumes();

      if (this._enabled) {
        await this._playTrack(nextTrack);
      }

      return true;
    }

    if (!this._enabled || this._currentTrack.audio.paused) {
      this._destroyTrack(this._currentTrack);
      this._currentTrack = nextTrack;
      this._syncTrackVolumes();
      if (this._enabled) {
        await this._playTrack(nextTrack);
      }
      return true;
    }

    const outgoingTrack = this._currentTrack;
    this._outgoingTrack = outgoingTrack;
    this._currentTrack = nextTrack;
    this._fadeProgress = 0;
    this._syncTrackVolumes();

    const started = await this._playTrack(nextTrack);
    if (!started) {
      this._destroyTrack(nextTrack);
      this._currentTrack = outgoingTrack;
      this._outgoingTrack = null;
      this._syncTrackVolumes();
      return false;
    }

    const fadeToken = ++this._fadeToken;
    const startedAt = getTimestamp();

    await new Promise((resolve) => {
      const step = (frameAt) => {
        if (fadeToken !== this._fadeToken) {
          resolve();
          return;
        }

        const elapsed = frameAt - startedAt;
        this._fadeProgress = Math.max(0, Math.min(1, elapsed / CROSSFADE_MS));
        this._syncTrackVolumes();

        if (this._fadeProgress >= 1) {
          this._fadeFrame = null;
          this._destroyTrack(outgoingTrack);
          if (this._outgoingTrack === outgoingTrack) {
            this._outgoingTrack = null;
          }
          this._fadeProgress = 0;
          this._syncTrackVolumes();
          resolve();
          return;
        }

        this._fadeFrame = window.requestAnimationFrame(step);
      };

      this._fadeFrame = window.requestAnimationFrame(step);
    });

    return true;
  }

  async _loadPlayable(playable, label) {
    const nextTrack = this._createTrack(playable, label);
    if (!nextTrack) {
      playable.revoke();
      return false;
    }

    return this._swapTrack(nextTrack);
  }

  bindFirstUserGesture() {
    if (typeof window === "undefined" || this._unlockHandler) {
      return;
    }

    this._unlockHandler = () => {
      this._unlocked = true;
      void this.play();
      void this._playTrack(this._outgoingTrack);

      ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
        window.removeEventListener(eventName, this._unlockHandler);
      });
      this._unlockHandler = null;
    };

    ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      window.addEventListener(eventName, this._unlockHandler, { passive: true });
    });
  }

  isCurrentTrack(label) {
    const normalized = String(label || "").trim();
    return Boolean(normalized) && normalized === this._currentTrack?.label;
  }

  async loadFromBuffer(arrayBuffer, label = "") {
    const normalized = String(label || "").trim();

    if (this.isCurrentTrack(normalized)) {
      return true;
    }

    const myLoadId = ++this._loadId;
    const playable = toPlayableUrl(arrayBuffer);
    if (!playable) {
      return false;
    }

    if (this._loadId !== myLoadId) {
      playable.revoke();
      return false;
    }

    return this._loadPlayable(playable, normalized);
  }

  async loadAndPlay(trackUrl) {
    const normalized = String(trackUrl || "").trim();
    if (!normalized) {
      return false;
    }

    if (this.isCurrentTrack(normalized)) {
      return this.play();
    }

    const myLoadId = ++this._loadId;
    if (this._loadId !== myLoadId) {
      return false;
    }

    return this._loadPlayable(toPlayableUrl(normalized), normalized);
  }

  async switchTrack(trackUrl) {
    return this.loadAndPlay(trackUrl);
  }

  stop() {
    this._cancelCrossfade();
    this._pauseTrack(this._currentTrack);
    this._syncTrackVolumes();
  }

  pause() {
    this.stop();
  }

  async play() {
    if (!this._currentTrack) {
      return false;
    }

    this._syncTrackVolumes();
    return this._playTrack(this._currentTrack);
  }

  async resume() {
    return this.play();
  }

  duck() {
    this._ducked = true;
    this._syncTrackVolumes();
  }

  unduck() {
    this._ducked = false;
    this._syncTrackVolumes();
  }

  setEnabled(enabled) {
    this._enabled = Boolean(enabled);

    if (!this._enabled) {
      this.stop();
      return;
    }

    this._syncTrackVolumes();
  }

  async unlock() {
    this._unlocked = true;
    this.bindFirstUserGesture();
    return true;
  }

  ensureContext() {
    return null;
  }

  async dispose() {
    if (typeof window !== "undefined" && this._unlockHandler) {
      ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
        window.removeEventListener(eventName, this._unlockHandler);
      });
      this._unlockHandler = null;
    }

    this._cancelCrossfade();
    this._destroyTrack(this._currentTrack);
    this._currentTrack = null;
    this._unlocked = false;
  }
}
