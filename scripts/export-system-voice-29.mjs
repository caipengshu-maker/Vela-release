import fs from "node:fs";
import path from "node:path";
import { MiniMaxWebSocketTtsSession } from "../src/core/tts/providers/minimax-websocket.js";

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("SYSTEM_VOICE_29_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

// Per official system voice list previously fetched: No.29 = English_ImposingManner / Imposing Queen.
const voiceId = "English_ImposingManner";
const outDir = path.join(process.cwd(), "artifacts", "system-voice");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "system-voice-29-English_ImposingManner.mp3");

const chunks = [];
const session = new MiniMaxWebSocketTtsSession({
  config: {
    tts: {
      wsUrl: "wss://api.minimaxi.com/ws/v1/t2a_v2",
      model: "speech-2.8-turbo",
      languageBoost: "English",
      voiceId,
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
    if (event.type === "audio-chunk" && event.hex) {
      chunks.push(Buffer.from(event.hex, "hex"));
    }
  }
});

try {
  await session.start({ presetMeta: { providerEmotion: "calm", fallbackProviderEmotion: "calm" } });
  await session.pushText("Hello there. This is the current MiniMax system voice number twenty nine sample.", {
    segmentId: 1,
    presetMeta: { providerEmotion: "calm", fallbackProviderEmotion: "calm" }
  });
  await session.finish();

  if (!chunks.length) {
    console.error(JSON.stringify({ ok: false, voiceId, message: "No audio chunks received" }, null, 2));
    process.exit(1);
  }

  fs.writeFileSync(outPath, Buffer.concat(chunks));
  console.log(JSON.stringify({ ok: true, voiceId, outPath, bytes: fs.statSync(outPath).size }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, voiceId, message: error?.message || String(error), payload: error?.payload || null }, null, 2));
  process.exit(1);
}
