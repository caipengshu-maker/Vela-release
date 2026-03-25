import { createTtsSession, getTtsCapabilities } from "./provider.js";
import { splitSpeechSegment } from "./segmenter.js";

function buildPresetMetaFromPlan(speechPlan) {
  if (!speechPlan) {
    return null;
  }

  const speedMultiplier = Number(speechPlan.ttsSpeedMultiplier);
  const pitchOffset = Number(speechPlan.ttsPitchOffset);

  return {
    presetId: speechPlan.ttsPreset,
    emotionMode: speechPlan.ttsEmotionMode || "auto",
    providerEmotion: speechPlan.ttsProviderEmotion || null,
    fallbackProviderEmotion: "calm",
    speedMultiplier: Number.isFinite(speedMultiplier) ? speedMultiplier : 1,
    pitchOffset: Number.isFinite(pitchOffset) ? pitchOffset : 0
  };
}

export class SpeechOrchestrator {
  constructor({ config, voiceModeEnabled, onEvent, webSocketFactory }) {
    this.config = config;
    this.voiceModeEnabled = voiceModeEnabled;
    this.onEvent = onEvent;
    this.webSocketFactory = webSocketFactory;
    this.capabilities = getTtsCapabilities(config);
    this.session = null;
    this.segmentIndex = 0;
    this.buffer = "";
    this.work = Promise.resolve();
    this.currentPresetMeta = null;
    this.runToken = 0;
    this.state = {
      provider: this.capabilities.id,
      label: this.capabilities.label,
      available: this.capabilities.available,
      status: voiceModeEnabled
        ? this.capabilities.available
          ? "primed"
          : "placeholder"
        : "idle",
      reason: this.capabilities.reason,
      pendingSegments: 0,
      lastError: null,
      sessionId: null,
      preset: null,
      emotionMode: null,
      providerEmotion: null
    };
  }

  emit(event) {
    this.onEvent?.(event);
  }

  emitState(overrides = {}) {
    this.state = {
      ...this.state,
      ...overrides
    };

    this.emit({
      type: "speech-state",
      speech: { ...this.state }
    });
  }

  async ensureSession(presetMeta = null) {
    if (this.session || !this.voiceModeEnabled) {
      return;
    }

    this.currentPresetMeta = presetMeta || this.currentPresetMeta;
    const session = createTtsSession({
      config: this.config,
      onEvent: (event) => {
        // Guard: ignore events from stale/replaced sessions
        if (this.session !== session) return;
        this.handleProviderEvent(event);
      },
      webSocketFactory: this.webSocketFactory
    });

    try {
      await session.start({
        presetMeta: this.currentPresetMeta
      });
      this.session = session;
    } catch (error) {
      console.warn("[speech-orchestrator] ensureSession start failed:", error?.message || error);
      try { session.cancel?.(); } catch (_) { /* best-effort cleanup */ }
      this.emitState({
        status: "idle",
        pendingSegments: 0,
        lastError: error?.message || String(error)
      });
      throw error;
    }
  }

  handleProviderEvent(event) {
    if (event.type === "status") {
      this.emitState({
        status: event.status,
        sessionId: event.sessionId || this.state.sessionId
      });
      return;
    }

    if (event.type === "segment-complete") {
      this.emitState({
        pendingSegments: Math.max(0, this.state.pendingSegments - 1)
      });
      this.emit({
        type: "speech-mark",
        text: event.text,
        segmentId: event.segmentId || null
      });
      return;
    }

    if (event.type === "audio-chunk") {
      this.emitState({
        status: "speaking",
        sessionId: event.sessionId || this.state.sessionId
      });
      this.emit({
        type: "speech-audio-chunk",
        chunk: event
      });
      return;
    }

    if (event.type === "done") {
      this.emitState({
        status: "idle",
        pendingSegments: 0,
        sessionId: event.sessionId || this.state.sessionId
      });
      this.emit({
        type: "speech-finished",
        sessionId: event.sessionId || this.state.sessionId,
        cancelled: Boolean(event.cancelled)
      });
      return;
    }

    if (event.type === "error") {
      this.emitState({
        status: "error",
        lastError: event.message
      });
      this.emit({
        type: "speech-error",
        message: event.message
      });
    }
  }

  async pushDelta(delta, speechPlan) {
    const token = this.runToken;

    this.work = this.work.then(async () => {
      if (token !== this.runToken || !this.voiceModeEnabled || !String(delta || "").trim()) {
        return;
      }

      const nextPresetMeta = buildPresetMetaFromPlan(speechPlan);
      if (
        nextPresetMeta &&
        (!this.currentPresetMeta ||
          (!this.session &&
            (this.currentPresetMeta.emotionMode !== nextPresetMeta.emotionMode ||
              this.currentPresetMeta.providerEmotion !== nextPresetMeta.providerEmotion ||
              this.currentPresetMeta.presetId !== nextPresetMeta.presetId ||
              (this.currentPresetMeta.emotionMode !== "force" &&
                nextPresetMeta.emotionMode === "force"))))
      ) {
        this.currentPresetMeta = nextPresetMeta;
        this.emitState({
          preset: nextPresetMeta.presetId,
          emotionMode: nextPresetMeta.emotionMode,
          providerEmotion: nextPresetMeta.providerEmotion
        });
      }

      this.buffer += delta;

      while (true) {
        if (token !== this.runToken) {
          return;
        }

        const { segment, rest } = splitSpeechSegment(this.buffer);
        if (!segment) {
          break;
        }

        this.buffer = rest;
        await this.dispatchSegment(segment);
      }
    });

    return this.work;
  }

  async dispatchSegment(segment) {
    if (!segment) {
      return;
    }

    await this.ensureSession(this.currentPresetMeta);
    this.segmentIndex += 1;
    this.emitState({
      status: this.capabilities.available ? "queued" : "placeholder",
      pendingSegments: this.state.pendingSegments + 1
    });
    try {
      await this.session.pushText(segment, {
        segmentId: this.segmentIndex,
        presetMeta: this.currentPresetMeta
      });
    } catch (error) {
      console.warn("[speech-orchestrator] dispatchSegment failed:", error?.message || error);
      const deadSession = this.session;
      this.session = null;
      try { deadSession?.cancel?.(); } catch (_) { /* best-effort cleanup */ }
      this.emitState({
        status: "idle",
        pendingSegments: 0,
        lastError: error?.message || String(error)
      });
    }
  }

  async finish() {
    const token = this.runToken;

    this.work = this.work.then(async () => {
      if (token !== this.runToken || !this.voiceModeEnabled) {
        this.emitState({
          status: "idle",
          pendingSegments: 0
        });
        return;
      }

      const { segment } = splitSpeechSegment(this.buffer, { force: true });
      this.buffer = "";

      if (segment) {
        await this.dispatchSegment(segment);
      }

      if (!this.session) {
        this.emitState({
          status: "idle",
          pendingSegments: 0
        });
        return;
      }

      try {
        await this.session.finish();
      } catch (error) {
        console.warn("[speech-orchestrator] finish failed:", error?.message || error);
        const deadSession = this.session;
        this.session = null;
        try { deadSession?.cancel?.(); } catch (_) { /* best-effort cleanup */ }
        this.emitState({
          status: "idle",
          pendingSegments: 0,
          lastError: error?.message || String(error)
        });
      }
    });

    return this.work;
  }

  async cancel() {
    this.runToken += 1;
    this.buffer = "";
    this.currentPresetMeta = null;

    if (this.session) {
      await this.session.cancel();
      this.session = null;
    }

    this.emitState({
      status: "idle",
      pendingSegments: 0,
      preset: null,
      emotionMode: null,
      providerEmotion: null
    });
  }

  emitCurrentState() {
    this.emitState();
  }

  getState() {
    return { ...this.state };
  }
}
