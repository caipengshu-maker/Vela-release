export const EMOTION_PRESETS_V2 = true;

export const EMOTION_PRESET_ORDER = [
  "calm",
  "happy",
  "affectionate",
  "playful",
  "concerned",
  "sad",
  "angry",
  "whisper",
  "surprised",
  "curious",
  "shy",
  "determined"
];

function expr(name, weight) {
  return { kind: "expression", name, weight };
}

function raw(name, weight) {
  return { kind: "raw", name, weight };
}

function camera(preferred, overrides = []) {
  return {
    preferred,
    overrides
  };
}

export function resolveEmotionCameraHint(cameraHint, avatarState = {}) {
  const preferred = String(cameraHint?.preferred || "wide").trim().toLowerCase();
  const overrides = Array.isArray(cameraHint?.overrides) ? cameraHint.overrides : [];
  const matchedOverride = overrides.find((entry) => {
    const when = entry?.when && typeof entry.when === "object" ? entry.when : null;

    if (!when) {
      return false;
    }

    return Object.entries(when).every(([key, expectedValue]) => {
      const actualValue = String(avatarState?.[key] || "").trim().toLowerCase();
      return actualValue === String(expectedValue || "").trim().toLowerCase();
    });
  });

  return String(matchedOverride?.use || preferred || "wide").trim().toLowerCase() || "wide";
}

function overlay(bones, fingerCurl = { left: 0, right: 0 }) {
  return {
    bones,
    fingerCurl
  };
}

const CALM_OVERLAY = overlay(
  {
    Hips: { x: 0.5, y: 0, z: 0 },
    Spine: { x: 1.2, y: 0, z: 0 },
    Chest: { x: 0.7, y: 0, z: 0 },
    UpperChest: { x: 0.4, y: 0, z: 0 },
    Neck: { x: 0.2, y: 0, z: 0 },
    Head: { x: 0.1, y: 0, z: 0 }
  },
  { left: -0.02, right: -0.02 }
);

const HAPPY_OVERLAY = overlay(
  {
    Hips: { x: -0.4, y: 0, z: 0 },
    Spine: { x: -1.2, y: 0, z: 0 },
    Chest: { x: -1.6, y: 0, z: 0 },
    UpperChest: { x: -0.8, y: 0, z: 0 },
    Neck: { x: -0.4, y: 0, z: 0 },
    Head: { x: -1.2, y: 0, z: 2.4 },
    LeftUpperArm: { x: 0, y: 3.5, z: -5.0 },
    RightUpperArm: { x: 0, y: -3.5, z: 5.0 },
    LeftLowerArm: { x: 0, y: 0, z: -2.0 },
    RightLowerArm: { x: 0, y: 0, z: 2.0 }
  },
  { left: -0.08, right: -0.08 }
);

const AFFECTIONATE_OVERLAY = overlay(
  {
    Hips: { x: 1.0, y: 0, z: 0 },
    Spine: { x: 2.0, y: 0, z: 0 },
    Chest: { x: 1.6, y: 0, z: 0 },
    UpperChest: { x: 1.0, y: 0, z: 0 },
    Neck: { x: 0.8, y: 0, z: 0 },
    Head: { x: 1.4, y: 0, z: -3.5 },
    LeftUpperArm: { x: 0, y: 2.0, z: 2.5 },
    RightUpperArm: { x: 0, y: -2.0, z: -2.5 },
    LeftLowerArm: { x: 0, y: 0, z: 1.5 },
    RightLowerArm: { x: 0, y: 0, z: -1.5 }
  },
  { left: -0.04, right: -0.04 }
);

const PLAYFUL_OVERLAY = overlay(
  {
    Hips: { x: -0.8, y: 0, z: 0 },
    Spine: { x: -0.6, y: 0, z: 0 },
    Chest: { x: -1.0, y: 0, z: 0 },
    UpperChest: { x: -0.4, y: 0, z: 0 },
    Neck: { x: -0.6, y: 0, z: 0 },
    Head: { x: -0.8, y: 0, z: 4.5 },
    LeftUpperArm: { x: 0, y: 4.5, z: -4.0 },
    RightUpperArm: { x: 0, y: -4.5, z: 4.0 },
    LeftLowerArm: { x: 0, y: 0, z: -1.8 },
    RightLowerArm: { x: 0, y: 0, z: 1.8 }
  },
  { left: 0.02, right: 0.02 }
);

const CONCERNED_OVERLAY = overlay(
  {
    Hips: { x: 1.2, y: 0, z: 0 },
    Spine: { x: 3.0, y: 0, z: 0 },
    Chest: { x: 2.2, y: 0, z: 0 },
    UpperChest: { x: 1.4, y: 0, z: 0 },
    Neck: { x: 1.2, y: 0, z: 0 },
    Head: { x: 2.4, y: 0, z: 0 },
    LeftUpperArm: { x: 0, y: 1.0, z: 2.0 },
    RightUpperArm: { x: 0, y: -1.0, z: -2.0 }
  },
  { left: 0.06, right: 0.06 }
);

const SAD_OVERLAY = overlay(
  {
    Hips: { x: 1.8, y: 0, z: 0 },
    Spine: { x: 4.0, y: 0, z: 0 },
    Chest: { x: 3.2, y: 0, z: 0 },
    UpperChest: { x: 2.0, y: 0, z: 0 },
    Neck: { x: 2.6, y: 0, z: 0 },
    Head: { x: 4.5, y: 0, z: 0 },
    LeftUpperArm: { x: 0, y: -1.0, z: 1.5 },
    RightUpperArm: { x: 0, y: 1.0, z: -1.5 },
    LeftLowerArm: { x: 0, y: 0, z: 1.2 },
    RightLowerArm: { x: 0, y: 0, z: -1.2 }
  },
  { left: 0.12, right: 0.12 }
);

const ANGRY_OVERLAY = overlay(
  {
    Hips: { x: -0.6, y: 0, z: 0 },
    Spine: { x: -1.0, y: 0, z: 0 },
    Chest: { x: -1.8, y: 0, z: 0 },
    UpperChest: { x: -1.0, y: 0, z: 0 },
    Neck: { x: -0.4, y: 0, z: 0 },
    Head: { x: 0.6, y: 0, z: 0 },
    LeftUpperArm: { x: 0, y: 2.5, z: -2.0 },
    RightUpperArm: { x: 0, y: -2.5, z: 2.0 },
    LeftLowerArm: { x: 0, y: 0, z: -1.0 },
    RightLowerArm: { x: 0, y: 0, z: 1.0 }
  },
  { left: 0.16, right: 0.16 }
);

const WHISPER_OVERLAY = overlay(
  {
    Hips: { x: 0.8, y: 0, z: 0 },
    Spine: { x: 1.8, y: 0, z: 0 },
    Chest: { x: 1.4, y: 0, z: 0 },
    UpperChest: { x: 1.0, y: 0, z: 0 },
    Neck: { x: 1.0, y: 0, z: 0 },
    Head: { x: 2.0, y: 0, z: -2.2 },
    LeftUpperArm: { x: 0, y: 1.5, z: 1.5 },
    RightUpperArm: { x: 0, y: -1.5, z: -1.5 },
    LeftLowerArm: { x: 0, y: 0, z: 0.8 },
    RightLowerArm: { x: 0, y: 0, z: -0.8 }
  },
  { left: 0.04, right: 0.04 }
);

const SURPRISED_OVERLAY = overlay(
  {
    Hips: { x: -0.3, y: 0, z: 0 },
    Spine: { x: -0.8, y: 0, z: 0 },
    Chest: { x: -1.0, y: 0, z: 0 },
    UpperChest: { x: -0.6, y: 0, z: 0 },
    Neck: { x: -0.4, y: 0, z: 0 },
    Head: { x: -2.2, y: 0, z: 0 },
    LeftUpperArm: { x: 0, y: 4.0, z: -3.5 },
    RightUpperArm: { x: 0, y: -4.0, z: 3.5 },
    LeftLowerArm: { x: 0, y: 0, z: -1.4 },
    RightLowerArm: { x: 0, y: 0, z: 1.4 }
  },
  { left: -0.12, right: -0.12 }
);

const CURIOUS_OVERLAY = overlay(
  {
    Hips: { x: 0.6, y: 0, z: 0 },
    Spine: { x: 1.2, y: 0, z: 0 },
    Chest: { x: 1.0, y: 0, z: 0 },
    UpperChest: { x: 0.6, y: 0, z: 0 },
    Neck: { x: 0.4, y: 0, z: 2.5 },
    Head: { x: -0.8, y: 0, z: 3.5 },
    LeftUpperArm: { x: 0, y: 2.0, z: -1.5 },
    RightUpperArm: { x: 0, y: -2.0, z: 1.5 }
  },
  { left: -0.02, right: -0.02 }
);

const SHY_OVERLAY = overlay(
  {
    Hips: { x: 1.4, y: 0, z: 0 },
    Spine: { x: 3.0, y: 0, z: 0 },
    Chest: { x: 2.4, y: 0, z: 0 },
    UpperChest: { x: 1.6, y: 0, z: 0 },
    Neck: { x: 1.6, y: 0, z: -1.5 },
    Head: { x: 5.0, y: 0, z: 4.0 },
    LeftUpperArm: { x: 0, y: 2.0, z: 3.5 },
    RightUpperArm: { x: 0, y: -2.0, z: -3.5 },
    LeftLowerArm: { x: 0, y: 0, z: 1.8 },
    RightLowerArm: { x: 0, y: 0, z: -1.8 }
  },
  { left: 0.08, right: 0.08 }
);

const DETERMINED_OVERLAY = overlay(
  {
    Hips: { x: -0.8, y: 0, z: 0 },
    Spine: { x: -1.6, y: 0, z: 0 },
    Chest: { x: -2.4, y: 0, z: 0 },
    UpperChest: { x: -1.4, y: 0, z: 0 },
    Neck: { x: -0.8, y: 0, z: 0 },
    Head: { x: -1.0, y: 0, z: 0 },
    LeftUpperArm: { x: 0, y: 1.5, z: -2.2 },
    RightUpperArm: { x: 0, y: -1.5, z: 2.2 },
    LeftLowerArm: { x: 0, y: 0, z: -1.0 },
    RightLowerArm: { x: 0, y: 0, z: 1.0 }
  },
  { left: 0.10, right: 0.10 }
);

export const EMOTION_PRESETS = {
  calm: {
    emotion: "calm",
    legacyExpression: "neutral",
    transitionMs: 560,
    animationClip: "Breathing Idle",
    camera: camera("wide"),
    blendShapes: [
      expr("neutral", 0.12),
      raw("eye_relax", 0.24),
      raw("mouth_straight", 0.18),
      raw("lower_eyelid_up_2", 0.10),
      raw("eyelid_line_down", 0.08)
    ],
    actionOverlay: CALM_OVERLAY
  },
  happy: {
    emotion: "happy",
    legacyExpression: "happy",
    transitionMs: 360,
    animationClip: "Happy Idle",
    camera: camera("close"),
    blendShapes: [
      expr("happy", 0.46),
      expr("blink", 0.05),
      raw("mouth_wide", 0.34),
      raw("mouth_ω", 0.18),
      raw("face_cheek_puku_R", 0.08)
    ],
    actionOverlay: HAPPY_OVERLAY
  },
  affectionate: {
    emotion: "affectionate",
    legacyExpression: "relaxed",
    transitionMs: 480,
    animationClip: "Breathing Idle",
    camera: camera("close", [
      {
        when: { relationshipStage: "reserved" },
        use: "wide"
      }
    ]),
    blendShapes: [
      expr("relaxed", 0.28),
      expr("neutral", 0.08),
      raw("eye_relax", 0.22),
      raw("eyebrow_tare", 0.18),
      raw("mouth_ω", 0.14),
      raw("mouth_straight", 0.10),
      raw("extra_shy_2", 0.12)
    ],
    actionOverlay: AFFECTIONATE_OVERLAY
  },
  playful: {
    emotion: "playful",
    legacyExpression: "happy",
    transitionMs: 320,
    animationClip: "Happy Idle",
    camera: camera("close"),
    blendShapes: [
      expr("happy", 0.34),
      expr("blinkLeft", 0.12),
      raw("mouth_yaeba_2_L", 0.24),
      raw("eyebrow_fun", 0.14),
      raw("mouth_wide", 0.18),
      raw("eye_jito_2", 0.10)
    ],
    actionOverlay: PLAYFUL_OVERLAY
  },
  concerned: {
    emotion: "concerned",
    legacyExpression: "sad",
    transitionMs: 500,
    animationClip: "Thinking",
    camera: camera("wide", [
      {
        when: { relationshipStage: "reserved" },
        use: "wide"
      }
    ]),
    blendShapes: [
      expr("sad", 0.22),
      expr("lookDown", 0.18),
      raw("eyebrow_confuse_1", 0.28),
      raw("eyebrow_sad", 0.18),
      raw("lower_eyelid_up_2", 0.14),
      raw("mouth_straight", 0.18),
      raw("eye_uruuru", 0.12)
    ],
    actionOverlay: CONCERNED_OVERLAY
  },
  sad: {
    emotion: "sad",
    legacyExpression: "sad",
    transitionMs: 640,
    animationClip: "Sad Idle",
    camera: camera("close"),
    blendShapes: [
      expr("sad", 0.58),
      expr("lookDown", 0.16),
      raw("eye_uruuru", 0.34),
      raw("extra_tear_1", 0.30),
      raw("eyebrow_sad", 0.26),
      raw("eyebrow_tare", 0.20),
      raw("mouth_narrow", 0.18),
      raw("eyelid_line_down", 0.12)
    ],
    actionOverlay: SAD_OVERLAY
  },
  angry: {
    emotion: "angry",
    legacyExpression: "angry",
    transitionMs: 280,
    animationClip: "Standing Idle",
    camera: camera("wide"),
    blendShapes: [
      expr("angry", 0.88),
      raw("mouth_angry", 0.54),
      raw("mouth_narrow", 0.38),
      raw("mouth_H_narrow_R", 0.42),
      raw("eyebrow_tsuri", 0.50),
      raw("eyebrow_down", 0.40),
      raw("eyebrow_confuse_1", 0.35),
      raw("eye_jito_2", 0.38),
      raw("face_cheek_puku_R", 0.30),
      raw("highlight_1_down", 0.14),
      raw("highlight_2_down", 0.14)
    ],
    actionOverlay: ANGRY_OVERLAY
  },
  whisper: {
    emotion: "whisper",
    legacyExpression: "relaxed",
    transitionMs: 520,
    animationClip: "Breathing Idle",
    camera: camera("close", [
      {
        when: { relationshipStage: "reserved" },
        use: "wide"
      }
    ]),
    blendShapes: [
      expr("relaxed", 0.20),
      expr("lookDown", 0.12),
      raw("mouth_straight", 0.18),
      raw("mouth_u_1", 0.18),
      raw("mouth_o_1", 0.12),
      raw("eye_relax", 0.14),
      raw("eyebrow_tare", 0.10),
      raw("extra_shy_2", 0.10)
    ],
    actionOverlay: WHISPER_OVERLAY
  },
  surprised: {
    emotion: "surprised",
    legacyExpression: "happy",
    transitionMs: 240,
    animationClip: "Happy Idle",
    camera: camera("close"),
    blendShapes: [
      expr("happy", 0.18),
      expr("lookUp", 0.14),
      raw("mouth_a_1", 0.32),
      raw("mouth_wide", 0.34),
      raw("eyebrow_confuse_1", 0.28),
      raw("lower_eyelid_up_2", 0.18),
      raw("eye_jito_1", 0.10)
    ],
    actionOverlay: SURPRISED_OVERLAY
  },
  curious: {
    emotion: "curious",
    legacyExpression: "neutral",
    transitionMs: 440,
    animationClip: "Thinking",
    camera: camera("wide"),
    blendShapes: [
      expr("neutral", 0.12),
      expr("lookUp", 0.24),
      raw("eye_jito_1", 0.22),
      raw("eyebrow_confuse_1", 0.22),
      raw("mouth_straight", 0.14),
      raw("eyelid_line_down", 0.10),
      raw("eye_relax", 0.08)
    ],
    actionOverlay: CURIOUS_OVERLAY
  },
  shy: {
    emotion: "shy",
    legacyExpression: "relaxed",
    transitionMs: 620,
    animationClip: "Standing Idle",
    camera: camera("close", [
      {
        when: { relationshipStage: "reserved" },
        use: "wide"
      }
    ]),
    blendShapes: [
      expr("sad", 0.24),
      expr("lookDown", 0.20),
      raw("extra_shy_2", 0.34),
      raw("eyebrow_tare", 0.22),
      raw("mouth_straight", 0.16),
      raw("eye_relax", 0.12),
      raw("face_cheek_puku_R", 0.10)
    ],
    actionOverlay: SHY_OVERLAY
  },
  determined: {
    emotion: "determined",
    legacyExpression: "angry",
    transitionMs: 360,
    animationClip: "Idle",
    camera: camera("wide"),
    blendShapes: [
      expr("angry", 0.28),
      expr("neutral", 0.10),
      raw("mouth_straight", 0.24),
      raw("mouth_narrow", 0.18),
      raw("eyebrow_down", 0.22),
      raw("eye_jito_2", 0.10),
      expr("lookDown", 0.06)
    ],
    actionOverlay: DETERMINED_OVERLAY
  }
};

for (const preset of Object.values(EMOTION_PRESETS)) {
  preset.cameraHint = preset.camera;
  preset.camera = String(preset.camera?.preferred || "wide");
  preset.preferredAnimations = [
    {
      clip: preset.animationClip,
      weight: 1
    }
  ];
  preset.expressionWeights = Object.fromEntries(
    (preset.blendShapes || [])
      .filter((entry) => entry.kind === "expression")
      .map((entry) => [entry.name, entry.weight])
  );
  preset.expressions = Object.fromEntries(
    (preset.blendShapes || [])
      .filter((entry) => entry.kind === "raw")
      .map((entry) => [entry.name, entry.weight])
  );
}

export function resolveEmotionPreset(emotion) {
  return EMOTION_PRESETS[emotion] || EMOTION_PRESETS.calm;
}

export const getEmotionPreset = resolveEmotionPreset;

export function buildEmotionLegacyExpressionMap() {
  return Object.fromEntries(
    EMOTION_PRESET_ORDER.map((emotion) => [emotion, resolveEmotionPreset(emotion).legacyExpression])
  );
}
