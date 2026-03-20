import WebSocket from "ws";
import {
  normalizeTtsEmotionMode,
  resolveMiniMaxSpeechModelForEmotion,
  supportsMiniMaxProviderEmotion,
  TTS_IDLE_TIMEOUT_MS
} from "../../interaction-contract.js";

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject
  };
}

function toStatusError(message, payload = null) {
  const error = new Error(message);
  error.payload = payload;
  return error;
}

function resolveVoiceSetting(ttsConfig, presetMeta = {}) {
  const requestedEmotionMode = normalizeTtsEmotionMode(
    presetMeta.emotionMode,
    presetMeta.providerEmotion
  );
  const emotion =
    requestedEmotionMode === "force" ? presetMeta.providerEmotion || null : null;
  const emotionMode = emotion ? "force" : "auto";
  let resolvedEmotion = emotion;

  if (resolvedEmotion && !supportsMiniMaxProviderEmotion(ttsConfig.model, resolvedEmotion)) {
    resolvedEmotion = presetMeta.fallbackProviderEmotion || "calm";
  }

  const voiceSetting = {
    voice_id: ttsConfig.voiceId,
    emotion_mode: emotionMode,
    speed: ttsConfig.voiceSettings.speed,
    vol: ttsConfig.voiceSettings.volume,
    pitch: ttsConfig.voiceSettings.pitch,
    english_normalization: Boolean(
      ttsConfig.voiceSettings.englishNormalization
    )
  };

  if (resolvedEmotion) {
    voiceSetting.emotion = resolvedEmotion;
  }

  return voiceSetting;
}

export function resolveMiniMaxTaskStartModel(ttsConfig, presetMeta = {}) {
  const configuredModel = String(ttsConfig.model || "speech-2.8-turbo").trim();
  const emotionMode = normalizeTtsEmotionMode(
    presetMeta.emotionMode,
    presetMeta.providerEmotion
  );

  if (emotionMode !== "force" || !presetMeta.providerEmotion) {
    return configuredModel;
  }

  return resolveMiniMaxSpeechModelForEmotion(
    configuredModel,
    presetMeta.providerEmotion || null
  );
}

export function buildMiniMaxTaskStartPayload(ttsConfig, presetMeta = {}) {
  const taskStartModel = resolveMiniMaxTaskStartModel(ttsConfig, presetMeta);
  const taskStartConfig = {
    ...ttsConfig,
    model: taskStartModel
  };

  return {
    event: "task_start",
    model: taskStartModel,
    language_boost: taskStartConfig.languageBoost,
    voice_setting: resolveVoiceSetting(taskStartConfig, presetMeta),
    audio_setting: resolveAudioSetting(taskStartConfig)
  };
}

function resolveAudioSetting(ttsConfig) {
  return {
    sample_rate: ttsConfig.audioSettings.sampleRate,
    bitrate: ttsConfig.audioSettings.bitrate,
    format: ttsConfig.audioSettings.format,
    channel: ttsConfig.audioSettings.channel
  };
}

function mimeTypeFromFormat(format) {
  switch (String(format || "").toLowerCase()) {
    case "wav":
      return "audio/wav";
    case "pcm":
      return "audio/L16";
    case "flac":
      return "audio/flac";
    case "mp3":
    default:
      return "audio/mpeg";
  }
}

function defaultWebSocketFactory(url, options) {
  return new WebSocket(url, options);
}

export class MiniMaxWebSocketTtsSession {
  constructor({
    config,
    apiKey,
    onEvent,
    webSocketFactory = defaultWebSocketFactory,
    now = () => Date.now()
  }) {
    this.config = config;
    this.apiKey = apiKey;
    this.onEvent = onEvent;
    this.webSocketFactory = webSocketFactory;
    this.now = now;
    this.socket = null;
    this.sessionId = null;
    this.closed = false;
    this.doneEmitted = false;
    this.startPromise = null;
    this.taskStarted = false;
    this.taskStartedDeferred = null;
    this.finishDeferred = null;
    this.finishRequested = false;
    this.cancelled = false;
    this.lastServerEventAt = 0;
    this.segmentQueue = [];
    this.startPresetMeta = null;
  }

  emit(event) {
    if (!this.closed || event.type === "done" || event.type === "error") {
      this.onEvent?.(event);
    }
  }

  isSocketUsable() {
    return Boolean(
      this.socket &&
        this.socket.readyState === WebSocket.OPEN &&
        this.taskStarted
    );
  }

  isStale() {
    return Boolean(
      this.lastServerEventAt &&
        this.now() - this.lastServerEventAt > TTS_IDLE_TIMEOUT_MS - 5_000
    );
  }

  async ensureSession(presetMeta = null) {
    if (this.closed) {
      throw new Error("TTS session is already closed");
    }

    if (this.isSocketUsable() && !this.isStale()) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPresetMeta = presetMeta || this.startPresetMeta || {};
    this.startPromise = this.connect();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async connect() {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`
    };

    this.taskStarted = false;
    this.taskStartedDeferred = createDeferred();
    this.finishDeferred = createDeferred();
    this.finishRequested = false;

    const socket = this.webSocketFactory(this.config.tts.wsUrl, { headers });
    this.socket = socket;

    this.emit({
      type: "status",
      status: "connecting"
    });

    socket.on("message", (rawMessage) => {
      let payload;

      try {
        payload = JSON.parse(String(rawMessage));
      } catch (parseError) {
        this.handleError(parseError);
        return;
      }

      this.handleMessage(payload);
    });

    socket.once("error", (error) => {
      this.handleError(error);
    });

    socket.once("close", () => {
      if (!this.taskStarted && this.taskStartedDeferred) {
        this.taskStartedDeferred.reject(
          toStatusError("MiniMax TTS socket closed before task_started")
        );
      }

      if (this.finishRequested || this.cancelled) {
        this.finishDeferred?.resolve();
      }

      if (this.cancelled) {
        this.emitDone({ cancelled: true });
      }
    });

    await this.taskStartedDeferred.promise;
  }

  handleMessage(payload) {
    this.lastServerEventAt = this.now();

    const statusCode = payload.base_resp?.status_code;
    if (statusCode && statusCode !== 0) {
      this.handleError(
        toStatusError(
          payload.base_resp?.status_msg || "MiniMax TTS failed",
          payload
        )
      );
      return;
    }

    if (payload.session_id) {
      this.sessionId = payload.session_id;
    }

    switch (payload.event) {
      case "connected_success":
        this.emit({
          type: "status",
          status: "connected",
          sessionId: this.sessionId
        });
        this.sendTaskStart();
        break;
      case "task_started":
        this.taskStarted = true;
        this.emit({
          type: "status",
          status: "ready",
          sessionId: this.sessionId
        });
        this.taskStartedDeferred?.resolve();
        break;
      case "task_continued":
        if (payload.data?.audio) {
          this.emit({
            type: "audio-chunk",
            hex: payload.data.audio,
            sessionId: this.sessionId,
            traceId: payload.trace_id || null,
            mimeType: mimeTypeFromFormat(payload.extra_info?.audio_format),
            sampleRate: payload.extra_info?.audio_sample_rate || null,
            channel: payload.extra_info?.audio_channel || null,
            isFinal: Boolean(payload.is_final)
          });
        }

        if (payload.is_final) {
          const completedSegment = this.segmentQueue.shift() || null;
          this.emit({
            type: "segment-complete",
            text: completedSegment?.text || "",
            segmentId: completedSegment?.segmentId || null,
            sessionId: this.sessionId,
            isFinal: true
          });
        }
        break;
      case "task_finished":
        this.finishDeferred?.resolve();
        this.emitDone({ cancelled: false });
        break;
      case "task_failed":
        this.handleError(
          toStatusError(
            payload.base_resp?.status_msg || "MiniMax task failed",
            payload
          )
        );
        break;
      default:
        break;
    }
  }

  sendTaskStart() {
    this.socket?.send(
      JSON.stringify(buildMiniMaxTaskStartPayload(this.config.tts, this.startPresetMeta))
    );
  }

  async start(meta = {}) {
    await this.ensureSession(meta.presetMeta);
  }

  async pushText(text, meta = {}) {
    const normalizedText = String(text || "").trim();
    if (!normalizedText || this.closed) {
      return;
    }

    await this.ensureSession(meta.presetMeta);

    this.segmentQueue.push({
      text: normalizedText,
      segmentId: meta.segmentId || null
    });
    this.emit({
      type: "status",
      status: "queued",
      sessionId: this.sessionId
    });
    this.emit({
      type: "segment-started",
      text: normalizedText,
      segmentId: meta.segmentId || null,
      sessionId: this.sessionId
    });
    this.socket?.send(
      JSON.stringify({
        event: "task_continue",
        text: normalizedText
      })
    );
  }

  async finish() {
    if (this.closed) {
      return;
    }

    await this.ensureSession();
    this.finishRequested = true;
    this.emit({
      type: "status",
      status: "finishing",
      sessionId: this.sessionId
    });
    this.socket?.send(
      JSON.stringify({
        event: "task_finish"
      })
    );
    await this.finishDeferred.promise;
    this.socket?.close();
    this.closed = true;
  }

  async cancel() {
    if (this.closed) {
      return;
    }

    this.cancelled = true;
    this.socket?.close();
    this.closed = true;
    this.emitDone({ cancelled: true });
  }

  handleError(error) {
    this.taskStartedDeferred?.reject(error);
    this.finishDeferred?.resolve();
    this.emit({
      type: "error",
      message: error.message || "MiniMax TTS connection failed"
    });
    this.socket?.close();
    this.closed = true;
  }

  emitDone({ cancelled }) {
    if (this.doneEmitted) {
      return;
    }

    this.doneEmitted = true;
    this.emit({
      type: "done",
      sessionId: this.sessionId,
      cancelled: Boolean(cancelled)
    });
  }
}

export const minimaxWebSocketTtsProvider = {
  id: "minimax-websocket",
  label: "MiniMax WebSocket TTS",
  defaultApiKeyEnv: "MINIMAX_API_KEY",
  requiresApiKey: true,
  capabilities: {
    streamAudio: true,
    acceptsTextDeltas: true
  },
  createSession({ config, apiKey, onEvent, webSocketFactory }) {
    return new MiniMaxWebSocketTtsSession({
      config,
      apiKey,
      onEvent,
      webSocketFactory
    });
  }
};
