import fs from "node:fs";

const apiKey = process.env.MINIMAX_API_KEY || fs.readFileSync("C:/Users/caipe/Desktop/minimax.txt", "utf8").trim();
if (!apiKey) {
  console.error("VOICE_LIST_FAIL: missing MINIMAX_API_KEY");
  process.exit(1);
}

const response = await fetch("https://api.minimax.io/v1/get_voice", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    voice_type: "system"
  })
});

const data = await response.json();
if (!response.ok || data?.base_resp?.status_code !== 0) {
  console.error(JSON.stringify({ ok: false, status: response.status, data }, null, 2));
  process.exit(1);
}

const voices = (data.system_voice || []).map((voice) => ({
  voice_id: voice.voice_id,
  voice_name: voice.voice_name,
  description: Array.isArray(voice.description) ? voice.description.join(" ") : String(voice.description || "")
}));

console.log(JSON.stringify({ ok: true, count: voices.length, voices }, null, 2));
