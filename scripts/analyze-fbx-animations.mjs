import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const ANIMATION_DIR = path.join(REPO_ROOT, "public", "assets", "animations");
const DEFAULT_FILES = [
  "Breathing Idle.fbx",
  "Happy Idle.fbx",
  "Standing Idle.fbx",
  "Idle.fbx",
  "Bored.fbx",
  "Thinking.fbx"
];
const TRACK_EPSILON = {
  quaternion: 2,
  vector: 0.5
};
const MAJOR_BONES = [
  "mixamorigHips",
  "mixamorigSpine",
  "mixamorigSpine1",
  "mixamorigSpine2",
  "mixamorigNeck",
  "mixamorigHead",
  "mixamorigLeftShoulder",
  "mixamorigRightShoulder",
  "mixamorigLeftArm",
  "mixamorigRightArm",
  "mixamorigLeftForeArm",
  "mixamorigRightForeArm",
  "mixamorigLeftHand",
  "mixamorigRightHand",
  "mixamorigLeftUpLeg",
  "mixamorigRightUpLeg",
  "mixamorigLeftLeg",
  "mixamorigRightLeg",
  "mixamorigLeftFoot",
  "mixamorigRightFoot"
];
const SAMPLE_BONES = [
  "mixamorigHips",
  "mixamorigSpine2",
  "mixamorigHead",
  "mixamorigLeftHand",
  "mixamorigRightHand",
  "mixamorigLeftFoot",
  "mixamorigRightFoot"
];

function parseArgs(argv) {
  const options = {
    files: DEFAULT_FILES,
    jsonPath: null,
    top: 8
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json") {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error("--json requires a file path");
      }
      options.jsonPath = path.resolve(REPO_ROOT, nextArg);
      index += 1;
      continue;
    }

    if (arg === "--top") {
      const nextArg = Number.parseInt(argv[index + 1], 10);
      if (!Number.isFinite(nextArg) || nextArg <= 0) {
        throw new Error("--top requires a positive integer");
      }
      options.top = nextArg;
      index += 1;
      continue;
    }

    if (arg === "--files") {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error("--files requires a comma-separated list");
      }
      options.files = nextArg
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, decimals = 3) {
  if (!Number.isFinite(value)) {
    return value;
  }

  return Number(value.toFixed(decimals));
}

function roundArray(values, decimals = 3) {
  return values.map((value) => round(value, decimals));
}

function vectorToObject(vector, decimals = 3) {
  return {
    x: round(vector.x, decimals),
    y: round(vector.y, decimals),
    z: round(vector.z, decimals)
  };
}

function quaternionToArray(quaternion, decimals = 6) {
  return roundArray([quaternion.x, quaternion.y, quaternion.z, quaternion.w], decimals);
}

function formatVector(vector) {
  return `(${round(vector.x, 2)}, ${round(vector.y, 2)}, ${round(vector.z, 2)})`;
}

function formatEulerObject(eulerDeg) {
  return `(${round(eulerDeg.x, 1)}, ${round(eulerDeg.y, 1)}, ${round(eulerDeg.z, 1)})`;
}

function formatNumber(value, decimals = 2) {
  return round(value, decimals).toFixed(decimals);
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function sampleQuaternion(values, keyframeIndex) {
  const offset = keyframeIndex * 4;
  return new THREE.Quaternion(
    values[offset],
    values[offset + 1],
    values[offset + 2],
    values[offset + 3]
  ).normalize();
}

function quaternionAngleRadians(a, b) {
  const dot = Math.abs(clamp(a.dot(b), -1, 1));
  return 2 * Math.acos(dot);
}

function unwrapAngle(nextAngle, previousAngle) {
  let value = nextAngle;

  while (value - previousAngle > Math.PI) {
    value -= Math.PI * 2;
  }

  while (value - previousAngle < -Math.PI) {
    value += Math.PI * 2;
  }

  return value;
}

function estimateFps(clip) {
  const deltas = [];

  for (const track of clip.tracks) {
    for (let index = 1; index < track.times.length; index += 1) {
      const delta = track.times[index] - track.times[index - 1];
      if (delta > 0) {
        deltas.push(delta);
      }
    }
  }

  if (!deltas.length) {
    return null;
  }

  deltas.sort((a, b) => a - b);
  const medianDelta = deltas[Math.floor(deltas.length / 2)];
  return 1 / medianDelta;
}

function classifyBone(boneName) {
  if (boneName === "mixamorigHips") {
    return "root";
  }

  if (/Spine|Neck|Head/u.test(boneName)) {
    return "torso";
  }

  if (/Shoulder|Arm|ForeArm/u.test(boneName)) {
    return "arms";
  }

  if (/Hand$/u.test(boneName)) {
    return "hands";
  }

  if (/UpLeg|Leg/u.test(boneName)) {
    return "legs";
  }

  if (/Foot/u.test(boneName)) {
    return "feet";
  }

  if (/Hand(?:Thumb|Index|Middle|Ring|Pinky)\d$/u.test(boneName)) {
    return "fingers";
  }

  return "other";
}

function isFingerBone(boneName) {
  return classifyBone(boneName) === "fingers";
}

function buildQuaternionFrameSummary({
  time,
  quaternion,
  eulerDeg,
  angleFromStartDeg
}) {
  return {
    time: round(time, 3),
    quaternion: quaternionToArray(quaternion),
    eulerDeg: {
      x: round(eulerDeg.x, 3),
      y: round(eulerDeg.y, 3),
      z: round(eulerDeg.z, 3)
    },
    angleFromStartDeg: round(angleFromStartDeg, 3)
  };
}

function analyzeQuaternionTrack(track) {
  const baseQuaternion = sampleQuaternion(track.values, 0);
  const inverseBaseQuaternion = baseQuaternion.clone().invert();
  const previousEuler = new THREE.Euler(0, 0, 0, "XYZ");
  let previousQuaternion = baseQuaternion;
  let hasPreviousEuler = false;
  let peakIndex = 0;
  let peakAngleRadians = 0;
  let movementPathRadians = 0;
  let totalAngleRadians = 0;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  const frameSummaries = [];

  for (let index = 0; index < track.times.length; index += 1) {
    const quaternion = sampleQuaternion(track.values, index);
    const relativeQuaternion = inverseBaseQuaternion.clone().multiply(quaternion).normalize();
    const relativeEuler = new THREE.Euler().setFromQuaternion(relativeQuaternion, "XYZ");

    if (hasPreviousEuler) {
      relativeEuler.x = unwrapAngle(relativeEuler.x, previousEuler.x);
      relativeEuler.y = unwrapAngle(relativeEuler.y, previousEuler.y);
      relativeEuler.z = unwrapAngle(relativeEuler.z, previousEuler.z);
    }

    previousEuler.copy(relativeEuler);
    hasPreviousEuler = true;

    min.x = Math.min(min.x, relativeEuler.x);
    min.y = Math.min(min.y, relativeEuler.y);
    min.z = Math.min(min.z, relativeEuler.z);
    max.x = Math.max(max.x, relativeEuler.x);
    max.y = Math.max(max.y, relativeEuler.y);
    max.z = Math.max(max.z, relativeEuler.z);

    const angleFromStartRadians = quaternionAngleRadians(baseQuaternion, quaternion);
    totalAngleRadians += angleFromStartRadians;

    if (angleFromStartRadians > peakAngleRadians) {
      peakAngleRadians = angleFromStartRadians;
      peakIndex = index;
    }

    if (index > 0) {
      movementPathRadians += quaternionAngleRadians(previousQuaternion, quaternion);
    }

    previousQuaternion = quaternion;

    frameSummaries.push({
      time: track.times[index],
      quaternion,
      eulerDeg: {
        x: THREE.MathUtils.radToDeg(relativeEuler.x),
        y: THREE.MathUtils.radToDeg(relativeEuler.y),
        z: THREE.MathUtils.radToDeg(relativeEuler.z)
      },
      angleFromStartDeg: THREE.MathUtils.radToDeg(angleFromStartRadians)
    });
  }

  const rotationRangeDeg = {
    x: THREE.MathUtils.radToDeg(max.x - min.x),
    y: THREE.MathUtils.radToDeg(max.y - min.y),
    z: THREE.MathUtils.radToDeg(max.z - min.z)
  };
  const peakAxis = Object.entries(rotationRangeDeg)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    keyframes: track.times.length,
    movement: {
      score: round(Math.hypot(rotationRangeDeg.x, rotationRangeDeg.y, rotationRangeDeg.z), 3),
      rotationRangeDeg: {
        x: round(rotationRangeDeg.x, 3),
        y: round(rotationRangeDeg.y, 3),
        z: round(rotationRangeDeg.z, 3)
      },
      averageAngleFromStartDeg: round(
        THREE.MathUtils.radToDeg(totalAngleRadians / track.times.length),
        3
      ),
      maxAngleFromStartDeg: round(THREE.MathUtils.radToDeg(peakAngleRadians), 3),
      pathDeg: round(THREE.MathUtils.radToDeg(movementPathRadians), 3),
      peakTime: round(track.times[peakIndex], 3),
      peakAxis
    },
    notableFrames: {
      start: buildQuaternionFrameSummary(frameSummaries[0]),
      peak: buildQuaternionFrameSummary(frameSummaries[peakIndex]),
      end: buildQuaternionFrameSummary(frameSummaries[frameSummaries.length - 1])
    },
    loopClosureDeg: round(
      THREE.MathUtils.radToDeg(
        quaternionAngleRadians(frameSummaries[0].quaternion, frameSummaries[frameSummaries.length - 1].quaternion)
      ),
      6
    )
  };
}

function buildVectorFrameSummary(frameSummary) {
  return {
    time: round(frameSummary.time, 3),
    value: {
      x: round(frameSummary.value.x, 3),
      y: round(frameSummary.value.y, 3),
      z: round(frameSummary.value.z, 3)
    },
    deltaFromStart: {
      x: round(frameSummary.deltaFromStart.x, 3),
      y: round(frameSummary.deltaFromStart.y, 3),
      z: round(frameSummary.deltaFromStart.z, 3)
    },
    distanceFromStart: round(frameSummary.distanceFromStart, 3)
  };
}

function analyzeVectorTrack(track) {
  const baseVector = new THREE.Vector3(track.values[0], track.values[1], track.values[2]);
  let previousVector = baseVector.clone();
  let peakIndex = 0;
  let peakDistance = 0;
  let movementPath = 0;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const frameSummaries = [];

  for (let index = 0; index < track.times.length; index += 1) {
    const value = new THREE.Vector3(
      track.values[index * 3],
      track.values[index * 3 + 1],
      track.values[index * 3 + 2]
    );
    const deltaFromStart = value.clone().sub(baseVector);
    const distanceFromStart = deltaFromStart.length();

    min.min(value);
    max.max(value);

    if (distanceFromStart > peakDistance) {
      peakDistance = distanceFromStart;
      peakIndex = index;
    }

    if (index > 0) {
      movementPath += previousVector.distanceTo(value);
    }

    previousVector = value.clone();

    frameSummaries.push({
      time: track.times[index],
      value,
      deltaFromStart,
      distanceFromStart
    });
  }

  const range = max.clone().sub(min);

  return {
    keyframes: track.times.length,
    movement: {
      score: round(range.length(), 3),
      range: vectorToObject(range),
      averageDistanceFromStart: round(
        frameSummaries.reduce((sum, frame) => sum + frame.distanceFromStart, 0) / frameSummaries.length,
        3
      ),
      maxDistanceFromStart: round(peakDistance, 3),
      path: round(movementPath, 3),
      peakTime: round(track.times[peakIndex], 3)
    },
    notableFrames: {
      start: buildVectorFrameSummary(frameSummaries[0]),
      peak: buildVectorFrameSummary(frameSummaries[peakIndex]),
      end: buildVectorFrameSummary(frameSummaries[frameSummaries.length - 1])
    },
    loopClosureDistance: round(
      frameSummaries[0].value.distanceTo(frameSummaries[frameSummaries.length - 1].value),
      6
    )
  };
}

function summarizeTrack(track) {
  const [boneName, property = "value"] = track.name.split(".");
  const baseSummary = {
    boneName,
    property,
    trackName: track.name,
    trackType: track.constructor?.name || `${track.ValueTypeName}Track`,
    valueType: track.ValueTypeName,
    category: classifyBone(boneName)
  };

  if (track.ValueTypeName === "quaternion") {
    return {
      ...baseSummary,
      ...analyzeQuaternionTrack(track)
    };
  }

  if (track.ValueTypeName === "vector") {
    return {
      ...baseSummary,
      ...analyzeVectorTrack(track)
    };
  }

  return {
    ...baseSummary,
    keyframes: track.times.length,
    movement: {
      score: 0
    },
    notableFrames: null
  };
}

function buildRegionSummary(trackSummaries) {
  const regions = new Map();

  for (const trackSummary of trackSummaries) {
    const bucket = regions.get(trackSummary.category) || {
      region: trackSummary.category,
      trackCount: 0,
      activeTrackCount: 0,
      totalScore: 0
    };

    bucket.trackCount += 1;
    bucket.totalScore += trackSummary.movement?.score || 0;

    const epsilon = TRACK_EPSILON[trackSummary.valueType] || 0;
    if ((trackSummary.movement?.score || 0) > epsilon) {
      bucket.activeTrackCount += 1;
    }

    regions.set(trackSummary.category, bucket);
  }

  return [...regions.values()]
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((entry) => ({
      region: entry.region,
      trackCount: entry.trackCount,
      activeTrackCount: entry.activeTrackCount,
      totalScore: round(entry.totalScore, 3)
    }));
}

function summarizeLoopClosure(trackSummaries) {
  let maxRotationClosure = 0;
  let maxRotationTrack = null;
  let maxPositionClosure = 0;
  let maxPositionTrack = null;

  for (const trackSummary of trackSummaries) {
    if (trackSummary.valueType === "quaternion") {
      const closure = trackSummary.loopClosureDeg || 0;
      if (closure > maxRotationClosure) {
        maxRotationClosure = closure;
        maxRotationTrack = trackSummary.trackName;
      }
    }

    if (trackSummary.valueType === "vector") {
      const closure = trackSummary.loopClosureDistance || 0;
      if (closure > maxPositionClosure) {
        maxPositionClosure = closure;
        maxPositionTrack = trackSummary.trackName;
      }
    }
  }

  return {
    maxRotationClosureDeg: round(maxRotationClosure, 6),
    maxRotationTrack,
    maxPositionClosure: round(maxPositionClosure, 6),
    maxPositionTrack
  };
}

function summarizePhases(trackSummaries, duration) {
  const coreTracks = trackSummaries
    .filter((trackSummary) => trackSummary.valueType === "quaternion")
    .filter((trackSummary) => !isFingerBone(trackSummary.boneName))
    .sort((a, b) => b.movement.score - a.movement.score)
    .slice(0, 14);
  const phaseDefinitions = [
    { name: "early", start: 0, end: duration / 3 },
    { name: "mid", start: duration / 3, end: (duration * 2) / 3 },
    { name: "late", start: (duration * 2) / 3, end: duration + 1e-6 }
  ];

  return phaseDefinitions.map((phase) => ({
    phase: phase.name,
    movers: coreTracks
      .filter(
        (trackSummary) =>
          trackSummary.movement.peakTime >= phase.start &&
          trackSummary.movement.peakTime < phase.end
      )
      .sort((a, b) => b.movement.score - a.movement.score)
      .slice(0, 4)
      .map((trackSummary) => ({
        boneName: trackSummary.boneName,
        score: round(trackSummary.movement.score, 3),
        peakTime: round(trackSummary.movement.peakTime, 3),
        rotationRangeDeg: trackSummary.movement.rotationRangeDeg
      }))
  }));
}

function sampleWorldPosition(node, target = new THREE.Vector3()) {
  node.getWorldPosition(target);
  return target;
}

function buildWorldRange(vectors) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  for (const vector of vectors) {
    min.min(vector);
    max.max(vector);
  }

  return max.sub(min);
}

function analyzePoseSampling(object, clip, fpsEstimate) {
  const mixer = new THREE.AnimationMixer(object);
  const action = mixer.clipAction(clip);
  action.play();

  const bones = Object.fromEntries(
    SAMPLE_BONES.map((boneName) => [boneName, object.getObjectByName(boneName)])
  );
  const sampleRate = clamp(Math.round(fpsEstimate || 30), 12, 60);
  const totalSteps = Math.max(2, Math.round(clip.duration * sampleRate));
  const samples = [];
  const workingVector = new THREE.Vector3();
  let closestLeftHandToHead = { distance: Infinity, time: 0 };
  let closestRightHandToHead = { distance: Infinity, time: 0 };
  let closestHandsToEachOther = { distance: Infinity, time: 0 };

  for (let step = 0; step <= totalSteps; step += 1) {
    const time = (clip.duration * step) / totalSteps;
    mixer.setTime(time);
    object.updateWorldMatrix(true, true);

    const frame = { time: round(time, 3), positions: {} };

    for (const [boneName, boneNode] of Object.entries(bones)) {
      if (!boneNode) {
        continue;
      }
      frame.positions[boneName] = sampleWorldPosition(boneNode, workingVector).clone();
    }

    const head = frame.positions.mixamorigHead;
    const leftHand = frame.positions.mixamorigLeftHand;
    const rightHand = frame.positions.mixamorigRightHand;

    if (head && leftHand) {
      const distance = head.distanceTo(leftHand);
      if (distance < closestLeftHandToHead.distance) {
        closestLeftHandToHead = { distance, time };
      }
    }

    if (head && rightHand) {
      const distance = head.distanceTo(rightHand);
      if (distance < closestRightHandToHead.distance) {
        closestRightHandToHead = { distance, time };
      }
    }

    if (leftHand && rightHand) {
      const distance = leftHand.distanceTo(rightHand);
      if (distance < closestHandsToEachOther.distance) {
        closestHandsToEachOther = { distance, time };
      }
    }

    samples.push(frame);
  }

  const headRelativeToHips = samples
    .map((sample) => {
      const head = sample.positions.mixamorigHead;
      const hips = sample.positions.mixamorigHips;
      return head && hips ? head.clone().sub(hips) : null;
    })
    .filter(Boolean);
  const leftHandRange = buildWorldRange(
    samples.map((sample) => sample.positions.mixamorigLeftHand).filter(Boolean)
  );
  const rightHandRange = buildWorldRange(
    samples.map((sample) => sample.positions.mixamorigRightHand).filter(Boolean)
  );
  const leftFootRange = buildWorldRange(
    samples.map((sample) => sample.positions.mixamorigLeftFoot).filter(Boolean)
  );
  const rightFootRange = buildWorldRange(
    samples.map((sample) => sample.positions.mixamorigRightFoot).filter(Boolean)
  );

  const fractions = [0, 0.25, 0.5, 0.75, 1];
  const snapshots = fractions.map((fraction) => {
    const time = clip.duration * fraction;
    mixer.setTime(time);
    object.updateWorldMatrix(true, true);
    const hips = sampleWorldPosition(bones.mixamorigHips, new THREE.Vector3()).clone();
    const result = {
      fraction: round(fraction, 2),
      time: round(time, 3)
    };

    for (const boneName of SAMPLE_BONES.filter((entry) => entry !== "mixamorigHips")) {
      const boneNode = bones[boneName];
      if (!boneNode) {
        continue;
      }
      const worldPosition = sampleWorldPosition(boneNode, new THREE.Vector3()).clone();
      result[`${boneName}RelativeToHips`] = vectorToObject(worldPosition.sub(hips));
    }

    return result;
  });

  return {
    sampleRate,
    headRelativeToHipsRange: vectorToObject(buildWorldRange(headRelativeToHips)),
    leftHandRange: vectorToObject(leftHandRange),
    rightHandRange: vectorToObject(rightHandRange),
    leftFootRange: vectorToObject(leftFootRange),
    rightFootRange: vectorToObject(rightFootRange),
    closestLeftHandToHead: {
      distance: round(closestLeftHandToHead.distance, 3),
      time: round(closestLeftHandToHead.time, 3)
    },
    closestRightHandToHead: {
      distance: round(closestRightHandToHead.distance, 3),
      time: round(closestRightHandToHead.time, 3)
    },
    closestHandsToEachOther: {
      distance: round(closestHandsToEachOther.distance, 3),
      time: round(closestHandsToEachOther.time, 3)
    },
    snapshots
  };
}

function analyzeFbxAnimation(fileName, loader) {
  const filePath = path.join(ANIMATION_DIR, fileName);
  const buffer = fs.readFileSync(filePath);
  const arrayBuffer = toArrayBuffer(buffer);
  const object = loader.parse(arrayBuffer, `${ANIMATION_DIR}${path.sep}`);

  if (!object.animations?.length) {
    throw new Error(`${fileName} does not contain any animation clips`);
  }

  const clip = object.animations[0];
  const fpsEstimate = estimateFps(clip);
  const trackSummaries = clip.tracks.map(summarizeTrack);
  const typeCounts = trackSummaries.reduce((accumulator, trackSummary) => {
    accumulator[trackSummary.trackType] = (accumulator[trackSummary.trackType] || 0) + 1;
    return accumulator;
  }, {});
  const activeTrackCount = trackSummaries.filter((trackSummary) => {
    const epsilon = TRACK_EPSILON[trackSummary.valueType] || 0;
    return (trackSummary.movement?.score || 0) > epsilon;
  }).length;
  const staticTrackCount = trackSummaries.filter((trackSummary) => {
    if (trackSummary.keyframes <= 1) {
      return true;
    }
    const epsilon = trackSummary.valueType === "quaternion" ? 0.1 : 0.01;
    return (trackSummary.movement?.score || 0) <= epsilon;
  }).length;
  const topMoversOverall = [...trackSummaries]
    .sort((a, b) => b.movement.score - a.movement.score)
    .slice(0, 12)
    .map((trackSummary) => ({
      boneName: trackSummary.boneName,
      property: trackSummary.property,
      score: round(trackSummary.movement.score, 3),
      peakTime: round(trackSummary.movement.peakTime || 0, 3),
      category: trackSummary.category,
      metric:
        trackSummary.valueType === "quaternion"
          ? {
              rotationRangeDeg: trackSummary.movement.rotationRangeDeg,
              maxAngleFromStartDeg: trackSummary.movement.maxAngleFromStartDeg
            }
          : {
              range: trackSummary.movement.range,
              maxDistanceFromStart: trackSummary.movement.maxDistanceFromStart
            }
    }));
  const topMoversCore = [...trackSummaries]
    .filter((trackSummary) => !isFingerBone(trackSummary.boneName))
    .sort((a, b) => b.movement.score - a.movement.score)
    .slice(0, 12)
    .map((trackSummary) => ({
      boneName: trackSummary.boneName,
      property: trackSummary.property,
      score: round(trackSummary.movement.score, 3),
      peakTime: round(trackSummary.movement.peakTime || 0, 3),
      category: trackSummary.category,
      metric:
        trackSummary.valueType === "quaternion"
          ? {
              rotationRangeDeg: trackSummary.movement.rotationRangeDeg,
              maxAngleFromStartDeg: trackSummary.movement.maxAngleFromStartDeg
            }
          : {
              range: trackSummary.movement.range,
              maxDistanceFromStart: trackSummary.movement.maxDistanceFromStart
            }
    }));
  const majorBoneSummaries = MAJOR_BONES.map((boneName) => {
    const rotationTrack = trackSummaries.find(
      (trackSummary) => trackSummary.trackName === `${boneName}.quaternion`
    );
    const positionTrack = trackSummaries.find(
      (trackSummary) => trackSummary.trackName === `${boneName}.position`
    );
    if (!rotationTrack && !positionTrack) {
      return null;
    }
    return {
      boneName,
      rotation: rotationTrack
        ? {
            score: round(rotationTrack.movement.score, 3),
            rotationRangeDeg: rotationTrack.movement.rotationRangeDeg,
            maxAngleFromStartDeg: rotationTrack.movement.maxAngleFromStartDeg,
            peakTime: round(rotationTrack.movement.peakTime, 3)
          }
        : null,
      position: positionTrack
        ? {
            score: round(positionTrack.movement.score, 3),
            range: positionTrack.movement.range,
            maxDistanceFromStart: positionTrack.movement.maxDistanceFromStart,
            peakTime: round(positionTrack.movement.peakTime, 3)
          }
        : null
    };
  }).filter(Boolean);
  const hipsPositionTrack = trackSummaries.find(
    (trackSummary) => trackSummary.trackName === "mixamorigHips.position"
  );
  const hipsRotationTrack = trackSummaries.find(
    (trackSummary) => trackSummary.trackName === "mixamorigHips.quaternion"
  );
  const poseSampling = analyzePoseSampling(object, clip, fpsEstimate);

  return {
    fileName,
    filePath,
    clipName: clip.name,
    duration: round(clip.duration, 6),
    fpsEstimate: round(fpsEstimate, 3),
    trackCount: clip.tracks.length,
    trackTypeCounts: typeCounts,
    activeTrackCount,
    staticTrackCount,
    loopClosure: summarizeLoopClosure(trackSummaries),
    regionSummary: buildRegionSummary(trackSummaries),
    topMoversOverall,
    topMoversCore,
    majorBoneSummaries,
    hipsMotion: {
      position: hipsPositionTrack
        ? {
            range: hipsPositionTrack.movement.range,
            path: hipsPositionTrack.movement.path,
            maxDistanceFromStart: hipsPositionTrack.movement.maxDistanceFromStart,
            peakTime: hipsPositionTrack.movement.peakTime,
            notableFrames: hipsPositionTrack.notableFrames
          }
        : null,
      rotation: hipsRotationTrack
        ? {
            rotationRangeDeg: hipsRotationTrack.movement.rotationRangeDeg,
            maxAngleFromStartDeg: hipsRotationTrack.movement.maxAngleFromStartDeg,
            pathDeg: hipsRotationTrack.movement.pathDeg,
            peakTime: hipsRotationTrack.movement.peakTime,
            notableFrames: hipsRotationTrack.notableFrames
          }
        : null
    },
    phaseSummary: summarizePhases(trackSummaries, clip.duration),
    poseSampling,
    tracks: trackSummaries
  };
}

function formatTopMoverLine(trackSummary) {
  if (trackSummary.property === "position") {
    const range = trackSummary.metric.range;
    return `${trackSummary.boneName}.${trackSummary.property} score=${formatNumber(trackSummary.score, 2)} ` +
      `range=${formatVector(range)} peak=${formatNumber(trackSummary.peakTime, 2)}s`;
  }

  const range = trackSummary.metric.rotationRangeDeg;
  return `${trackSummary.boneName}.${trackSummary.property} score=${formatNumber(trackSummary.score, 2)} ` +
    `range=${formatEulerObject(range)} peak=${formatNumber(trackSummary.peakTime, 2)}s`;
}

function printHumanReport(results, topCount) {
  console.log("FBX Animation Analysis");
  console.log("======================");
  console.log(`Animation directory: ${ANIMATION_DIR}`);
  console.log("");

  for (const result of results) {
    console.log(`${result.fileName}`);
    console.log("-".repeat(result.fileName.length));
    console.log(
      `clip=${result.clipName} duration=${formatNumber(result.duration, 3)}s ` +
      `fps~${formatNumber(result.fpsEstimate || 0, 2)} tracks=${result.trackCount} ` +
      `active=${result.activeTrackCount} static=${result.staticTrackCount}`
    );
    console.log(`track types: ${JSON.stringify(result.trackTypeCounts)}`);

    if (result.hipsMotion.position) {
      const hipsRange = result.hipsMotion.position.range;
      console.log(
        `hips position range=${formatVector(hipsRange)} ` +
        `path=${formatNumber(result.hipsMotion.position.path, 2)} ` +
        `peak=${formatNumber(result.hipsMotion.position.peakTime, 2)}s`
      );
    }

    if (result.hipsMotion.rotation) {
      console.log(
        `hips rotation range=${formatEulerObject(result.hipsMotion.rotation.rotationRangeDeg)} ` +
        `path=${formatNumber(result.hipsMotion.rotation.pathDeg, 2)}deg ` +
        `peak=${formatNumber(result.hipsMotion.rotation.peakTime, 2)}s`
      );
    }

    console.log("top core movers:");
    for (const trackSummary of result.topMoversCore.slice(0, topCount)) {
      console.log(`  - ${formatTopMoverLine(trackSummary)}`);
    }

    console.log(
      `closest hand-to-head: left=${formatNumber(result.poseSampling.closestLeftHandToHead.distance, 2)} ` +
      `at ${formatNumber(result.poseSampling.closestLeftHandToHead.time, 2)}s, ` +
      `right=${formatNumber(result.poseSampling.closestRightHandToHead.distance, 2)} ` +
      `at ${formatNumber(result.poseSampling.closestRightHandToHead.time, 2)}s`
    );
    console.log(
      `head range rel hips=${formatVector(result.poseSampling.headRelativeToHipsRange)} ` +
      `left hand range=${formatVector(result.poseSampling.leftHandRange)} ` +
      `right hand range=${formatVector(result.poseSampling.rightHandRange)}`
    );
    console.log(
      `loop closure: max rot=${formatNumber(result.loopClosure.maxRotationClosureDeg, 6)}deg ` +
      `(${result.loopClosure.maxRotationTrack || "n/a"}) max pos=${formatNumber(result.loopClosure.maxPositionClosure, 6)} ` +
      `(${result.loopClosure.maxPositionTrack || "n/a"})`
    );
    console.log("");
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const loader = new FBXLoader();
  const results = options.files.map((fileName) => analyzeFbxAnimation(fileName, loader));

  printHumanReport(results, options.top);

  if (options.jsonPath) {
    fs.mkdirSync(path.dirname(options.jsonPath), { recursive: true });
    fs.writeFileSync(
      options.jsonPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          animationDirectory: ANIMATION_DIR,
          files: options.files,
          results
        },
        null,
        2
      )}\n`
    );
    console.log(`Wrote JSON report to ${options.jsonPath}`);
  }
}

main();
