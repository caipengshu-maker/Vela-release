// Generate a "Vela" wordmark logo as PNG using node-canvas
// Style: elegant serif + subtle glow + decorative star accents
import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = "D:\\Vela\\assets\\splash";
const WIDTH = 1920;
const HEIGHT = 1080;

function drawStar(ctx, cx, cy, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.2;
  // Vertical line
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  // Horizontal line (shorter)
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy);
  ctx.lineTo(cx + r * 0.5, cy);
  ctx.stroke();
  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx, cx, cy, size, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * 0.45, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size * 0.45, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");

// Background: pure black
ctx.fillStyle = "#000000";
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Subtle radial gradient overlay for depth
const grad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, 540);
grad.addColorStop(0, "rgba(30, 28, 35, 0.8)");
grad.addColorStop(1, "rgba(0, 0, 0, 0)");
ctx.fillStyle = grad;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Main text: "Vela"
const fontSize = 128;
ctx.textAlign = "center";
ctx.textBaseline = "middle";

// Text glow layers (outer to inner)
const glowLayers = [
  { blur: 40, alpha: 0.08, color: "#c8b8a8" },
  { blur: 20, alpha: 0.12, color: "#d4c4b0" },
  { blur: 10, alpha: 0.18, color: "#e0d0c0" },
  { blur: 4, alpha: 0.3, color: "#ebe0d4" },
];

const textY = HEIGHT / 2 - 20;

for (const layer of glowLayers) {
  ctx.save();
  ctx.shadowColor = layer.color;
  ctx.shadowBlur = layer.blur;
  ctx.globalAlpha = layer.alpha;
  ctx.fillStyle = layer.color;
  ctx.font = `300 ${fontSize}px "Georgia", "Times New Roman", serif`;
  // Letter spacing simulation
  const letters = ["V", "e", "l", "a"];
  const spacing = 18;
  const totalWidth = letters.reduce((sum, l) => sum + ctx.measureText(l).width + spacing, -spacing);
  let x = WIDTH / 2 - totalWidth / 2;
  for (const letter of letters) {
    const w = ctx.measureText(letter).width;
    ctx.fillText(letter, x + w / 2, textY);
    x += w + spacing;
  }
  ctx.restore();
}

// Main text (crisp)
ctx.save();
ctx.globalAlpha = 0.92;
ctx.fillStyle = "#f0e8e0";
ctx.font = `300 ${fontSize}px "Georgia", "Times New Roman", serif`;
const letters = ["V", "e", "l", "a"];
const spacing = 18;
const totalWidth = letters.reduce((sum, l) => sum + ctx.measureText(l).width + spacing, -spacing);
let x = WIDTH / 2 - totalWidth / 2;
for (const letter of letters) {
  const w = ctx.measureText(letter).width;
  ctx.fillText(letter, x + w / 2, textY);
  x += w + spacing;
}
ctx.restore();

// Decorative elements: diamond + stars flanking the text
const decoY = textY;
const leftEdge = WIDTH / 2 - totalWidth / 2 - 60;
const rightEdge = WIDTH / 2 + totalWidth / 2 + 60;

// Thin horizontal lines extending from diamonds
ctx.save();
ctx.strokeStyle = "rgba(200, 190, 178, 0.25)";
ctx.lineWidth = 0.8;
// Left line
ctx.beginPath();
ctx.moveTo(leftEdge - 120, decoY);
ctx.lineTo(leftEdge - 10, decoY);
ctx.stroke();
// Right line
ctx.beginPath();
ctx.moveTo(rightEdge + 10, decoY);
ctx.lineTo(rightEdge + 120, decoY);
ctx.stroke();
ctx.restore();

// Diamonds at line ends
drawDiamond(ctx, leftEdge - 8, decoY, 6, "#c8b8a8", 0.5);
drawDiamond(ctx, rightEdge + 8, decoY, 6, "#c8b8a8", 0.5);

// Small stars further out
drawStar(ctx, leftEdge - 130, decoY, 10, "#a09888", 0.35);
drawStar(ctx, rightEdge + 130, decoY, 10, "#a09888", 0.35);

// Subtle tagline below
ctx.save();
ctx.globalAlpha = 0.22;
ctx.fillStyle = "#b8a898";
ctx.font = `300 16px "Georgia", "Times New Roman", serif`;
ctx.textAlign = "center";
ctx.fillText("Your companion, always here.", WIDTH / 2, textY + 90);
ctx.restore();

// Save
mkdirSync(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, "vela-title-logo.png");
writeFileSync(outPath, canvas.toBuffer("image/png"));
console.log(`Saved: ${outPath} (${canvas.toBuffer("image/png").length} bytes)`);
