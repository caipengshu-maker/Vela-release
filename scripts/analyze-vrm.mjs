import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";

const VRM_PATH = "D:/Vela/assets/avatars/eku/Eku_VRM_v1_0_0.vrm";
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const GLB_MAGIC = 0x46546c67;
const STANDARD_VRM1_BONES = [
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftThumbMetacarpal",
  "leftThumbProximal",
  "leftThumbDistal",
  "leftIndexProximal",
  "leftIndexIntermediate",
  "leftIndexDistal",
  "leftMiddleProximal",
  "leftMiddleIntermediate",
  "leftMiddleDistal",
  "leftRingProximal",
  "leftRingIntermediate",
  "leftRingDistal",
  "leftLittleProximal",
  "leftLittleIntermediate",
  "leftLittleDistal",
  "rightThumbMetacarpal",
  "rightThumbProximal",
  "rightThumbDistal",
  "rightIndexProximal",
  "rightIndexIntermediate",
  "rightIndexDistal",
  "rightMiddleProximal",
  "rightMiddleIntermediate",
  "rightMiddleDistal",
  "rightRingProximal",
  "rightRingIntermediate",
  "rightRingDistal",
  "rightLittleProximal",
  "rightLittleIntermediate",
  "rightLittleDistal"
];
const STANDARD_VRM0_BONES = [
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftThumbProximal",
  "leftThumbIntermediate",
  "leftThumbDistal",
  "leftIndexProximal",
  "leftIndexIntermediate",
  "leftIndexDistal",
  "leftMiddleProximal",
  "leftMiddleIntermediate",
  "leftMiddleDistal",
  "leftRingProximal",
  "leftRingIntermediate",
  "leftRingDistal",
  "leftLittleProximal",
  "leftLittleIntermediate",
  "leftLittleDistal",
  "rightThumbProximal",
  "rightThumbIntermediate",
  "rightThumbDistal",
  "rightIndexProximal",
  "rightIndexIntermediate",
  "rightIndexDistal",
  "rightMiddleProximal",
  "rightMiddleIntermediate",
  "rightMiddleDistal",
  "rightRingProximal",
  "rightRingIntermediate",
  "rightRingDistal",
  "rightLittleProximal",
  "rightLittleIntermediate",
  "rightLittleDistal"
];
const HAND_BONES = [
  "leftHand",
  "rightHand",
  "leftThumbProximal",
  "leftThumbIntermediate",
  "leftThumbDistal",
  "leftIndexProximal",
  "leftIndexIntermediate",
  "leftIndexDistal",
  "leftMiddleProximal",
  "leftMiddleIntermediate",
  "leftMiddleDistal",
  "leftRingProximal",
  "leftRingIntermediate",
  "leftRingDistal",
  "leftLittleProximal",
  "leftLittleIntermediate",
  "leftLittleDistal",
  "rightThumbProximal",
  "rightThumbIntermediate",
  "rightThumbDistal",
  "rightIndexProximal",
  "rightIndexIntermediate",
  "rightIndexDistal",
  "rightMiddleProximal",
  "rightMiddleIntermediate",
  "rightMiddleDistal",
  "rightRingProximal",
  "rightRingIntermediate",
  "rightRingDistal",
  "rightLittleProximal",
  "rightLittleIntermediate",
  "rightLittleDistal"
];

function formatArray(values, fallback) {
  const source = Array.isArray(values) ? values : fallback;
  return `[${source.map((value) => Number(value).toFixed(6)).join(", ")}]`;
}

function formatNodeRef(nodeIndex, nodes) {
  if (!Number.isInteger(nodeIndex) || !nodes[nodeIndex]) {
    return "none";
  }

  return `${nodeIndex} (${JSON.stringify(nodes[nodeIndex].name || "(unnamed)")})`;
}

function toHumanBoneMap(rawHumanBones) {
  if (Array.isArray(rawHumanBones)) {
    const entries = rawHumanBones
      .map((entry) => {
        const boneName = entry?.bone || entry?.name;
        const nodeIndex = entry?.node;
        return boneName && Number.isInteger(nodeIndex) ? [boneName, nodeIndex] : null;
      })
      .filter(Boolean);
    return Object.fromEntries(entries);
  }

  if (rawHumanBones && typeof rawHumanBones === "object") {
    const entries = Object.entries(rawHumanBones)
      .map(([boneName, entry]) => {
        const nodeIndex = entry?.node;
        return Number.isInteger(nodeIndex) ? [boneName, nodeIndex] : null;
      })
      .filter(Boolean);
    return Object.fromEntries(entries);
  }

  return {};
}

function parseGlb(buffer) {
  if (buffer.length < 12) {
    throw new Error("GLB is too small to contain a valid header");
  }

  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);

  if (magic !== GLB_MAGIC) {
    throw new Error(`Unexpected GLB magic: 0x${magic.toString(16)}`);
  }

  if (length !== buffer.length) {
    throw new Error(`GLB length mismatch: header=${length} actual=${buffer.length}`);
  }

  const chunks = [];
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > buffer.length) {
      throw new Error(`Chunk overruns file: offset=${offset} length=${chunkLength}`);
    }

    chunks.push({
      type: chunkType,
      length: chunkLength,
      data: buffer.subarray(chunkStart, chunkEnd)
    });
    offset = chunkEnd;
  }

  const jsonChunk = chunks.find((chunk) => chunk.type === JSON_CHUNK_TYPE);
  const binChunk = chunks.find((chunk) => chunk.type === BIN_CHUNK_TYPE) || null;

  if (!jsonChunk) {
    throw new Error("GLB JSON chunk not found");
  }

  const jsonText = Buffer.from(jsonChunk.data)
    .toString("utf8")
    .replace(/\u0000+$/u, "")
    .trim();

  return {
    version,
    length,
    jsonChunkLength: jsonChunk.length,
    binChunkLength: binChunk?.length || 0,
    chunkCount: chunks.length,
    json: JSON.parse(jsonText)
  };
}

function resolveHumanoidInfo(gltf) {
  const vrm1 = gltf.extensions?.VRMC_vrm || null;
  const vrm0 = gltf.extensions?.VRM || null;

  if (vrm1?.humanoid?.humanBones) {
    return {
      source: "VRMC_vrm",
      specVersion: vrm1.specVersion || "unknown",
      humanBoneMap: toHumanBoneMap(vrm1.humanoid.humanBones),
      standardBones: STANDARD_VRM1_BONES
    };
  }

  if (vrm0?.humanoid?.humanBones) {
    return {
      source: "VRM",
      specVersion: vrm0.specVersion || vrm0.meta?.version || "unknown",
      humanBoneMap: toHumanBoneMap(vrm0.humanoid.humanBones),
      standardBones: STANDARD_VRM0_BONES
    };
  }

  return {
    source: "missing",
    specVersion: "missing",
    humanBoneMap: {},
    standardBones: STANDARD_VRM1_BONES
  };
}

function collectParentIndices(nodes) {
  const parents = new Array(nodes.length).fill(null);

  nodes.forEach((node, nodeIndex) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    children.forEach((childIndex) => {
      if (Number.isInteger(childIndex) && childIndex >= 0 && childIndex < nodes.length) {
        parents[childIndex] = nodeIndex;
      }
    });
  });

  return parents;
}

function collectMorphTargets(gltf) {
  const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
  const meshes = Array.isArray(gltf.meshes) ? gltf.meshes : [];
  const results = [];

  nodes.forEach((node, nodeIndex) => {
    if (!Number.isInteger(node?.mesh)) {
      return;
    }

    const mesh = meshes[node.mesh];
    if (!mesh) {
      return;
    }

    const primitiveSummaries = [];

    (mesh.primitives || []).forEach((primitive, primitiveIndex) => {
      const targetCount = Array.isArray(primitive?.targets) ? primitive.targets.length : 0;
      if (!targetCount) {
        return;
      }

      const targetNames = Array.isArray(mesh.extras?.targetNames)
        ? mesh.extras.targetNames
        : Array.isArray(primitive.extras?.targetNames)
          ? primitive.extras.targetNames
          : [];

      primitiveSummaries.push({
        primitiveIndex,
        targetCount,
        targetNames
      });
    });

    if (!primitiveSummaries.length) {
      return;
    }

    results.push({
      nodeIndex,
      nodeName: node.name || "(unnamed)",
      meshIndex: node.mesh,
      meshName: mesh.name || "(unnamed)",
      primitiveSummaries
    });
  });

  return results;
}

function main() {
  const resolvedPath = path.resolve(VRM_PATH);
  const glbBuffer = fs.readFileSync(resolvedPath);
  const parsed = parseGlb(glbBuffer);
  const gltf = parsed.json;
  const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
  const skins = Array.isArray(gltf.skins) ? gltf.skins : [];
  const humanoidInfo = resolveHumanoidInfo(gltf);
  const humanBoneMap = humanoidInfo.humanBoneMap;
  const parentIndices = collectParentIndices(nodes);
  const presentBones = humanoidInfo.standardBones.filter((boneName) => boneName in humanBoneMap);
  const missingBones = humanoidInfo.standardBones.filter((boneName) => !(boneName in humanBoneMap));
  const morphTargets = collectMorphTargets(gltf);
  const blendShapeGroups = gltf.extensions?.VRM?.blendShapeMaster?.blendShapeGroups || [];

  console.log("VRM Bone Analysis");
  console.log("=================");
  console.log(`File: ${resolvedPath}`);
  console.log(`Size: ${glbBuffer.length} bytes`);
  console.log(`GLB Version: ${parsed.version}`);
  console.log(`GLB Length: ${parsed.length}`);
  console.log(`Chunk Count: ${parsed.chunkCount}`);
  console.log(`JSON Chunk Length: ${parsed.jsonChunkLength}`);
  console.log(`BIN Chunk Length: ${parsed.binChunkLength}`);
  console.log(`Asset Version: ${gltf.asset?.version || "unknown"}`);
  console.log(`extensionsUsed: ${JSON.stringify(gltf.extensionsUsed || [])}`);
  console.log(`Top-level extension keys: ${JSON.stringify(Object.keys(gltf.extensions || {}))}`);
  console.log(`VRMC_vrm specVersion: ${gltf.extensions?.VRMC_vrm?.specVersion || "missing"}`);
  console.log(`Active humanoid extension: ${humanoidInfo.source}`);
  console.log(`Active humanoid specVersion: ${humanoidInfo.specVersion}`);
  console.log("");

  console.log("Nodes");
  console.log("-----");
  nodes.forEach((node, index) => {
    console.log(
      `[${index}] name=${JSON.stringify(node.name || "(unnamed)")} ` +
      `translation=${formatArray(node.translation, [0, 0, 0])} ` +
      `rotation=${formatArray(node.rotation, [0, 0, 0, 1])} ` +
      `scale=${formatArray(node.scale, [1, 1, 1])} ` +
      `mesh=${Number.isInteger(node.mesh) ? node.mesh : "none"} ` +
      `skin=${Number.isInteger(node.skin) ? node.skin : "none"} ` +
      `children=${JSON.stringify(Array.isArray(node.children) ? node.children : [])}`
    );
  });
  console.log("");

  console.log("Humanoid Bone Mapping");
  console.log("---------------------");
  if (!Object.keys(humanBoneMap).length) {
    console.log("No VRM humanoid.humanBones mapping found.");
  } else {
    Object.entries(humanBoneMap).forEach(([boneName, nodeIndex]) => {
      console.log(`${boneName} -> ${formatNodeRef(nodeIndex, nodes)}`);
    });
  }
  console.log("");

  console.log("Skins and Joints");
  console.log("----------------");
  if (!skins.length) {
    console.log("No skins found.");
  } else {
    skins.forEach((skin, skinIndex) => {
      console.log(
        `Skin[${skinIndex}] name=${JSON.stringify(skin.name || "(unnamed)")} ` +
        `skeleton=${formatNodeRef(skin.skeleton, nodes)} inverseBindMatrices=${skin.inverseBindMatrices ?? "none"}`
      );
      (skin.joints || []).forEach((jointIndex, jointOrder) => {
        console.log(`  joint[${jointOrder}] -> ${formatNodeRef(jointIndex, nodes)}`);
      });
    });
  }
  console.log("");

  console.log("Humanoid Bone Details");
  console.log("---------------------");
  if (!Object.keys(humanBoneMap).length) {
    console.log("No humanoid bone details available.");
  } else {
    Object.entries(humanBoneMap).forEach(([boneName, nodeIndex]) => {
      const node = nodes[nodeIndex] || {};
      const parentIndex = parentIndices[nodeIndex];
      const children = Array.isArray(node.children) ? node.children : [];

      console.log(`${boneName}`);
      console.log(`  node: ${formatNodeRef(nodeIndex, nodes)}`);
      console.log(`  rest.translation: ${formatArray(node.translation, [0, 0, 0])}`);
      console.log(`  rest.rotation: ${formatArray(node.rotation, [0, 0, 0, 1])}`);
      console.log(`  parent: ${formatNodeRef(parentIndex, nodes)}`);
      console.log(
        `  children: ${
          children.length
            ? children.map((childIndex) => formatNodeRef(childIndex, nodes)).join(", ")
            : "none"
        }`
      );
    });
  }
  console.log("");

  console.log("Hand and Finger Bones");
  console.log("---------------------");
  HAND_BONES.forEach((boneName) => {
    if (boneName in humanBoneMap) {
      console.log(`${boneName} -> ${formatNodeRef(humanBoneMap[boneName], nodes)}`);
    } else {
      console.log(`${boneName} -> missing`);
    }
  });
  console.log("");

  console.log("Legacy VRM Blend Shape Groups");
  console.log("-----------------------------");
  if (!blendShapeGroups.length) {
    console.log("No legacy VRM blendShapeMaster groups found.");
  } else {
    blendShapeGroups.forEach((group, index) => {
      console.log(
        `blendShapeGroup[${index}] name=${JSON.stringify(group.name || "(unnamed)")} ` +
        `preset=${JSON.stringify(group.presetName || "unknown")} binds=${Array.isArray(group.binds) ? group.binds.length : 0}`
      );
    });
  }
  console.log("");

  console.log("Morph Targets / Blend Shapes");
  console.log("----------------------------");
  if (!morphTargets.length) {
    console.log("No mesh nodes with morph targets were found.");
  } else {
    morphTargets.forEach((entry) => {
      console.log(
        `Node[${entry.nodeIndex}] ${JSON.stringify(entry.nodeName)} -> ` +
        `Mesh[${entry.meshIndex}] ${JSON.stringify(entry.meshName)}`
      );
      entry.primitiveSummaries.forEach((primitive) => {
        console.log(
          `  primitive[${primitive.primitiveIndex}] targets=${primitive.targetCount} ` +
          `names=${primitive.targetNames.length ? JSON.stringify(primitive.targetNames) : "unknown"}`
        );
      });
    });
  }
  console.log("");

  console.log("Summary");
  console.log("-------");
  console.log(`Total nodes: ${nodes.length}`);
  console.log(`Total skins: ${skins.length}`);
  console.log(`Total humanoid bones found: ${Object.keys(humanBoneMap).length}`);
  console.log(`Standard set used: ${humanoidInfo.source === "VRM" ? "VRM0" : "VRM1"}`);
  console.log(`Standard VRM bones present (${presentBones.length}/${humanoidInfo.standardBones.length}): ${presentBones.join(", ")}`);
  console.log(`Standard VRM bones missing (${missingBones.length}/${humanoidInfo.standardBones.length}): ${missingBones.join(", ")}`);
  console.log(`Mesh nodes with morph targets: ${morphTargets.length}`);
  console.log(`Legacy VRM blend shape groups: ${blendShapeGroups.length}`);
}

main();
