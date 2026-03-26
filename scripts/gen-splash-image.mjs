// Generate Vela splash screen image via MiniMax image-01 API
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API_KEY = "sk-cp-Kit5f2b4vHQOPuiuuHcgehqhNdZzldOb4oRvUi0ztvMuqfZngUHu1SC3nZGpFjVyV4FFbhkzhqGY1-eMDWEQheFZZWDlca8pswRVNINGkDcjVe7KMmO4J_8";
const API_URL = "https://api.minimaxi.com/v1/image_generation";
const OUT_DIR = "D:\\Vela\\assets\\splash";

const prompt = `A tasteful anime-style title screen illustration. A young woman with long flowing hair sits by a large window in a softly lit, cozy room at twilight. Warm amber light filters through sheer curtains. She gazes gently toward the viewer with a subtle, serene smile. The scene is minimalist and elegant — muted pastel tones, soft bokeh lights outside the window, delicate shadows. Art style: high-quality anime key visual, similar to Makoto Shinkai films. Clean composition with breathing room for UI overlay text. Aspect ratio 16:9, cinematic framing. No text or logos in the image.`;

async function main() {
  console.log("Calling MiniMax image-01 API...");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "image-01",
      prompt,
      aspect_ratio: "16:9",
      response_format: "base64",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`API error ${res.status}: ${body}`);
    process.exit(1);
  }

  const json = await res.json();
  const images = json?.data?.image_base64;

  if (!images || images.length === 0) {
    console.error("No images returned:", JSON.stringify(json, null, 2));
    process.exit(1);
  }

  for (let i = 0; i < images.length; i++) {
    const outPath = resolve(OUT_DIR, `vela-splash-${i}.jpg`);
    writeFileSync(outPath, Buffer.from(images[i], "base64"));
    console.log(`Saved: ${outPath} (${Buffer.from(images[i], "base64").length} bytes)`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
