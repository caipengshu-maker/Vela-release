import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("VOICE_DESIGN_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const prompt = "年轻女性的中文声音，二十岁出头，声线甜润但克制，温柔亲近，带一点轻柔的少女感和陪伴感。说话自然、清晰、放松，不夹、不做作，不像播音员，也不像客服。整体气质是温暖、安静、愿意认真听人说话，能给人被接住的感觉。语速中等偏慢一点，咬字清楚，尾音自然，情绪表达细腻，但不过度夸张。像一个会陪你深夜聊天、温柔回应你、让人放松下来的年轻女生。";
const previewText = "晚上好，我在。你可以慢慢说，我会接着你。先听听这条声音，看看她像不像你想要的 Vela。";
const voiceId = "Vela_v1_sweet_companion";

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
const outDir = path.join(process.cwd(), "artifacts", "voice-design");
fs.mkdirSync(outDir, { recursive: true });

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
