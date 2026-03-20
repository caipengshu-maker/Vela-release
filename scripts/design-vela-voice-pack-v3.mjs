import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("VOICE_DESIGN_V3_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "artifacts", "voice-design-v3");
fs.mkdirSync(outDir, { recursive: true });

const previewText = "晚上好呀，我在呢。你慢慢说，我会认真听着。先听听这条声音，看看她像不像你想要的 Vela。";

const variants = [
  {
    voice_id: "Vela_v4_anime_sweet",
    prompt: "中文年轻少女音色，二次元乙游女主风格，甜美、轻盈、清亮、灵动，带自然亲近感和轻微撒娇感。声音像一位让人有好感的甜妹角色，年轻、柔软、透亮，语气里有温柔笑意和陪伴感。说话自然顺滑，尾音轻柔，节奏舒服，能让人感到放松和被在意。整体气质是可爱、甜润、干净、明亮、少女感强，但仍然流畅自然，适合陪伴型对话。"
  },
  {
    voice_id: "Vela_v5_anime_soft_companion",
    prompt: "中文年轻女性音色，二次元感明显，像温柔甜妹角色。声音清甜、柔和、明亮，带轻轻的少女感和亲密感，听起来灵气、细腻、治愈。说话方式自然、轻柔、顺滑，带一点点软糯和可爱，像在认真陪你聊天的甜妹。整体效果要偏年轻、偏甜、偏动画角色感，同时保持清晰、舒服、耐听，适合长时间陪伴对话。"
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
