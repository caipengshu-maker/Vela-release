import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MiniMaxWebSocketTtsSession } from "../src/core/tts/providers/minimax-websocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("SMOKE_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const events = [];
const chunks = [];
const session = new MiniMaxWebSocketTtsSession({
  config: {
    tts: {
      wsUrl: "wss://api.minimaxi.com/ws/v1/t2a_v2",
      model: "speech-2.8-turbo",
      languageBoost: "Chinese",
      voiceId: "moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85",
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
      }
    }
  },
  apiKey,
  onEvent: (event) => {
    events.push({ ...event, ts: Date.now() });
    if (event.type === "audio-chunk" && event.hex) chunks.push(event.hex);
  }
});

const start = Date.now();

try {
  await session.start({
    presetMeta: {
      providerEmotion: "calm",
      fallbackProviderEmotion: "calm"
    }
  });

  await session.pushText("晚上好，这是一条 Vela M2 的真实 MiniMax 同步语音烟测。", {
    segmentId: 1,
    presetMeta: {
      providerEmotion: "calm",
      fallbackProviderEmotion: "calm"
    }
  });

  await session.finish();

  const firstChunk = events.find((event) => event.type === "audio-chunk");
  const ready = events.find((event) => event.type === "status" && event.status === "ready");
  const finished = events.find((event) => event.type === "done");
  const error = events.find((event) => event.type === "error");

  const summary = {
    ok: !error && !!firstChunk && !!finished,
    wsUrl: "wss://api.minimaxi.com/ws/v1/t2a_v2",
    model: "speech-2.8-turbo",
    statusReadyMs: ready ? ready.ts - start : null,
    firstAudioChunkMs: firstChunk ? firstChunk.ts - start : null,
    totalDurationMs: Date.now() - start,
    audioChunkCount: chunks.length,
    firstChunkBytes: firstChunk?.hex ? Math.floor(firstChunk.hex.length / 2) : 0,
    sessionId: ready?.sessionId || firstChunk?.sessionId || finished?.sessionId || null,
    error: error?.message || null
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    stage: "exception",
    message: error?.message || String(error),
    payload: error?.payload || null
  }, null, 2));
  process.exit(1);
}
