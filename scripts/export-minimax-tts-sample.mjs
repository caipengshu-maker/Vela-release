import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MiniMaxWebSocketTtsSession } from "../src/core/tts/providers/minimax-websocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "artifacts", "smoke");
fs.mkdirSync(outDir, { recursive: true });

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("EXPORT_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const chunks = [];
const events = [];
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
    if (event.type === "audio-chunk" && event.hex) {
      chunks.push(Buffer.from(event.hex, "hex"));
    }
  }
});

try {
  await session.start({
    presetMeta: {
      providerEmotion: "calm",
      fallbackProviderEmotion: "calm"
    }
  });

  await session.pushText("晚上好，这是一条给舒总试听的 Vela MiniMax 同步语音真烟测样本。", {
    segmentId: 1,
    presetMeta: {
      providerEmotion: "calm",
      fallbackProviderEmotion: "calm"
    }
  });

  await session.finish();

  if (!chunks.length) {
    console.error("EXPORT_FAIL: no audio chunks received");
    process.exit(1);
  }

  const audio = Buffer.concat(chunks);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `minimax-real-smoke-${stamp}.mp3`);
  fs.writeFileSync(outPath, audio);

  console.log(JSON.stringify({
    ok: true,
    outPath,
    bytes: audio.length,
    chunks: chunks.length
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    message: error?.message || String(error),
    payload: error?.payload || null
  }, null, 2));
  process.exit(1);
}
