const DUCK_RATIO = 0.2;
const DUCK_FADE_MS = 300;
const UNDUCK_FADE_MS = 500;
const CROSSFADE_MS = 800;

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.min(1, Math.max(0, numeric));
}

export class BgmController {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.current = null;
    this.userVolume = 0.42;
    this.ducked = false;
    this.enabled = true;
    this.unlocked = false;
    this.unlockHandler = null;
    this.activeTrackUrl = "";
  }

  ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContextClass();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.enabled ? this.userVolume : 0;
      this.masterGain.connect(this.audioContext.destination);
    }

    return this.audioContext;
  }

  getCurrentTargetVolume() {
    if (!this.enabled) {
      return 0;
    }

    return this.ducked ? this.userVolume * DUCK_RATIO : this.userVolume;
  }

  applyGain(targetVolume, fadeMs = 0) {
    if (!this.masterGain || !this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;
    const target = clampVolume(targetVolume);
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);

    if (fadeMs > 0) {
      this.masterGain.gain.linearRampToValueAtTime(target, now + fadeMs / 1000);
      return;
    }

    this.masterGain.gain.setValueAtTime(target, now);
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) {
      return false;
    }

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }

    this.unlocked = context.state === "running";
    if (this.unlocked) {
      this.applyGain(this.getCurrentTargetVolume(), 0);
    }
    return this.unlocked;
  }

  bindFirstUserGesture() {
    if (typeof window === "undefined" || this.unlockHandler) {
      return;
    }

    this.unlockHandler = () => {
      void this.unlock().finally(() => {
        if (!this.unlocked) {
          return;
        }

        ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
          window.removeEventListener(eventName, this.unlockHandler);
        });
        this.unlockHandler = null;
      });
    };

    ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      window.addEventListener(eventName, this.unlockHandler, { passive: true });
    });
  }

  async fetchBuffer(trackUrl) {
    const context = this.ensureContext();
    if (!context || !trackUrl) {
      return null;
    }

    try {
      const response = await fetch(trackUrl, { cache: "force-cache" });
      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer.byteLength) {
        return null;
      }

      return await context.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      return null;
    }
  }

  createTrackNode(buffer) {
    if (!this.audioContext || !this.masterGain || !buffer) {
      return null;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1;
    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start();

    return { source, gainNode };
  }

  async loadAndPlay(trackUrl) {
    this.activeTrackUrl = String(trackUrl || "").trim();
    if (!this.activeTrackUrl) {
      return false;
    }

    this.ensureContext();
    this.bindFirstUserGesture();
    await this.unlock();

    const buffer = await this.fetchBuffer(this.activeTrackUrl);
    if (!buffer) {
      return false;
    }

    const track = this.createTrackNode(buffer);
    if (!track) {
      return false;
    }

    this.current?.source?.stop();
    this.current = track;
    this.applyGain(this.getCurrentTargetVolume(), 0);
    return true;
  }

  async switchTrack(newUrl) {
    const nextUrl = String(newUrl || "").trim();
    if (!nextUrl) {
      return false;
    }

    if (nextUrl === this.activeTrackUrl && this.current) {
      return true;
    }

    this.activeTrackUrl = nextUrl;
    this.ensureContext();
    this.bindFirstUserGesture();
    await this.unlock();

    const buffer = await this.fetchBuffer(nextUrl);
    if (!buffer) {
      return false;
    }

    const nextTrack = this.createTrackNode(buffer);
    if (!nextTrack || !this.audioContext) {
      return false;
    }

    const now = this.audioContext.currentTime;
    nextTrack.gainNode.gain.setValueAtTime(0, now);
    nextTrack.gainNode.gain.linearRampToValueAtTime(1, now + CROSSFADE_MS / 1000);

    const previous = this.current;
    if (previous?.gainNode) {
      previous.gainNode.gain.cancelScheduledValues(now);
      previous.gainNode.gain.setValueAtTime(previous.gainNode.gain.value, now);
      previous.gainNode.gain.linearRampToValueAtTime(0, now + CROSSFADE_MS / 1000);
      window.setTimeout(() => {
        try {
          previous.source.stop();
        } catch {
          // noop
        }
      }, CROSSFADE_MS + 80);
    }

    this.current = nextTrack;
    this.applyGain(this.getCurrentTargetVolume(), 0);
    return true;
  }

  pause() {
    if (!this.audioContext) {
      return;
    }

    void this.audioContext.suspend();
  }

  async resume() {
    if (!this.audioContext) {
      return false;
    }

    try {
      await this.audioContext.resume();
      this.unlocked = this.audioContext.state === "running";
      this.applyGain(this.getCurrentTargetVolume(), 0);
      return this.unlocked;
    } catch {
      return false;
    }
  }

  setVolume(volume) {
    this.userVolume = clampVolume(volume);
    this.applyGain(this.getCurrentTargetVolume(), 160);
  }

  duck() {
    this.ducked = true;
    this.applyGain(this.getCurrentTargetVolume(), DUCK_FADE_MS);
  }

  unduck() {
    this.ducked = false;
    this.applyGain(this.getCurrentTargetVolume(), UNDUCK_FADE_MS);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.applyGain(this.getCurrentTargetVolume(), 220);
  }

  async dispose() {
    if (typeof window !== "undefined" && this.unlockHandler) {
      ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
        window.removeEventListener(eventName, this.unlockHandler);
      });
      this.unlockHandler = null;
    }

    if (this.current?.source) {
      try {
        this.current.source.stop();
      } catch {
        // noop
      }
    }

    this.current = null;

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        // noop
      }
    }

    this.audioContext = null;
    this.masterGain = null;
    this.unlocked = false;
  }
}
