import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils
} from "@pixiv/three-vrm";
import { EMOTION_TO_VRM_EXPRESSION } from "./interaction-contract.js";

const CAMERA_PRESETS = {
  wide: {
    position: new THREE.Vector3(0.04, 1.58, 3.2),
    target: new THREE.Vector3(0, 1.28, 0.02)
  },
  close: {
    position: new THREE.Vector3(0.04, 1.88, 1.45),
    target: new THREE.Vector3(0.0, 1.82, 0.0)
  }
};

const EMOTION_EXPRESSION_WEIGHTS = {
  happy: 0.64,
  relaxed: 0.58,
  sad: 0.66,
  angry: 0.62
};

const EMOTION_TO_SAFE_MOTION = {
  calm: "still",
  happy: "tiny-nod",
  affectionate: "soft-lean",
  playful: "tiny-head-tilt",
  concerned: "soft-lean",
  sad: "head-down-light",
  angry: "still",
  whisper: "soft-lean",
  surprised: "tiny-head-tilt",
  curious: "tiny-head-tilt",
  shy: "still",
  determined: "tiny-nod"
};

const EXPRESSION_KEYS = ["happy", "relaxed", "sad", "angry", "blink", "aa", "ih", "oh"];
const CORE_POSE_BONES = [
  VRMHumanBoneName.Hips,
  VRMHumanBoneName.Spine,
  VRMHumanBoneName.Chest,
  VRMHumanBoneName.UpperChest,
  VRMHumanBoneName.Neck,
  VRMHumanBoneName.Head
];
const ARM_BONES = [
  VRMHumanBoneName.LeftUpperArm,
  VRMHumanBoneName.RightUpperArm,
  VRMHumanBoneName.LeftLowerArm,
  VRMHumanBoneName.RightLowerArm
];

function clampDelta(delta) {
  if (!Number.isFinite(delta) || delta <= 0) {
    return 1 / 60;
  }

  return Math.min(Math.max(delta, 1 / 240), 1 / 15);
}

function dampFactor(strength, delta) {
  return 1 - Math.exp(-strength * delta);
}

function dampNumber(current, target, strength, delta) {
  return THREE.MathUtils.lerp(current, target, dampFactor(strength, delta));
}

function dampVector(vector, target, strength, delta) {
  vector.lerp(target, dampFactor(strength, delta));
  return vector;
}

function createBonePose() {
  return { x: 0, y: 0, z: 0 };
}

function toArrayBuffer(binaryPayload) {
  if (binaryPayload instanceof ArrayBuffer) {
    return binaryPayload;
  }

  if (ArrayBuffer.isView(binaryPayload)) {
    return binaryPayload.buffer.slice(
      binaryPayload.byteOffset,
      binaryPayload.byteOffset + binaryPayload.byteLength
    );
  }

  if (binaryPayload?.type === "Buffer" && Array.isArray(binaryPayload.data)) {
    return new Uint8Array(binaryPayload.data).buffer;
  }

  throw new Error("Unsupported VRM binary payload");
}

function toFileDirectoryUrl(filePath) {
  const normalizedPath = String(filePath || "").trim().replace(/\\/g, "/");

  if (!normalizedPath) {
    return "/";
  }

  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  const directoryPath =
    lastSlashIndex >= 0
      ? normalizedPath.slice(0, lastSlashIndex + 1)
      : `${normalizedPath}/`;

  if (/^[A-Za-z]:\//.test(directoryPath)) {
    return encodeURI(`file:///${directoryPath}`);
  }

  if (directoryPath.startsWith("/")) {
    return encodeURI(`file://${directoryPath}`);
  }

  return encodeURI(directoryPath);
}

function normalizeAvatarState(avatar) {
  const presence = String(avatar?.presence || "idle").trim().toLowerCase();
  const emotion = String(avatar?.emotion || "calm").trim().toLowerCase();

  return {
    presence,
    emotion,
    camera:
      presence === "speaking"
        ? String(avatar?.camera || "wide").trim().toLowerCase()
        : "wide",
    expression: String(avatar?.expression || "neutral").trim().toLowerCase(),
    motion: String(avatar?.motion || "still").trim().toLowerCase()
  };
}

function resolveSafePresentation(avatar) {
  const state = normalizeAvatarState(avatar);

  if (state.presence === "idle") {
    return {
      ...state,
      camera: "wide",
      expression: "neutral",
      motion: "still"
    };
  }

  if (state.presence === "listening") {
    return {
      ...state,
      camera: "wide",
      expression: "relaxed",
      motion: "listen-settle"
    };
  }

  if (state.presence === "thinking") {
    return {
      ...state,
      camera: "wide",
      expression: "neutral",
      motion: "tiny-head-drop"
    };
  }

  const safeState = {
    ...state,
    expression: state.expression || EMOTION_TO_VRM_EXPRESSION[state.emotion] || "neutral",
    motion: state.motion || EMOTION_TO_SAFE_MOTION[state.emotion] || "still"
  };

  if (safeState.emotion === "sad") {
    return {
      ...safeState,
      expression: "sad",
      motion:
        safeState.motion === "tiny-head-tilt" || safeState.motion === "tiny-nod"
          ? "head-down-light"
          : safeState.motion
    };
  }

  if (safeState.emotion === "angry") {
    return {
      ...safeState,
      expression: "angry",
      motion:
        safeState.motion === "tiny-head-tilt" || safeState.motion === "tiny-nod"
          ? "still"
          : safeState.motion
    };
  }

  if (safeState.emotion === "surprised") {
    return {
      ...safeState,
      expression: "happy",
      motion: safeState.motion === "still" ? "tiny-head-tilt" : safeState.motion
    };
  }

  if (safeState.emotion === "curious") {
    return {
      ...safeState,
      expression: "neutral",
      motion:
        safeState.motion === "still" || safeState.motion === "tiny-nod"
          ? "tiny-head-tilt"
          : safeState.motion
    };
  }

  if (safeState.emotion === "shy") {
    return {
      ...safeState,
      expression: "relaxed",
      motion: "still"
    };
  }

  if (safeState.emotion === "determined") {
    return {
      ...safeState,
      expression: "angry",
      motion: safeState.motion === "still" ? "tiny-nod" : safeState.motion
    };
  }

  return safeState;
}

export class VrmAvatarController {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    this.camera.position.copy(CAMERA_PRESETS.wide.position);
    this.cameraTarget = CAMERA_PRESETS.wide.target.clone();

    this.avatarRoot = new THREE.Group();
    this.lookAtTarget = new THREE.Object3D();
    this.modelBaseOffset = new THREE.Vector3();
    this.scene.add(this.avatarRoot);
    this.scene.add(this.lookAtTarget);

    this._tempBox = new THREE.Box3();
    this._tempEuler = new THREE.Euler();
    this._tempQuatA = new THREE.Quaternion();
    this._tempQuatB = new THREE.Quaternion();
    this._tempVecA = new THREE.Vector3();
    this._tempVecB = new THREE.Vector3();
    this._tempVecC = new THREE.Vector3();

    this.vrm = null;
    this.assetPath = "";
    this.avatarState = resolveSafePresentation(null);
    this.expressionWeights = Object.fromEntries(
      EXPRESSION_KEYS.map((key) => [key, 0])
    );
    this.restQuaternions = new Map();
    this.bones = new Map();
    this.armBones = new Map();
    this.armTargetOffsets = new Map();
    this.elapsed = 0;
    this.width = 1;
    this.height = 1;
    this.blinkState = {
      elapsed: 0,
      closing: false,
      interval: 2.6 + Math.random() * 1.8
    };
    this.debugState = {
      cameraFrameCount: 0,
      lastCameraMode: "",
      lastCameraLogAt: -Infinity,
      lastAvatarSignature: "",
      lastPresentationLogAt: -Infinity
    };

    const hemisphereLight = new THREE.HemisphereLight(0xfff2ea, 0x8d6b73, 1.45);
    const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.2);
    const rimLight = new THREE.DirectionalLight(0xe8b6b5, 0.48);
    keyLight.position.set(1.6, 2.5, 2.7);
    rimLight.position.set(-2.1, 1.1, -1.4);

    this.scene.add(hemisphereLight);
    this.scene.add(keyLight);
    this.scene.add(rimLight);
  }

  async load({ assetPath, readBinaryFile }) {
    const nextAssetPath = String(assetPath || "").trim();

    if (!nextAssetPath) {
      throw new Error("Avatar asset path is empty");
    }

    if (this.vrm && this.assetPath === nextAssetPath) {
      return;
    }

    if (typeof readBinaryFile !== "function") {
      throw new Error("Binary asset reader is unavailable");
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const binaryPayload = await readBinaryFile(nextAssetPath);
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(
        toArrayBuffer(binaryPayload),
        toFileDirectoryUrl(nextAssetPath),
        resolve,
        reject
      );
    });
    const vrm = gltf?.userData?.vrm;

    if (!vrm) {
      throw new Error("VRM payload missing from GLTF");
    }

    this._mountVrm(vrm);
    this.assetPath = nextAssetPath;
  }

  setAvatarState(avatar) {
    const requestedCamera = String(avatar?.camera || "wide").trim().toLowerCase();
    const nextState = resolveSafePresentation(avatar);
    const signature = `${nextState.presence}|${nextState.camera}|${nextState.expression}|${nextState.motion}|${nextState.emotion}`;

    if (signature !== this.debugState.lastAvatarSignature) {
      console.log(
        `[VRM][state] requestedCamera=${requestedCamera} resolvedCamera=${nextState.camera} ` +
        `presence=${nextState.presence} expression=${nextState.expression} motion=${nextState.motion} emotion=${nextState.emotion}`
      );
      this.debugState.lastAvatarSignature = signature;
    }

    this.avatarState = nextState;
  }

  resize(width, height) {
    const safeWidth = Math.max(1, Math.round(width || 1));
    const safeHeight = Math.max(1, Math.round(height || 1));

    if (safeWidth === this.width && safeHeight === this.height) {
      return;
    }

    this.width = safeWidth;
    this.height = safeHeight;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
  }

  update(deltaSeconds) {
    const delta = clampDelta(deltaSeconds);

    this.elapsed += delta;
    this._updateCamera(delta);

    if (this.vrm) {
      const presentation = this.avatarState;
      const mouthOpen = this._computeMouthOpen(presentation);
      const blinkWeight = this._computeBlink(delta);

      this._updateExpressions(presentation, mouthOpen, blinkWeight, delta);
      this._updatePose(presentation, mouthOpen, delta);
      this._updateLookAt(presentation, delta);
      this.vrm.update(delta);

      // Apply arms-down after vrm.update() so raw-bone fallback is not overwritten this frame.
      this._applyArmsDownFrame(delta);
      this._debugPresentation(presentation, mouthOpen, blinkWeight);
    }

    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._clearVrm();
    this.renderer.dispose();
  }

  _mountVrm(vrm) {
    this._clearVrm();
    this.vrm = vrm;

    console.log(`[VRM][mount] metaVersion=${vrm?.meta?.metaVersion || "unknown"}`);
    VRMUtils.rotateVRM0(vrm);

    this.avatarRoot.add(vrm.scene);

    this._fitAvatar(vrm.scene);
    this._cacheBones(vrm);
    this._applyArmsDownFrame(1 / 30);
    this._resetExpressions();

    if (vrm.lookAt) {
      vrm.lookAt.autoUpdate = true;
      vrm.lookAt.target = this.lookAtTarget;
    }
  }

  _fitAvatar(scene) {
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    scene.updateWorldMatrix(true, true);

    this._tempBox.setFromObject(scene);
    const size = this._tempBox.getSize(this._tempVecA);
    const height = Math.max(size.y, 0.01);
    const targetHeight = 2.18;
    const scale = targetHeight / height;

    scene.scale.setScalar(scale);
    scene.updateWorldMatrix(true, true);
    this._tempBox.setFromObject(scene);

    const center = this._tempBox.getCenter(this._tempVecB);
    scene.position.x -= center.x;
    scene.position.z -= center.z;
    scene.position.y -= this._tempBox.min.y;
    scene.updateWorldMatrix(true, true);

    this.avatarRoot.position.copy(this.modelBaseOffset);
  }

  _cacheBones(vrm) {
    this.bones.clear();
    this.restQuaternions.clear();
    this.armBones.clear();
    this.armTargetOffsets.clear();

    [...CORE_POSE_BONES, ...ARM_BONES].forEach((boneName) => {
      const normalizedNode = vrm.humanoid?.getNormalizedBoneNode(boneName) || null;
      const rawNode = vrm.humanoid?.getRawBoneNode(boneName) || null;
      console.log(
        `[VRM][bones] ${boneName} normalized=${Boolean(normalizedNode)} raw=${Boolean(rawNode)}`
      );

      const selectedNode = normalizedNode || rawNode;
      const selectedSource = normalizedNode ? "normalized" : rawNode ? "raw" : "missing";

      if (CORE_POSE_BONES.includes(boneName) && selectedNode) {
        this.bones.set(boneName, selectedNode);
        this.restQuaternions.set(boneName, selectedNode.quaternion.clone());
      }

      if (ARM_BONES.includes(boneName) && selectedNode) {
        this.armBones.set(boneName, {
          node: selectedNode,
          source: selectedSource,
          restQuaternion: selectedNode.quaternion.clone()
        });
      }
    });

    this._setupArmTargets();
    this._logArmBoneSummary();
  }

  _applyArmsDown() {
    const leftUpperArm = this.bones.get(VRMHumanBoneName.LeftUpperArm);
    const rightUpperArm = this.bones.get(VRMHumanBoneName.RightUpperArm);
    const leftLowerArm = this.bones.get(VRMHumanBoneName.LeftLowerArm);
    const rightLowerArm = this.bones.get(VRMHumanBoneName.RightLowerArm);

    // Rotate upper arms ~70° down from T-pose.
    if (leftUpperArm) {
      this._tempEuler.set(0.3, 0, 1.22, "XYZ");
      this._tempQuatA.setFromEuler(this._tempEuler);
      leftUpperArm.quaternion.multiply(this._tempQuatA);
    }

    if (rightUpperArm) {
      this._tempEuler.set(0.3, 0, -1.22, "XYZ");
      this._tempQuatA.setFromEuler(this._tempEuler);
      rightUpperArm.quaternion.multiply(this._tempQuatA);
    }

    // Slight bend at elbows for natural look.
    if (leftLowerArm) {
      this._tempEuler.set(0, 0, 0.18, "XYZ");
      this._tempQuatA.setFromEuler(this._tempEuler);
      leftLowerArm.quaternion.multiply(this._tempQuatA);
    }

    if (rightLowerArm) {
      this._tempEuler.set(0, 0, -0.18, "XYZ");
      this._tempQuatA.setFromEuler(this._tempEuler);
      rightLowerArm.quaternion.multiply(this._tempQuatA);
    }

    // Update rest quaternions to include arms-down as the new rest pose.
    [
      VRMHumanBoneName.LeftUpperArm,
      VRMHumanBoneName.RightUpperArm,
      VRMHumanBoneName.LeftLowerArm,
      VRMHumanBoneName.RightLowerArm
    ].forEach((boneName) => {
      const bone = this.bones.get(boneName);
      if (bone) {
        this.restQuaternions.set(boneName, bone.quaternion.clone());
      }
    });
  }

  _logArmBoneSummary() {
    ARM_BONES.forEach((boneName) => {
      const armInfo = this.armBones.get(boneName);
      console.log(
        `[VRM][arms] ${boneName} source=${armInfo?.source || "missing"} target=${this.armTargetOffsets.has(boneName)}`
      );
    });
  }

  _setupArmTargets() {
    this.armTargetOffsets.clear();

    const leftUpperOffset = this._resolveUpperArmOffset({
      upperArmName: VRMHumanBoneName.LeftUpperArm,
      lowerArmName: VRMHumanBoneName.LeftLowerArm,
      sideSign: 1
    });
    const rightUpperOffset = this._resolveUpperArmOffset({
      upperArmName: VRMHumanBoneName.RightUpperArm,
      lowerArmName: VRMHumanBoneName.RightLowerArm,
      sideSign: -1
    });

    if (leftUpperOffset) {
      this.armTargetOffsets.set(VRMHumanBoneName.LeftUpperArm, leftUpperOffset);
    }

    if (rightUpperOffset) {
      this.armTargetOffsets.set(VRMHumanBoneName.RightUpperArm, rightUpperOffset);
    }

    this._tempEuler.set(0, 0, 0.35, "XYZ");
    this._tempQuatA.setFromEuler(this._tempEuler);
    this.armTargetOffsets.set(VRMHumanBoneName.LeftLowerArm, this._tempQuatA.clone());

    this._tempEuler.set(0, 0, -0.35, "XYZ");
    this._tempQuatA.setFromEuler(this._tempEuler);
    this.armTargetOffsets.set(VRMHumanBoneName.RightLowerArm, this._tempQuatA.clone());
  }

  _resolveUpperArmOffset({ upperArmName, lowerArmName, sideSign }) {
    const upperArm = this.armBones.get(upperArmName);
    const lowerArm = this.armBones.get(lowerArmName);

    if (!upperArm) {
      return null;
    }

    const candidates = [
      { label: "z70", x: 0, y: 0, z: 1.22 * sideSign },
      { label: "x70", x: -1.22, y: 0, z: 0 },
      { label: "x-70", x: 1.22, y: 0, z: 0 },
      { label: "zx", x: 0.24, y: 0, z: 1.08 * sideSign },
      { label: "xy", x: -0.9, y: 0.32 * sideSign, z: 0 },
      { label: "yz", x: 0, y: 0.9 * sideSign, z: 0.5 * sideSign }
    ];

    if (!lowerArm) {
      this._tempEuler.set(0.24, 0, 1.08 * sideSign, "XYZ");
      this._tempQuatA.setFromEuler(this._tempEuler);
      return this._tempQuatA.clone();
    }

    const armDir = this._tempVecC;
    const shoulderPos = this._tempVecA;
    const elbowPos = this._tempVecB;
    const initialQuat = upperArm.node.quaternion.clone();
    let bestCandidate = candidates[0];
    let bestScore = -Infinity;

    candidates.forEach((candidate) => {
      this._tempEuler.set(candidate.x, candidate.y, candidate.z, "XYZ");
      this._tempQuatA.setFromEuler(this._tempEuler);
      upperArm.node.quaternion.copy(upperArm.restQuaternion).multiply(this._tempQuatA);
      upperArm.node.updateWorldMatrix(true, false);
      lowerArm.node.updateWorldMatrix(true, false);

      upperArm.node.getWorldPosition(shoulderPos);
      lowerArm.node.getWorldPosition(elbowPos);
      armDir.copy(elbowPos).sub(shoulderPos).normalize();

      const downwardScore = -armDir.y;
      const sideScore = armDir.x * sideSign;
      const forwardPenalty = Math.abs(armDir.z);
      const score = downwardScore * 0.72 + sideScore * 0.26 - forwardPenalty * 0.14;

      if (score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
      }
    });

    upperArm.node.quaternion.copy(initialQuat);
    upperArm.node.updateWorldMatrix(true, false);

    console.log(
      `[VRM][arms] axis ${upperArmName}=${bestCandidate.label} ` +
      `euler=(${bestCandidate.x.toFixed(2)},${bestCandidate.y.toFixed(2)},${bestCandidate.z.toFixed(2)}) ` +
      `score=${bestScore.toFixed(3)}`
    );
    this._tempEuler.set(bestCandidate.x, bestCandidate.y, bestCandidate.z, "XYZ");
    this._tempQuatA.setFromEuler(this._tempEuler);
    return this._tempQuatA.clone();
  }

  _applyArmsDownFrame(delta) {
    ARM_BONES.forEach((boneName) => {
      const armInfo = this.armBones.get(boneName);
      const armOffset = this.armTargetOffsets.get(boneName);

      if (!armInfo || !armOffset) {
        return;
      }

      this._tempQuatA.copy(armInfo.restQuaternion).multiply(armOffset);
      armInfo.node.quaternion.slerp(this._tempQuatA, dampFactor(18, delta));
    });
  }

  _clearVrm() {
    if (!this.vrm) {
      return;
    }

    this.vrm.scene.removeFromParent();
    VRMUtils.deepDispose(this.vrm.scene);
    this.vrm = null;
    this.assetPath = "";
    this.bones.clear();
    this.armBones.clear();
    this.armTargetOffsets.clear();
    this.restQuaternions.clear();
    this._resetExpressions();
  }

  _resetExpressions() {
    EXPRESSION_KEYS.forEach((key) => {
      this.expressionWeights[key] = 0;
    });
  }

  _updateCamera(delta) {
    const cameraMode = this.avatarState?.camera === "close" ? "close" : "wide";
    const preset = CAMERA_PRESETS[cameraMode];
    this.debugState.cameraFrameCount += 1;

    dampVector(this.camera.position, preset.position, 8.5, delta);
    dampVector(this.cameraTarget, preset.target, 9, delta);

    if (cameraMode !== this.debugState.lastCameraMode) {
      this.debugState.lastCameraMode = cameraMode;
      console.log(
        `[VRM][camera] mode=${cameraMode} avatarState.camera=${this.avatarState?.camera || "wide"}`
      );
    }

    if (
      this.elapsed - this.debugState.lastCameraLogAt >= 2.4 ||
      this.debugState.cameraFrameCount % 180 === 0
    ) {
      this.debugState.lastCameraLogAt = this.elapsed;
      console.log(
        `[VRM][camera] tick=${this.debugState.cameraFrameCount} ` +
        `pos=(${this.camera.position.x.toFixed(2)},${this.camera.position.y.toFixed(2)},${this.camera.position.z.toFixed(2)}) ` +
        `target=(${this.cameraTarget.x.toFixed(2)},${this.cameraTarget.y.toFixed(2)},${this.cameraTarget.z.toFixed(2)})`
      );
    }
  }

  _computeBlink(delta) {
    this.blinkState.elapsed += delta;

    if (!this.blinkState.closing && this.blinkState.elapsed >= this.blinkState.interval) {
      this.blinkState.closing = true;
      this.blinkState.elapsed = 0;
    }

    if (!this.blinkState.closing) {
      return 0;
    }

    const blinkDuration = 0.18;
    const progress = Math.min(this.blinkState.elapsed / blinkDuration, 1);
    const blinkWeight = progress < 0.5
      ? progress / 0.5
      : 1 - (progress - 0.5) / 0.5;

    if (progress >= 1) {
      this.blinkState.closing = false;
      this.blinkState.elapsed = 0;
      this.blinkState.interval = 2.8 + Math.random() * 1.8;
    }

    return THREE.MathUtils.clamp(blinkWeight, 0, 1);
  }

  _computeMouthOpen(presentation) {
    if (presentation.presence !== "speaking") {
      return 0;
    }

    const baseOpen = 0.5 + 0.5 * Math.sin(this.elapsed * 8.5);
    const accentOpen = 0.5 + 0.5 * Math.sin(this.elapsed * 14.5 + 0.4);
    const amplitude = presentation.emotion === "whisper" ? 0.26 : 0.48;

    return amplitude * (0.55 * baseOpen + 0.45 * accentOpen);
  }

  _updateExpressions(presentation, mouthOpen, blinkWeight, delta) {
    const expressionManager = this.vrm?.expressionManager;

    if (!expressionManager) {
      return;
    }

    const targets = Object.fromEntries(EXPRESSION_KEYS.map((key) => [key, 0]));

    if (presentation.expression !== "neutral") {
      targets[presentation.expression] =
        EMOTION_EXPRESSION_WEIGHTS[presentation.expression] || 0;
    }

    targets.blink = blinkWeight;

    if (presentation.presence === "speaking") {
      const mouthScale = presentation.emotion === "whisper" ? 0.72 : 1;
      targets.aa = mouthOpen * 1.02 * mouthScale;
      targets.oh = mouthOpen * 0.44 * mouthScale;
      targets.ih = mouthOpen * 0.3 * mouthScale;
    }

    EXPRESSION_KEYS.forEach((key) => {
      this.expressionWeights[key] = dampNumber(
        this.expressionWeights[key] || 0,
        targets[key],
        key === "blink" ? 30 : 14,
        delta
      );
      expressionManager.setValue(key, this.expressionWeights[key]);
    });
  }

  _debugPresentation(presentation, mouthOpen, blinkWeight) {
    if (this.elapsed - this.debugState.lastPresentationLogAt < 1.8) {
      return;
    }

    this.debugState.lastPresentationLogAt = this.elapsed;
    console.log(
      `[VRM][presentation] presence=${presentation.presence} motion=${presentation.motion} ` +
      `expression=${presentation.expression} emotion=${presentation.emotion} camera=${presentation.camera} ` +
      `mouth=${mouthOpen.toFixed(3)} blink=${blinkWeight.toFixed(3)} ` +
      `happy=${(this.expressionWeights.happy || 0).toFixed(2)} ` +
      `sad=${(this.expressionWeights.sad || 0).toFixed(2)} ` +
      `angry=${(this.expressionWeights.angry || 0).toFixed(2)} ` +
      `relaxed=${(this.expressionWeights.relaxed || 0).toFixed(2)}`
    );
  }

  _updatePose(presentation, mouthOpen, delta) {
    const breath = Math.sin(this.elapsed * 1.35);
    const sway = Math.sin(this.elapsed * 0.9);
    const pulse = Math.sin(this.elapsed * 2.15);
    const rootPosition = this._tempVecA.set(0, breath * 0.01, 0);
    const hips = createBonePose();
    const spine = createBonePose();
    const chest = createBonePose();
    const upperChest = createBonePose();
    const neck = createBonePose();
    const head = createBonePose();

    spine.x += breath * 0.01;
    chest.x += breath * 0.008;
    upperChest.x += breath * 0.006;

    if (presentation.presence === "idle") {
      head.y += Math.sin(this.elapsed * 0.45) * 0.014;
    } else if (presentation.presence === "listening") {
      rootPosition.z += 0.02;
      spine.x += -0.02;
      chest.x += -0.012;
      head.y += sway * 0.02;
    } else if (presentation.presence === "thinking") {
      spine.x += 0.012;
      neck.x += 0.035;
      head.x += 0.082;
      head.y += Math.sin(this.elapsed * 0.33) * 0.006;
    } else if (presentation.presence === "speaking") {
      rootPosition.z += 0.014;
      chest.x += -0.01;
      head.x += mouthOpen * 0.02;
      head.y += sway * 0.014;
    }

    switch (presentation.motion) {
      case "listen-settle":
        spine.x += -0.015;
        chest.y += Math.sin(this.elapsed * 0.95) * 0.012;
        break;
      case "tiny-head-drop":
        neck.x += 0.018;
        head.x += 0.05;
        break;
      case "soft-lean":
        rootPosition.z += 0.03;
        hips.x += -0.012;
        spine.x += -0.035;
        chest.x += -0.024;
        upperChest.x += -0.018;
        break;
      case "tiny-nod":
        head.x += Math.max(0, pulse) * 0.045 - 0.006;
        neck.x += pulse * 0.012;
        break;
      case "tiny-head-tilt":
        head.z += -0.075;
        neck.z += -0.03;
        head.y += sway * 0.01;
        break;
      case "head-down-light":
        neck.x += 0.04;
        head.x += 0.12;
        chest.x += 0.02;
        upperChest.x += 0.012;
        break;
      default:
        break;
    }

    this.avatarRoot.position.set(
      dampNumber(this.avatarRoot.position.x, rootPosition.x, 9, delta),
      dampNumber(
        this.avatarRoot.position.y,
        this.modelBaseOffset.y + rootPosition.y,
        9,
        delta
      ),
      dampNumber(
        this.avatarRoot.position.z,
        this.modelBaseOffset.z + rootPosition.z,
        9,
        delta
      )
    );

    this._applyBoneRotation(VRMHumanBoneName.Hips, hips, delta);
    this._applyBoneRotation(VRMHumanBoneName.Spine, spine, delta);
    this._applyBoneRotation(VRMHumanBoneName.Chest, chest, delta);
    this._applyBoneRotation(VRMHumanBoneName.UpperChest, upperChest, delta);
    this._applyBoneRotation(VRMHumanBoneName.Neck, neck, delta);
    this._applyBoneRotation(VRMHumanBoneName.Head, head, delta);
  }

  _applyBoneRotation(boneName, rotation, delta) {
    const bone = this.bones.get(boneName);
    const restQuaternion = this.restQuaternions.get(boneName);

    if (!bone || !restQuaternion) {
      return;
    }

    this._tempEuler.set(rotation.x, rotation.y, rotation.z, "XYZ");
    this._tempQuatA.setFromEuler(this._tempEuler);
    this._tempQuatB.copy(restQuaternion).multiply(this._tempQuatA);
    bone.quaternion.slerp(this._tempQuatB, dampFactor(12, delta));
  }

  _updateLookAt(presentation, delta) {
    if (!this.vrm?.lookAt) {
      return;
    }

    this._tempVecB.copy(this.camera.position);
    this._tempVecB.z -= presentation.camera === "close" ? 0.18 : 0.34;
    this._tempVecB.y += presentation.camera === "close" ? 0.02 : -0.06;

    if (presentation.presence === "thinking") {
      this._tempVecB.y -= 0.26;
      this._tempVecB.z -= 0.2;
    }

    if (presentation.motion === "soft-lean") {
      this._tempVecB.z -= 0.08;
    }

    if (presentation.motion === "tiny-head-tilt") {
      this._tempVecB.x += 0.14;
    }

    if (presentation.emotion === "sad") {
      this._tempVecB.y -= 0.12;
    }

    if (presentation.emotion === "playful") {
      this._tempVecB.x += 0.08;
    }

    if (presentation.emotion === "shy") {
      this._tempVecB.x += 0.18;
      this._tempVecB.y -= 0.04;
    }

    if (presentation.emotion === "curious") {
      this._tempVecB.y += 0.08;
      this._tempVecB.z -= 0.02;
    }

    dampVector(this.lookAtTarget.position, this._tempVecB, 10, delta);
  }
}
