import { mapUserVolumeToGain } from "./audio-volume.js";

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
    this._muted = false;
    this._loadingPromise = null;
    this._tracks = new Set();
    this._pendingStopTimers = new Set();
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

    const gain = mapUserVolumeToGain(this.userVolume);
    return this.ducked ? gain * DUCK_RATIO : gain;
  }

  applyGain(targetVolume, fadeMs = 0) {
    if (!this.masterGain || !this.audioContext) {
      return;
    }

    this.stopAllStaleTracks();

    // Resume context if suspended
    if (this.audioContext.state === "suspended" && this.unlocked) {
      void this.audioContext.resume();
    }

    // Ensure masterGain is connected
    try {
      this.masterGain.connect(this.audioContext.destination);
    } catch {
      // already connected — this is fine
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

  normalizeTrackLabel(label = "") {
    return String(label || "").trim();
  }

  isCurrentTrack(label) {
    const nextLabel = this.normalizeTrackLabel(label);
    return Boolean(nextLabel) && this.activeTrackUrl === nextLabel && this.current?.label === nextLabel;
  }

  async runSerializedLoad(label, loadOperation) {
    const nextLabel = this.normalizeTrackLabel(label);
    if (this.isCurrentTrack(nextLabel)) {
      return true;
    }

    if (nextLabel) {
      this.activeTrackUrl = nextLabel;
    }

    if (this._loadingPromise) {
      await this._loadingPromise;
      if (this.isCurrentTrack(nextLabel)) {
        return true;
      }
    }

    const pendingLoad = Promise.resolve().then(loadOperation);
    this._loadingPromise = pendingLoad;

    try {
      return await pendingLoad;
    } finally {
      if (this._loadingPromise === pendingLoad) {
        this._loadingPromise = null;
      }
    }
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

  createTrackNode(buffer, label = "") {
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

    const track = {
      source,
      gainNode,
      label: this.normalizeTrackLabel(label)
    };

    source.addEventListener?.("ended", () => {
      this._tracks.delete(track);
    });

    this._tracks.add(track);
    source.start();
    return track;
  }

  stopTrackSource(track) {
    if (!track) {
      return;
    }

    try {
      track.gainNode?.disconnect?.();
    } catch {
      // noop
    }

    try {
      track.source?.disconnect?.();
    } catch {
      // noop
    }

    try {
      track.source?.stop();
    } catch {
      // noop
    }

    this._tracks.delete(track);
  }

  stopAllStaleTracks() {
    for (const track of Array.from(this._tracks)) {
      if (track !== this.current) {
        this.stopTrackSource(track);
      }
    }
  }

  activateTrack(nextTrack, { crossfade = true } = {}) {
    if (!nextTrack) {
      return false;
    }

    const previous = this.current;
    if (crossfade && previous?.gainNode && this.audioContext) {
      const now = this.audioContext.currentTime;
      nextTrack.gainNode.gain.setValueAtTime(0, now);
      nextTrack.gainNode.gain.linearRampToValueAtTime(1, now + CROSSFADE_MS / 1000);
      previous.gainNode.gain.cancelScheduledValues(now);
      previous.gainNode.gain.setValueAtTime(previous.gainNode.gain.value, now);
      previous.gainNode.gain.linearRampToValueAtTime(0, now + CROSSFADE_MS / 1000);
      window.setTimeout(() => {
        this.stopTrackSource(previous);
      }, CROSSFADE_MS + 80);
    } else {
      this.stopTrackSource(previous);
    }

    this.current = nextTrack;
    if (nextTrack.label) {
      this.activeTrackUrl = nextTrack.label;
    }
    this.stopAllStaleTracks();
    this.applyGain(this.getCurrentTargetVolume(), 0);
    return true;
  }

  async loadAndPlay(trackUrl) {
    const nextUrl = this.normalizeTrackLabel(trackUrl);
    if (!nextUrl) {
      return false;
    }

    return this.runSerializedLoad(nextUrl, async () => {
      this.ensureContext();
      this.bindFirstUserGesture();
      await this.unlock();

      const buffer = await this.fetchBuffer(nextUrl);
      if (!buffer) {
        return false;
      }

      const track = this.createTrackNode(buffer, nextUrl);
      return this.activateTrack(track, { crossfade: false });
    });
  }

  async loadFromBuffer(arrayBuffer, label = "") {
    const nextLabel = this.normalizeTrackLabel(label);
    return this.runSerializedLoad(nextLabel, async () => {
      this.ensureContext();
      this.bindFirstUserGesture();
      await this.unlock();

      if (!this.audioContext || !arrayBuffer?.byteLength) {
        return false;
      }

      let audioBuffer;
      try {
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch {
        return false;
      }

      const nextTrack = this.createTrackNode(audioBuffer, nextLabel);
      return this.activateTrack(nextTrack);
    });
  }

  async switchTrack(newUrl) {
    const nextUrl = this.normalizeTrackLabel(newUrl);
    if (!nextUrl) {
      return false;
    }

    return this.runSerializedLoad(nextUrl, async () => {
      this.ensureContext();
      this.bindFirstUserGesture();
      await this.unlock();

      const buffer = await this.fetchBuffer(nextUrl);
      if (!buffer) {
        return false;
      }

      const nextTrack = this.createTrackNode(buffer, nextUrl);
      return this.activateTrack(nextTrack);
    });
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

  setVolume(volume, fadeMs = 0) {
    this.userVolume = clampVolume(volume);
    this.applyGain(this.getCurrentTargetVolume(), fadeMs);
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
