import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("VOICE_DESIGN_V7_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "artifacts", "voice-design-v7");
fs.mkdirSync(outDir, { recursive: true });

const variants = [
  {
    voice_id: "Vela_v7_genki_neighbor",
    prompt: "元气满满的二次元少女，甜美活泼，清亮甜美的声线，语速稍快，带一点跳跃感，像阳光开朗的邻家妹妹，笑声可爱，偶尔夹杂“嘿嘿”“呀～”的语气词",
    preview_text: "嘿嘿，晚上好呀～我在呢，你慢慢说，我会认真听着的。"
  },
  {
    voice_id: "Vela_v8_soft_cute_genki",
    prompt: "二次元少女，甜美可爱，软萌少女音，元气满满，声音清脆甜腻，带一点鼻音，语速稍快，尾音上扬，像在撒娇",
    preview_text: "呀～晚上好呀，我在呢。你慢慢说给我听嘛，我会一直听着的。"
  }
];

async function generate(variant) {
  const response = await fetch("https://api.minimaxi.com/v1/voice_design", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: variant.prompt,
      preview_text: variant.preview_text,
      voice_id: variant.voice_id,
      aigc_watermark: false
    })
  });

  const data = await response.json();
  if (!response.ok || data?.base_resp?.status_code !== 0 || !data?.trial_audio) {
    return {
      ok: false,
      voice_id: variant.voice_id,
      status: response.status,
      data
    };
  }

  const outPath = path.join(outDir, `${variant.voice_id}.mp3`);
  fs.writeFileSync(outPath, Buffer.from(data.trial_audio, "hex"));
  return {
    ok: true,
    voice_id: data.voice_id,
    outPath,
    bytes: fs.statSync(outPath).size,
    preview_text: variant.preview_text
  };
}

const results = [];
for (const variant of variants) {
  results.push(await generate(variant));
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
