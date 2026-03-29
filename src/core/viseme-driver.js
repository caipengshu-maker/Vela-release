import { LipSyncAnalyser } from "./lip-sync.js";
import { HeadAudio } from "@met4citizen/headaudio/modules/headaudio.mjs";
import headWorkletUrl from "@met4citizen/headaudio/dist/headworklet.min.mjs?url";

const HEADAUDIO_MODEL_PATH = "/assets/headaudio/model-en-mixed.bin";
const HEADAUDIO_OUTPUT_DELAY_SECONDS = 0.08;
const ACTIVE_WEIGHT_EPSILON = 0.005;

export const VISEME_TO_VRM_MORPH = Object.freeze({
  viseme_sil: null,
  viseme_PP: "mouth_straight",
  viseme_FF: "mouth_narrow",
  viseme_TH: "mouth_straight",
  viseme_DD: "mouth_a_1",
  viseme_kk: "mouth_narrow",
  viseme_CH: "mouth_narrow",
  viseme_SS: "mouth_straight",
  viseme_nn: "mouth_straight",
  viseme_RR: "mouth_o_1",
  viseme_aa: "mouth_a_1",
  viseme_E: "mouth_wide",
  viseme_I: "mouth_straight",
  viseme_ih: "mouth_straight",
  viseme_O: "mouth_o_1",
  viseme_oh: "mouth_o_1",
  viseme_U: "mouth_u_1",
  viseme_ou: "mouth_u_1"
});

function clampWeight(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function getAudioContextCtor() {
  return window.AudioContext || window.webkitAudioContext || null;
}

function resolveHeadAudioModelUrl() {
  if (window.location.protocol === "file:") {
    return new URL("./assets/headaudio/model-en-mixed.bin", window.location.href).toString();
  }

  return HEADAUDIO_MODEL_PATH;
}

function createEmptyFrame() {
  return {
    amplitude: 0,
    visemeActive: false,
    visemeWeights: {}
  };
}

export class VisemeDriver {
  constructor({
    modelUrl = resolveHeadAudioModelUrl(),
    outputDelaySeconds = HEADAUDIO_OUTPUT_DELAY_SECONDS
  } = {}) {
    this.modelUrl = modelUrl;
    this.outputDelaySeconds = Math.max(0, Number(outputDelaySeconds) || 0);
    this.mediaElement = null;
    this.audioContext = null;
    this.amplitudeAnalyser = null;
    this.sourceNode = null;
    this.delayNode = null;
    this.gainNode = null;
    this.outputGain = 1;
    this.headAudio = null;
    this.headAudioReadyPromise = null;
    this.headAudioFailed = false;
    this.headAudioSupported = true;
    this.speechDetected = false;
    this.oculusVisemeWeights = new Map();
  }

  async attach(mediaElement) {
    if (!(mediaElement instanceof HTMLMediaElement)) {
      throw new TypeError("A valid media element is required");
    }

    this.mediaElement = mediaElement;

    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) {
      this.headAudioSupported = false;
      return false;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContextCtor();
    }

    if (!this.amplitudeAnalyser) {
      this.amplitudeAnalyser = new LipSyncAnalyser(this.audioContext);
      this.sourceNode = this.amplitudeAnalyser.connectSource(mediaElement);

      try {
        this.amplitudeAnalyser.analyserNode.disconnect();
      } catch {
        // Ignore repeated disconnects from the default output path.
      }

      this.delayNode = this.audioContext.createDelay(1);
      this.delayNode.delayTime.value = 0;
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.outputGain;
      this.sourceNode.connect(this.delayNode);
      this.delayNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume().catch(() => {});
    }

    void this._ensureHeadAudio();

    return true;
  }

  async _ensureHeadAudio() {
    if (
      this.headAudio ||
      this.headAudioReadyPromise ||
      this.headAudioFailed ||
      !this.audioContext ||
      !this.sourceNode
    ) {
      return Boolean(this.headAudio);
    }

    if (!this.audioContext.audioWorklet?.addModule) {
      this.headAudioSupported = false;
      this.headAudioFailed = true;
      console.warn("[AudioPlayer] HeadAudio disabled: AudioWorklet is unavailable");
      return false;
    }

    this.headAudioReadyPromise = (async () => {
      try {
        await this.audioContext.audioWorklet.addModule(headWorkletUrl);

        const headAudio = new HeadAudio(this.audioContext, {
          parameterData: {
            silMode: 0,
            vadGateActiveDb: -42,
            vadGateInactiveDb: -56
          }
        });

        headAudio.onstarted = () => {
          this.speechDetected = true;
        };

        headAudio.onended = () => {
          this.speechDetected = false;
        };

        headAudio.onvalue = (key, value) => {
          this.oculusVisemeWeights.set(String(key || ""), clampWeight(value));
        };

        headAudio.addEventListener("processorerror", () => {
          console.warn("[AudioPlayer] HeadAudio processor error, falling back to amplitude lip sync");
          this._disableHeadAudio();
        });

        await headAudio.loadModel(this.modelUrl);
        this.sourceNode.connect(headAudio);
        this.delayNode.delayTime.value = this.outputDelaySeconds;
        this.headAudio = headAudio;

        return true;
      } catch (error) {
        this.headAudioFailed = true;
        this.delayNode.delayTime.value = 0;
        console.warn(
          `[AudioPlayer] HeadAudio disabled: ${error?.message || "initialization failed"}`
        );
        return false;
      } finally {
        this.headAudioReadyPromise = null;
      }
    })();

    return this.headAudioReadyPromise;
  }

  _disableHeadAudio() {
    if (this.sourceNode && this.headAudio) {
      try {
        this.sourceNode.disconnect(this.headAudio);
      } catch {
        // Ignore repeated disconnects.
      }
    }

    if (this.headAudio) {
      try {
        this.headAudio.disconnect();
      } catch {
        // Ignore repeated disconnects.
      }
    }

    this.headAudio = null;
    this.headAudioFailed = true;
    this.speechDetected = false;
    this.oculusVisemeWeights.clear();

    if (this.delayNode) {
      this.delayNode.delayTime.value = 0;
    }
  }

  setOutputGain(value) {
    const numericValue = Number(value);
    this.outputGain = Number.isFinite(numericValue)
      ? Math.max(0, Math.min(1, numericValue))
      : 1;

    if (this.gainNode) {
      this.gainNode.gain.value = this.outputGain;
    }
  }

  _buildVisemeWeights() {
    const morphWeights = {};

    this.oculusVisemeWeights.forEach((value, visemeName) => {
      const morphTarget = VISEME_TO_VRM_MORPH[visemeName];
      if (!morphTarget) {
        return;
      }

      const weight = clampWeight(value);
      if (weight <= ACTIVE_WEIGHT_EPSILON) {
        return;
      }

      morphWeights[morphTarget] = Math.max(
        Number(morphWeights[morphTarget] || 0),
        weight
      );
    });

    return morphWeights;
  }

  update(deltaMs) {
    if (!this.mediaElement || !this.amplitudeAnalyser) {
      return createEmptyFrame();
    }

    if (this.audioContext?.state === "suspended" && !this.mediaElement.paused) {
      void this.audioContext.resume().catch(() => {});
    }

    if (this.headAudio) {
      try {
        this.headAudio.update(Math.max(0, Number(deltaMs) || 0));
      } catch (error) {
        console.warn(
          `[AudioPlayer] HeadAudio update failed: ${error?.message || "unknown error"}`
        );
        this._disableHeadAudio();
      }
    }

    const amplitude = this.amplitudeAnalyser.getAmplitude();
    const visemeWeights = this._buildVisemeWeights();
    const visemeActive =
      Boolean(this.headAudio) &&
      (this.speechDetected ||
        Object.values(visemeWeights).some((value) => value > ACTIVE_WEIGHT_EPSILON));

    return {
      amplitude,
      visemeActive,
      visemeWeights
    };
  }

  resetState() {
    this.speechDetected = false;
    this.oculusVisemeWeights.clear();

    if (this.headAudio?.resetAll) {
      this.headAudio.resetAll();
    }
  }

  async dispose() {
    this.resetState();
    this._disableHeadAudio();

    if (this.delayNode) {
      try {
        this.delayNode.disconnect();
      } catch {
        // Ignore repeated disconnects.
      }
      this.delayNode = null;
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // Ignore repeated disconnects.
      }
      this.gainNode = null;
    }

    if (this.amplitudeAnalyser) {
      this.amplitudeAnalyser.disconnect();
      this.amplitudeAnalyser = null;
    }

    if (this.audioContext) {
      await this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.mediaElement = null;
    this.sourceNode = null;
    this.headAudioReadyPromise = null;
  }
}
