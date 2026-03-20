import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("VOICE_DESIGN_V6_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "artifacts", "voice-design-v6");
fs.mkdirSync(outDir, { recursive: true });

const voiceId = "Vela_v6_super_sweet_brattish";
const prompt = "成年女性音色，甜妹音色，超级甜腻，嗲嗲的，撒娇感极强，声音软软糯糯，带鼻音和轻微喘息感，语调活泼俏皮，像动漫里的傲娇小恶魔或甜心女友在哄人，尾音总是上翘。整体听感要甜、软、黏、可爱、会撩人，但仍然清晰顺滑，适合中文对话。";
const previewText = "晚上好呀，我在呢。别急嘛，我会一直陪着你，你慢慢说给我听，好不好？";

const response = await fetch("https://api.minimaxi.com/v1/voice_design", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    prompt,
    preview_text: previewText,
    voice_id: voiceId,
    aigc_watermark: false
  })
});

const data = await response.json();
if (!response.ok || data?.base_resp?.status_code !== 0 || !data?.trial_audio) {
  console.error(JSON.stringify({ ok: false, status: response.status, data }, null, 2));
  process.exit(1);
}

const outPath = path.join(outDir, `${voiceId}.mp3`);
fs.writeFileSync(outPath, Buffer.from(data.trial_audio, "hex"));

console.log(JSON.stringify({
  ok: true,
  voice_id: data.voice_id,
  outPath,
  bytes: fs.statSync(outPath).size,
  preview_text: previewText
}, null, 2));
