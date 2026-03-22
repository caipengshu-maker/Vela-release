import fs from "node:fs";
import path from "node:path";

const VRM_PATH = "D:/Vela/assets/avatars/eku/Eku_VRM_v1_0_0.vrm";
const OUTPUT_PATH = path.resolve("docs/vrm-morph-targets.md");

const PRESET_NAME_MAP = {
  a: "aa",
  e: "ee",
  i: "ih",
  o: "oh",
  u: "ou",
  blink: "blink",
  joy: "happy",
  angry: "angry",
  sorrow: "sad",
  fun: "relaxed",
  lookup: "lookUp",
  lookdown: "lookDown",
  lookleft: "lookLeft",
  lookright: "lookRight",
  blink_l: "blinkLeft",
  blink_r: "blinkRight",
  neutral: "neutral"
};

function parseGlb(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = view.getUint32(0, true);
  const jsonLength = view.getUint32(12, true);
  const jsonStart = 20;

  if (magic !== 0x46546c67) {
    throw new Error("VRM file is not a valid GLB");
  }

  return JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer.buffer, buffer.byteOffset + jsonStart, jsonLength))
  );
}

function formatBindList(group, meshes) {
  return (group.binds || [])
    .map((bind) => {
      const mesh = meshes[bind.mesh];
      const targetName = mesh?.extras?.targetNames?.[bind.index] || `#${bind.index}`;
      return `${targetName} (${bind.weight})`;
    })
    .join(", ");
}

function buildMarkdown(gltf) {
  const meshes = Array.isArray(gltf.meshes) ? gltf.meshes : [];
  const groups = gltf.extensions?.VRM?.blendShapeMaster?.blendShapeGroups || [];
  const faceMesh = meshes.find((mesh) => Array.isArray(mesh?.extras?.targetNames) && mesh.extras.targetNames.length === 37);
  const faceTargets = faceMesh?.extras?.targetNames || [];
  const bodyBaseMesh = meshes.find((mesh) => Array.isArray(mesh?.extras?.targetNames) && mesh.extras.targetNames.length === 7);
  const bodyBaseTargets = bodyBaseMesh?.extras?.targetNames || [];

  const lines = [];
  lines.push("# VRM Morph Targets");
  lines.push("");
  lines.push("Generated from `D:/Vela/assets/avatars/eku/Eku_VRM_v1_0_0.vrm`.");
  lines.push("");
  lines.push("## Expression Manager Entries");
  lines.push("");
  lines.push("| Expression | Legacy preset | Binds |");
  lines.push("| --- | --- | --- |");
  groups.forEach((group) => {
    const preset = PRESET_NAME_MAP[String(group.presetName || "").toLowerCase()] || group.presetName || group.name || "(unnamed)";
    lines.push(`| \`${group.presetName || group.name || "(unnamed)"}\` | \`${preset}\` | ${formatBindList(group, meshes) || "(none)"} |`);
  });
  lines.push("");
  lines.push("## Raw Mesh Morph Targets");
  lines.push("");
  if (faceTargets.length) {
    lines.push("### Body");
    lines.push("");
    faceTargets.forEach((name, index) => {
      lines.push(`${index + 1}. \`${name}\``);
    });
    lines.push("");
  }

  if (bodyBaseTargets.length) {
    lines.push("### Body_base");
    lines.push("");
    bodyBaseTargets.forEach((name, index) => {
      lines.push(`${index + 1}. \`${name}\``);
    });
    lines.push("");
  }

  return lines.join("\n");
}

const gltf = parseGlb(fs.readFileSync(VRM_PATH));
const markdown = buildMarkdown(gltf);
fs.writeFileSync(OUTPUT_PATH, `${markdown}\n`, "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);
