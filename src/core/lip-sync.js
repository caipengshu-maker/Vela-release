const ANALYSER_FFT_SIZE = 512;
const MIN_FREQUENCY_BIN = 2;
const MAX_FREQUENCY_BIN_RATIO = 0.35;
const AMPLITUDE_NORMALIZER = 48;
const MEDIA_SOURCE_CACHE = new WeakMap();

function getMediaSourceCache(audioContext) {
  let mediaSourceCache = MEDIA_SOURCE_CACHE.get(audioContext);

  if (!mediaSourceCache) {
    mediaSourceCache = new WeakMap();
    MEDIA_SOURCE_CACHE.set(audioContext, mediaSourceCache);
  }

  return mediaSourceCache;
}

export class LipSyncAnalyser {
  constructor(audioContext) {
    if (!audioContext) {
      throw new Error("AudioContext is required");
    }

    this.audioContext = audioContext;
    this.mediaElement = null;
    this.sourceNode = null;
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = ANALYSER_FFT_SIZE;
    this.analyserNode.smoothingTimeConstant = 0.6;
    this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
  }

  connectSource(mediaElement) {
    if (!(mediaElement instanceof HTMLMediaElement)) {
      throw new TypeError("A valid media element is required");
    }

    if (this.mediaElement === mediaElement && this.sourceNode) {
      return this.sourceNode;
    }

    this.disconnect();

    const mediaSourceCache = getMediaSourceCache(this.audioContext);
    let sourceNode = mediaSourceCache.get(mediaElement);

    if (!sourceNode) {
      sourceNode = this.audioContext.createMediaElementSource(mediaElement);
      mediaSourceCache.set(mediaElement, sourceNode);
    }

    sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    this.mediaElement = mediaElement;
    this.sourceNode = sourceNode;

    return sourceNode;
  }

  getAmplitude() {
    if (
      !this.mediaElement ||
      !this.sourceNode ||
      this.mediaElement.paused ||
      this.mediaElement.ended
    ) {
      return 0;
    }

    this.analyserNode.getByteFrequencyData(this.frequencyData);

    const maxBin = Math.max(
      MIN_FREQUENCY_BIN + 1,
      Math.floor(this.frequencyData.length * MAX_FREQUENCY_BIN_RATIO)
    );
    let total = 0;
    let count = 0;

    for (let index = MIN_FREQUENCY_BIN; index < maxBin; index += 1) {
      total += this.frequencyData[index];
      count += 1;
    }

    if (count === 0) {
      return 0;
    }

    return Math.min(1, total / count / AMPLITUDE_NORMALIZER);
  }

  disconnect() {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect(this.analyserNode);
      } catch {
        // Ignore repeated disconnects from reused MediaElementSource nodes.
      }
    }

    try {
      this.analyserNode.disconnect();
    } catch {
      // Ignore repeated disconnects.
    }

    this.mediaElement = null;
    this.sourceNode = null;
  }
}
