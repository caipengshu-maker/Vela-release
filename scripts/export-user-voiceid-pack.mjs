import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("USER_VOICE_PACK_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "artifacts", "user-voice-pack");
fs.mkdirSync(outDir, { recursive: true });

const sampleText = "晚上好呀，我在呢。你慢慢说给我听嘛，我会一直陪着你的，嘿嘿。";
const voices = [
  "female-tianmei-jingpin",
  "female-shaonv-jingpin",
  "Chinese (Mandarin)_Sweet_Lady",
  "diadia_xuemei",
  "qiaopi_mengmei"
];

async function synthesize(voiceId) {
  const response = await fetch("https://api.minimaxi.com/v1/t2a_v2", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "speech-2.8-turbo",
      text: sampleText,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed: 1,
        vol: 1,
        pitch: 0,
        emotion: "happy"
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1
      },
      subtitle_enable: false
    })
  });

  const data = await response.json();
  const base = data?.base_resp || {};
  if (!response.ok || base.status_code !== 0 || !data?.data?.audio) {
    return {
      ok: false,
      voiceId,
      status: response.status,
      status_code: base.status_code ?? null,
      status_msg: base.status_msg ?? null
    };
  }

  const safeName = voiceId.replace(/[\\/:*?"<>| ]+/g, "_");
  const outPath = path.join(outDir, `${safeName}.mp3`);
  fs.writeFileSync(outPath, Buffer.from(data.data.audio, "hex"));
  return {
    ok: true,
    voiceId,
    outPath,
    bytes: fs.statSync(outPath).size
  };
}

const results = [];
for (const voiceId of voices) {
  results.push(await synthesize(voiceId));
}

console.log(JSON.stringify({ ok: true, sampleText, results }, null, 2));
