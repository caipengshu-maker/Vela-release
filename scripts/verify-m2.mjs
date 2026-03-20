import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { VelaCore } from "../src/core/vela-core.js";
import { loadConfig } from "../src/core/config.js";
import { resolveInteractionPlan } from "../src/core/interaction-policy.js";
import { openAiCompatibleAdapter } from "../src/core/providers/adapters/openai-compatible.js";
import { anthropicMessagesAdapter } from "../src/core/providers/adapters/anthropic-messages.js";
import { resolveRequestTuning } from "../src/core/providers/thinking-mode.js";
import { splitSpeechSegment } from "../src/core/tts/segmenter.js";
import {
  buildMiniMaxTaskStartPayload,
  MiniMaxWebSocketTtsSession
} from "../src/core/tts/providers/minimax-websocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function extractPhases(events) {
  return events
    .filter((event) => event.type === "assistant-state")
    .map((event) => event.status?.phase)
    .filter(Boolean);
}

function createDemoTtsConfig(overrides = {}) {
  return {
    model: "speech-2.8-turbo",
    languageBoost: "Chinese",
    voiceId: "demo-voice",
    voiceSettings: {
      speed: 1,
      volume: 1,
      pitch: 0,
      englishNormalization: false
    },
    audioSettings: {
      format: "mp3",
      sampleRate: 32000,
      bitrate: 128000,
      channel: 1
    },
    ...overrides
  };
}

function createSpeakingPlan({
  intent,
  history = {},
  relationshipStage = "warm",
  ttsModel = "speech-2.8-turbo",
  lastActiveAt = "2026-03-20T11:55:00.000Z",
  now = new Date("2026-03-20T12:00:00.000Z")
}) {
  return resolveInteractionPlan({
    intent,
    presence: "speaking",
    voiceModeEnabled: true,
    ttsCapabilities: {
      available: true
    },
    ttsModel,
    relationshipStage,
    lastActiveAt,
    history: {
      lastEmotion: "calm",
      lastAction: "none",
      lastCamera: "wide",
      lastTtsEmotionMode: "auto",
      lastCameraChangedAt: 0,
      ...history
    },
    now
  });
}

function verifyThinkingModeMapping() {
  const baseConfig = {
    llm: {
      temperature: 0.9,
      maxTokens: 260,
      thinking: {
        enabled: true,
        budgetTokens: 512
      }
    }
  };

  const openAiDeep = resolveRequestTuning({
    adapter: openAiCompatibleAdapter,
    config: baseConfig,
    thinkingMode: "deep"
  });
  assert.equal(openAiDeep.mode, "deep");
  assert.equal(openAiDeep.reasoningEffort, "high");
  assert.ok(openAiDeep.maxTokens > 260);

  const anthropicFast = resolveRequestTuning({
    adapter: anthropicMessagesAdapter,
    config: baseConfig,
    thinkingMode: "fast"
  });
  assert.equal(anthropicFast.mode, "fast");
  assert.equal(anthropicFast.thinking.enabled, false);
}

function verifySegmenter() {
  const first = splitSpeechSegment(
    "hello there, this should split after a sensible clause. next part"
  );
  assert.equal(first.segment, "hello there, this should");
  assert.equal(first.rest, "split after a sensible clause. next part");

  const forced = splitSpeechSegment("final bit", { force: true });
  assert.equal(forced.segment, "final bit");
  assert.equal(forced.rest, "");
}

async function verifyMixedEmotionRouting() {
  const autoPlan = createSpeakingPlan({
    intent: {
      replyText: "好呀，我会接着你说。",
      thinkingMode: "balanced",
      emotionIntent: "happy",
      cameraIntent: "wide",
      actionIntent: "nod"
    }
  });
  assert.equal(autoPlan.ttsPreset, "happy");
  assert.equal(autoPlan.ttsEmotionMode, "auto");
  assert.equal(autoPlan.ttsProviderEmotion, null);
  assert.equal(autoPlan.ttsForceReason, null);

  const autoPayload = buildMiniMaxTaskStartPayload(createDemoTtsConfig(), {
    emotionMode: autoPlan.ttsEmotionMode,
    providerEmotion: autoPlan.ttsProviderEmotion,
    fallbackProviderEmotion: "calm"
  });
  assert.equal(autoPayload.model, "speech-2.8-turbo");
  assert.equal(autoPayload.voice_setting.emotion_mode, "auto");
  assert.ok(!("emotion" in autoPayload.voice_setting));

  const forcePlan = createSpeakingPlan({
    relationshipStage: "close",
    ttsModel: "speech-2.6-turbo",
    intent: {
      replyText: "我只跟你小声说这一句。",
      thinkingMode: "balanced",
      emotionIntent: "whisper",
      cameraIntent: "close",
      actionIntent: "lean-in"
    }
  });
  assert.equal(forcePlan.ttsPreset, "whisper");
  assert.equal(forcePlan.ttsEmotionMode, "force");
  assert.equal(forcePlan.ttsProviderEmotion, "whisper");
  assert.equal(forcePlan.ttsForceReason, "explicit");

  const forcePayload = buildMiniMaxTaskStartPayload(
    createDemoTtsConfig({
      model: "speech-2.6-turbo"
    }),
    {
      emotionMode: forcePlan.ttsEmotionMode,
      providerEmotion: forcePlan.ttsProviderEmotion,
      fallbackProviderEmotion: "calm"
    }
  );
  assert.equal(forcePayload.model, "speech-2.6-turbo");
  assert.equal(forcePayload.voice_setting.emotion_mode, "force");
  assert.equal(forcePayload.voice_setting.emotion, "whisper");

  const constrainedPlan = createSpeakingPlan({
    relationshipStage: "reserved",
    intent: {
      replyText: "我只跟你小声说这一句。",
      thinkingMode: "balanced",
      emotionIntent: "whisper",
      cameraIntent: "close",
      actionIntent: "lean-in"
    }
  });
  assert.equal(constrainedPlan.emotion, "calm");
  assert.equal(constrainedPlan.ttsEmotionMode, "force");
  assert.equal(constrainedPlan.ttsProviderEmotion, "calm");
  assert.equal(constrainedPlan.ttsForceReason, "constrained");

  const continuityPlan = createSpeakingPlan({
    history: {
      lastEmotion: "concerned",
      lastTtsEmotionMode: "force"
    },
    intent: {
      replyText: "我在，我们一点点说。",
      thinkingMode: "balanced",
      emotionIntent: "concerned",
      cameraIntent: "close",
      actionIntent: "lean-in"
    }
  });
  assert.equal(continuityPlan.ttsEmotionMode, "force");
  assert.equal(continuityPlan.ttsProviderEmotion, "calm");
  assert.equal(continuityPlan.ttsForceReason, "continuity");
}

async function verifyMiniMaxEmotionGuards() {
  const whisperPayload = buildMiniMaxTaskStartPayload(
    createDemoTtsConfig({
      model: "speech-2.8-turbo"
    }),
    {
      emotionMode: "force",
      providerEmotion: "whisper",
      fallbackProviderEmotion: "calm"
    }
  );
  assert.equal(whisperPayload.model, "speech-2.6-turbo");
  assert.equal(whisperPayload.voice_setting.emotion_mode, "force");
  assert.equal(whisperPayload.voice_setting.emotion, "whisper");

  const fluentPayload = buildMiniMaxTaskStartPayload(
    createDemoTtsConfig({
      model: "speech-2.8-hd"
    }),
    {
      emotionMode: "force",
      providerEmotion: "fluent",
      fallbackProviderEmotion: "calm"
    }
  );
  assert.equal(fluentPayload.model, "speech-2.6-hd");
  assert.equal(fluentPayload.voice_setting.emotion_mode, "force");
  assert.equal(fluentPayload.voice_setting.emotion, "fluent");
}

async function verifyDefaultVoiceLock() {
  const config = await loadConfig(rootDir);
  assert.equal(config.tts.voiceId, "Chinese (Mandarin)_Sweet_Lady");

  const payload = buildMiniMaxTaskStartPayload(config.tts, {
    emotionMode: "auto"
  });
  assert.equal(payload.voice_setting.voice_id, "Chinese (Mandarin)_Sweet_Lady");
  assert.equal(payload.voice_setting.emotion_mode, "auto");
  assert.ok(!("emotion" in payload.voice_setting));
}

async function verifyCoreFlow() {
  const core = new VelaCore({
    rootDir,
    userDataDir: rootDir
  });

  await core.initialize();
  const bootstrap = await core.getBootstrapState();

  if (bootstrap.onboarding?.required) {
    await core.completeOnboarding({
      velaName: "Vela",
      userName: "Verifier",
      temperament: "gentle-cool",
      distance: "warm"
    });
  }

  const thinkingState = await core.setThinkingMode("deep");
  assert.equal(thinkingState.thinkingMode, "deep");

  const voiceState = await core.setVoiceMode(true);
  assert.equal(voiceState.voiceMode.enabled, true);
  assert.equal(voiceState.status.phase, "listening");

  const events = [];
  const afterChat = await core.handleUserMessage(
    "Hey, I am a little tired today and want to explain things slowly.",
    {
      onEvent: (event) => {
        events.push(event);
      }
    }
  );

  await wait(4200);

  const streamEvents = events.filter(
    (event) => event.type === "assistant-stream-delta"
  );
  assert.ok(streamEvents.length >= 1);
  assert.ok(streamEvents.some((event) => typeof event.delta === "string" && event.delta.length > 0));
  const lastStreamContent = (
    streamEvents.at(-1)?.content || streamEvents.map((event) => event.delta || "").join("")
  ).trim();
  assert.equal(lastStreamContent, (afterChat.messages.at(-1)?.content || "").trim());
  assert.equal(afterChat.messages.at(-1)?.role, "assistant");
  assert.equal(afterChat.status.phase, "speaking");
  assert.ok(events.some((event) => event.type === "speech-state"));
  assert.ok(events.some((event) => event.type === "speech-finished"));

  const phases = extractPhases(events);
  assert.ok(phases.includes("thinking"));
  assert.ok(phases.includes("speaking"));
  assert.ok(phases.includes("listening"));

  const interruptEvents = [];
  await core.handleUserMessage(
    "One more turn please, and make it long enough to queue speech.",
    {
      onEvent: (event) => {
        interruptEvents.push(event);
      }
    }
  );
  const interruptedState = await core.interruptOutput({
    onEvent: (event) => {
      interruptEvents.push(event);
    }
  });
  await wait(80);

  assert.equal(interruptedState.status.phase, "listening");
  assert.ok(
    interruptEvents.some(
      (event) => event.type === "speech-finished" && event.cancelled
    )
  );
}

async function verifyMiniMaxWebSocketAdapter() {
  const warmupPayload = buildMiniMaxTaskStartPayload(
    createDemoTtsConfig(),
    {
      emotionMode: "force",
      providerEmotion: "whisper",
      fallbackProviderEmotion: "calm"
    }
  );
  assert.equal(warmupPayload.model, "speech-2.6-turbo");
  assert.equal(warmupPayload.voice_setting.emotion_mode, "force");
  assert.equal(warmupPayload.voice_setting.emotion, "whisper");

  const serverEvents = [];
  const server = new WebSocketServer({
    port: 0
  });
  const serverPort = await new Promise((resolve) => {
    server.on("listening", () => {
      resolve(server.address().port);
    });
  });

  server.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        event: "connected_success",
        base_resp: {
          status_code: 0,
          status_msg: "success"
        }
      })
    );

    socket.on("message", (rawMessage) => {
      const payload = JSON.parse(String(rawMessage));
      serverEvents.push(payload);

      if (payload.event === "task_start") {
        socket.send(
          JSON.stringify({
            event: "task_started",
            session_id: "mock-session",
            trace_id: "trace-start",
            base_resp: {
              status_code: 0,
              status_msg: "success"
            }
          })
        );
        return;
      }

      if (payload.event === "task_continue") {
        socket.send(
          JSON.stringify({
            event: "task_continued",
            session_id: "mock-session",
            trace_id: "trace-continue",
            data: {
              audio: "fffb"
            },
            extra_info: {
              audio_format: "mp3",
              audio_sample_rate: 32000,
              audio_channel: 1
            },
            is_final: true,
            base_resp: {
              status_code: 0,
              status_msg: "success"
            }
          })
        );
        return;
      }

      if (payload.event === "task_finish") {
        socket.send(
          JSON.stringify({
            event: "task_finished",
            session_id: "mock-session",
            trace_id: "trace-finish",
            base_resp: {
              status_code: 0,
              status_msg: "success"
            }
          })
        );
        socket.close();
      }
    });
  });

  const adapterEvents = [];
  const session = new MiniMaxWebSocketTtsSession({
    config: {
      tts: {
        ...createDemoTtsConfig({
          model: "speech-2.8-turbo"
        }),
        wsUrl: `ws://127.0.0.1:${serverPort}`,
      }
    },
    apiKey: "test-key",
    onEvent: (event) => {
      adapterEvents.push(event);
    }
  });

  await session.start({
    presetMeta: {
      emotionMode: "force",
      providerEmotion: "whisper",
      fallbackProviderEmotion: "calm"
    }
  });
  await session.pushText("hello", {
    segmentId: 1,
    presetMeta: {
      emotionMode: "force",
      providerEmotion: "whisper",
      fallbackProviderEmotion: "calm"
    }
  });
  await session.finish();
  await wait(40);
  await new Promise((resolve) => {
    server.close(() => resolve());
  });

  assert.deepEqual(
    serverEvents.map((event) => event.event),
    ["task_start", "task_continue", "task_finish"]
  );
  assert.equal(serverEvents[0].model, "speech-2.6-turbo");
  assert.equal(serverEvents[0].voice_setting.emotion_mode, "force");
  assert.equal(serverEvents[0].voice_setting.emotion, "whisper");
  assert.ok(
    adapterEvents.some((event) => event.type === "audio-chunk" && event.hex === "fffb")
  );
  assert.ok(
    adapterEvents.some((event) => event.type === "segment-complete" && event.segmentId === 1)
  );
  assert.ok(adapterEvents.some((event) => event.type === "done"));
}

async function run() {
  verifyThinkingModeMapping();
  verifySegmenter();
  await verifyMixedEmotionRouting();
  await verifyMiniMaxEmotionGuards();
  await verifyDefaultVoiceLock();
  await verifyCoreFlow();
  await verifyMiniMaxWebSocketAdapter();

  console.log("verify:m2 ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
