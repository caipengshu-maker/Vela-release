/**
 * BGM Controller — simplified rewrite (2024-03).
 *
 * Previous version used Web Audio API (AudioContext + BufferSourceNode + GainNode
 * graph) with a serialized-load queue, per-track gain nodes, crossfade, and a
 * track registry. Over 8 patch rounds this grew into ~430 lines of overlapping
 * guards that still allowed double-play under React Strict Mode and broke volume
 * control (applyGain called stopAllStaleTracks, reconnecting masterGain, etc.).
 *
 * This rewrite uses a single <audio> HTML element:
 *   • One element = one source. Double-play is structurally impossible.
 *   • volume property = real-time slider. No gain nodes to manage.
 *   • loop attribute = native. No source-restart bookkeeping.
 *   • Ducking = just lower the volume temporarily.
 *
 * Trade-offs accepted:
 *   • No crossfade between day/night tracks (hard cut instead). This is cosmetic
 *     and not worth the complexity.
 *   • Ducking uses a simple multiplier on volume rather than Web Audio ramps.
 *     Perceptually equivalent for BGM.
 */

const DUCK_RATIO = 0.2;

function clampUnit(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/**
 * Attempt to convert various binary payloads into an Object URL suitable for
 * <audio src="…">. We accept ArrayBuffer, TypedArray, Blob, or a plain URL
 * string. Returns { url, revoke } where revoke() frees the blob URL (no-op for
 * plain URLs).
 */
function toPlayableUrl(source, label = "") {
  // Already a URL string (http/https/relative path)
  if (typeof source === "string" && source.length > 0) {
    return { url: source, revoke() {} };
  }

  let blob;
  if (source instanceof Blob) {
    blob = source;
  } else if (source instanceof ArrayBuffer) {
    blob = new Blob([source], { type: "audio/mpeg" });
  } else if (ArrayBuffer.isView(source)) {
    blob = new Blob([source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)], { type: "audio/mpeg" });
  }

  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  return {
    url,
    revoke() {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    }
  };
}

export class BgmController {
  constructor() {
    /** @type {HTMLAudioElement | null} */
    this._audio = null;
    /** Label/path of the currently loaded track (used for dedup) */
    this._currentLabel = "";
    /** Revoke function for the current blob URL */
    this._revokeUrl = null;

    // Volume state
    this._userVolume = 0.42;  // 0..1 (linear slider value)
    this._ducked = false;
    this._enabled = true;

    // Gesture-unlock state
    this._unlocked = false;
    this._unlockHandler = null;

    // Loading lock — only one load at a time
    this._loadId = 0;
  }

  // ---------------------------------------------------------------------------
  // Internal: audio element lifecycle
  // ---------------------------------------------------------------------------

  /** Lazily create the singleton <audio> element. */
  _ensureAudio() {
    if (this._audio) return this._audio;
    if (typeof document === "undefined") return null;

    const el = document.createElement("audio");
    el.loop = true;
    el.preload = "auto";
    // Start with correct volume
    el.volume = this._computeVolume();
    this._audio = el;
    return el;
  }

  /** Compute the effective volume (0..1) given user slider + duck state. */
  _computeVolume() {
    if (!this._enabled) return 0;
    // Apply perceptual (sqrt) curve, same as old mapUserVolumeToGain
    const gain = this._userVolume <= 0 ? 0 : Math.sqrt(this._userVolume);
    return this._ducked ? gain * DUCK_RATIO : gain;
  }

  /** Apply current computed volume to the audio element. */
  _syncVolume() {
    if (!this._audio) return;
    this._audio.volume = this._computeVolume();
  }

  // ---------------------------------------------------------------------------
  // Gesture unlock — browsers require user interaction before audio can play
  // ---------------------------------------------------------------------------

  bindFirstUserGesture() {
    if (typeof window === "undefined" || this._unlockHandler) return;

    this._unlockHandler = () => {
      this._unlocked = true;
      // Try to play if we have a source ready
      if (this._audio && this._audio.src && this._audio.paused && this._enabled) {
        this._audio.play().catch(() => {});
      }
      // Clean up listeners
      ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
        window.removeEventListener(evt, this._unlockHandler);
      });
      this._unlockHandler = null;
    };

    ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
      window.addEventListener(evt, this._unlockHandler, { passive: true });
    });
  }

  // ---------------------------------------------------------------------------
  // Public API: loading tracks
  // ---------------------------------------------------------------------------

  /**
   * Check if the given label is already the active track.
   * This is the ONLY dedup guard needed — no refs, no registries.
   */
  isCurrentTrack(label) {
    const normalized = String(label || "").trim();
    return Boolean(normalized) && normalized === this._currentLabel;
  }

  /**
   * Load a track from an ArrayBuffer (the primary path used by the app).
   * Returns true if playback started, false otherwise.
   *
   * Key invariant: if this method is called multiple times (React Strict Mode,
   * effect re-runs, etc.) with the same label, it no-ops. If called with a
   * different label, the previous track is replaced — not duplicated.
   */
  async loadFromBuffer(arrayBuffer, label = "") {
    const normalized = String(label || "").trim();

    // Dedup: same track already playing
    if (this.isCurrentTrack(normalized)) return true;

    // Acquire a load ID so concurrent loads can be cancelled
    const myLoadId = ++this._loadId;

    const playable = toPlayableUrl(arrayBuffer, normalized);
    if (!playable) return false;

    // Check if a newer load has started while we were converting
    if (this._loadId !== myLoadId) {
      playable.revoke();
      return false;
    }

    // Revoke previous blob URL if any
    this._revokeUrl?.();

    const audio = this._ensureAudio();
    if (!audio) {
      playable.revoke();
      return false;
    }

    this._currentLabel = normalized;
    this._revokeUrl = playable.revoke;
    audio.src = playable.url;
    this._syncVolume();

    if (this._enabled) {
      try {
        await audio.play();
      } catch {
        // Autoplay blocked — bindFirstUserGesture will retry on interaction
      }
    }

    return true;
  }

  /**
   * Load a track from a URL (alternative path, kept for API compat).
   */
  async loadAndPlay(trackUrl) {
    const normalized = String(trackUrl || "").trim();
    if (!normalized) return false;
    if (this.isCurrentTrack(normalized)) return true;

    const myLoadId = ++this._loadId;

    const audio = this._ensureAudio();
    if (!audio) return false;

    // Revoke previous blob URL if any
    this._revokeUrl?.();
    this._revokeUrl = null;

    if (this._loadId !== myLoadId) return false;

    this._currentLabel = normalized;
    audio.src = normalized;
    this._syncVolume();

    if (this._enabled) {
      try {
        await audio.play();
      } catch {
        // Autoplay blocked
      }
    }

    return true;
  }

  /**
   * Switch to a different track (alias for loadAndPlay, kept for API compat).
   */
  async switchTrack(newUrl) {
    return this.loadAndPlay(newUrl);
  }

  // ---------------------------------------------------------------------------
  // Public API: playback control
  // ---------------------------------------------------------------------------

  pause() {
    this._audio?.pause();
  }

  async resume() {
    if (!this._audio) return false;
    this._syncVolume();
    if (this._audio.src && this._enabled) {
      try {
        await this._audio.play();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Public API: volume
  // ---------------------------------------------------------------------------

  setVolume(volume, _fadeMs = 0) {
    this._userVolume = clampUnit(volume);
    this._syncVolume();
  }

  duck() {
    this._ducked = true;
    this._syncVolume();
  }

  unduck() {
    this._ducked = false;
    this._syncVolume();
  }

  setEnabled(enabled) {
    this._enabled = Boolean(enabled);
    this._syncVolume();
    if (!this._enabled) {
      this._audio?.pause();
    }
  }

  // ---------------------------------------------------------------------------
  // Public API: unlock (called by App.jsx before loading)
  // ---------------------------------------------------------------------------

  async unlock() {
    this._unlocked = true;
    this.bindFirstUserGesture();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Kept for API compat but no-op in the simplified version
  // ---------------------------------------------------------------------------

  ensureContext() { return null; }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  async dispose() {
    // Remove gesture listeners
    if (typeof window !== "undefined" && this._unlockHandler) {
      ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
        window.removeEventListener(evt, this._unlockHandler);
      });
      this._unlockHandler = null;
    }

    // Stop and clean up audio element
    if (this._audio) {
      this._audio.pause();
      this._audio.removeAttribute("src");
      this._audio.load(); // Reset the element
      this._audio = null;
    }

    // Revoke blob URL
    this._revokeUrl?.();
    this._revokeUrl = null;

    this._currentLabel = "";
    this._unlocked = false;
  }
}
