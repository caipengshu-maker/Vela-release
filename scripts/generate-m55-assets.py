"""
Vela M5.5 asset generation via Nano Banana Pro (Gemini 3 Pro Image Preview).
Generates: K Studio logo, day background, night background.
"""
import json
import urllib.request
import urllib.error
import base64
import sys
import os

API_KEY = "sk-YuUVYZZxgvBg77OIUz6lE5mCKQitjJWIxItYQcIDL5tRbi9D"
MODEL = "gemini-3-pro-image-preview"
BASE_URL = "https://cdn.12ai.org"
API_URL = f"{BASE_URL}/v1beta/models/{MODEL}:generateContent?key={API_KEY}"


def generate(prompt, filename, output_dir, aspect_ratio="16:9", image_size="2K"):
    os.makedirs(output_dir, exist_ok=True)
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {
                "aspectRatio": aspect_ratio,
                "imageSize": image_size
            }
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        print(f"FAIL [{filename}] HTTP {e.code}: {body[:500]}", file=sys.stderr)
        return None

    candidates = result.get("candidates", [])
    if not candidates:
        print(f"FAIL [{filename}] No candidates: {json.dumps(result)[:300]}", file=sys.stderr)
        return None

    parts_out = candidates[0].get("content", {}).get("parts", [])
    for part in parts_out:
        if "inlineData" in part:
            img_data = base64.b64decode(part["inlineData"]["data"])
            filepath = os.path.join(output_dir, filename)
            with open(filepath, "wb") as f:
                f.write(img_data)
            size_kb = len(img_data) // 1024
            print(f"OK: {filepath} ({size_kb} KB)")
            return filepath
        elif "text" in part:
            print(f"Text response: {part['text'][:200]}")

    print(f"FAIL [{filename}] No image in response", file=sys.stderr)
    return None


JOBS = [
    {
        "prompt": (
            "A clean, modern logo design on a pure white background. "
            "The text reads 'K Studio' in bold, sleek sans-serif typography. "
            "The 'K' is stylized with a subtle geometric design element - perhaps a small star or angular accent. "
            "Minimalist, high-end indie game studio aesthetic. "
            "Clean black text on white. No other elements, no decorations, no watermarks. "
            "Professional brand identity design, centered composition."
        ),
        "filename": "k-studio-logo.png",
        "output_dir": r"D:\Vela\assets\splash",
        "aspect_ratio": "16:9",
    },
    {
        "prompt": (
            "Anime illustration background for a visual novel / otome game companion app. "
            "A cozy, warm Japanese-style bedroom during daytime. "
            "Large floor-to-ceiling window on the left side showing bright blue sky with soft white clouds. "
            "Sheer white curtains gently flowing. Warm golden sunlight streaming in. "
            "A wooden desk on the right side with green potted plants, a coffee cup, and some books. "
            "Soft pastel color palette - warm yellows, light blues, cream whites. "
            "The CENTER of the image should be relatively EMPTY and UNCLUTTERED (this is where a character will stand). "
            "Details and furniture are placed on the SIDES and TOP of the composition. "
            "Clean anime art style, soft lighting, dreamy atmosphere. "
            "No characters, no people, no text. Background only. "
            "High quality, detailed anime illustration."
        ),
        "filename": "bg-day.png",
        "output_dir": r"D:\Vela\assets\backgrounds",
        "aspect_ratio": "16:9",
    },
    {
        "prompt": (
            "Anime illustration background for a visual novel / otome game companion app. "
            "The SAME cozy Japanese-style bedroom but at NIGHTTIME. "
            "The large window now shows a beautiful night sky with stars and a crescent moon, "
            "and distant soft city lights below. "
            "A warm desk lamp casts a soft orange-amber glow from the right side. "
            "Subtle fairy string lights or soft bokeh light spots add warmth. "
            "The room feels intimate, safe, and private. "
            "Warm color palette - deep navy blues, soft amber/orange lamp light, warm shadows. "
            "The CENTER of the image should be relatively EMPTY and UNCLUTTERED (character standing area). "
            "Details on SIDES and TOP. "
            "Clean anime art style, atmospheric night lighting, cozy mood. "
            "No characters, no people, no text. Background only. "
            "High quality, detailed anime illustration."
        ),
        "filename": "bg-night.png",
        "output_dir": r"D:\Vela\assets\backgrounds",
        "aspect_ratio": "16:9",
    },
]

if __name__ == "__main__":
    print(f"Model: {MODEL} via {BASE_URL}")
    print(f"Generating {len(JOBS)} assets...\n")

    results = []
    for i, job in enumerate(JOBS, 1):
        print(f"[{i}/{len(JOBS)}] {job['filename']}...")
        path = generate(
            job["prompt"], job["filename"], job["output_dir"],
            aspect_ratio=job.get("aspect_ratio", "16:9"),
            image_size=job.get("image_size", "2K"),
        )
        results.append((job["filename"], path))
        print()

    print("=" * 50)
    print("Summary:")
    for name, path in results:
        status = "✓" if path else "✗"
        print(f"  {status} {name}: {path or 'FAILED'}")
