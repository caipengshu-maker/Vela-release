import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MiniMaxWebSocketTtsSession } from "../src/core/tts/providers/minimax-websocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "artifacts", "voice-pack");
fs.mkdirSync(outDir, { recursive: true });

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("VOICE_PACK_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const SAMPLE_TEXT = "晚上好，我在。这是一条给舒总试听的 Vela 声线样本，你听听开口、顺滑度和陪伴感。";

const candidates = [
  { slug: "lyrical", voiceId: "Chinese (Mandarin)_Lyrical_Voice" },
  { slug: "hk-flight-attendant", voiceId: "Chinese (Mandarin)_HK_Flight_Attendant" },
  { slug: "moss-ce44", voiceId: "moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85" },
  { slug: "moss-aaa1", voiceId: "moss_audio_aaa1346a-7ce7-11f0-8e61-2e6e3c7ee85d" }
];

async function exportOne(candidate) {
  const chunks = [];
  const session = new MiniMaxWebSocketTtsSession({
    config: {
      tts: {
        wsUrl: "wss://api.minimaxi.com/ws/v1/t2a_v2",
        model: "speech-2.8-turbo",
        languageBoost: "Chinese",
        voiceId: candidate.voiceId,
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

  await session.start({
    presetMeta: {
      providerEmotion: "calm",
      fallbackProviderEmotion: "calm"
    }
  });
  await session.pushText(SAMPLE_TEXT, {
    segmentId: 1,
    presetMeta: {
      providerEmotion: "calm",
      fallbackProviderEmotion: "calm"
    }
  });
  await session.finish();

  if (!chunks.length) {
    throw new Error(`No audio chunks for ${candidate.voiceId}`);
  }

  const outPath = path.join(outDir, `${candidate.slug}.mp3`);
  fs.writeFileSync(outPath, Buffer.concat(chunks));
  return {
    slug: candidate.slug,
    voiceId: candidate.voiceId,
    outPath,
    bytes: fs.statSync(outPath).size
  };
}

const results = [];
for (const candidate of candidates) {
  try {
    results.push({ ok: true, ...(await exportOne(candidate)) });
  } catch (error) {
    results.push({ ok: false, slug: candidate.slug, voiceId: candidate.voiceId, message: error?.message || String(error) });
  }
}

console.log(JSON.stringify({ ok: true, sampleText: SAMPLE_TEXT, results }, null, 2));
