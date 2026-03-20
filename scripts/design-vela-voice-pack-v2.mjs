import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("VOICE_DESIGN_V2_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "artifacts", "voice-design-v2");
fs.mkdirSync(outDir, { recursive: true });

const previewText = "晚上好呀，我在呢。你可以慢慢说，我会认真听着。先听听这条声音，看看她像不像你想要的 Vela。";

const variants = [
  {
    voice_id: "Vela_v2_sweet_young",
    prompt: "中文年轻女性声音，年龄感明确在十八到二十二岁之间。声音甜、轻、亮、通透，带自然少女感，但不要发嗲，不要做作，不要播音腔，不要客服感，也不要成熟稳重感。整体像二次元乙游里让人有好感的甜妹，但表达方式偏真实聊天，不夸张，不夹，不故意卖萌。咬字清楚，语气轻盈，尾音自然略软，听感要年轻、灵动、干净，有一点点让人放松的撒娇感，但底子仍然自然。"
  },
  {
    voice_id: "Vela_v3_soft_sweet_natural",
    prompt: "中文年轻女性声音，二十岁上下，温柔偏甜，但核心是自然、轻盈、干净。不要像中年女性，不要像播音员，不要像客服，不要过度成熟，也不要故意夹子音。要有少女感和亲近感，像一个声音很好听、说话轻轻的年轻女生，在深夜陪你聊天时会让人放松下来。语气柔和，亮度适中偏亮，气质干净、清透、温柔，略甜，但不过分。"
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
      preview_text: previewText,
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
    bytes: fs.statSync(outPath).size
  };
}

const results = [];
for (const variant of variants) {
  results.push(await generate(variant));
}

console.log(JSON.stringify({ ok: true, preview_text: previewText, results }, null, 2));
