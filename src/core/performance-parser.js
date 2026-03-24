const PERFORMANCE_DELIMITER = "\n---\n";
const PERFORMANCE_BOUNDARY = "\n---";
const THINK_TAG_RE = /<think>[\s\S]*?<\/think>\s*/g;

function stripThinkingTags(text) {
  return text.replace(THINK_TAG_RE, "").trim();
}

function extractPerformanceSplit(raw) {
  const text = stripThinkingTags(String(raw || ""));
  const delimiterIndex = text.indexOf(PERFORMANCE_DELIMITER);

  if (delimiterIndex >= 0) {
    return {
      found: true,
      prefix: text.slice(0, delimiterIndex),
      text: text.slice(delimiterIndex + PERFORMANCE_DELIMITER.length)
    };
  }

  if (text.endsWith(PERFORMANCE_BOUNDARY)) {
    return {
      found: true,
      prefix: text.slice(0, -PERFORMANCE_BOUNDARY.length),
      text: ""
    };
  }

  return {
    found: false,
    prefix: "",
    text
  };
}

function normalizeIntent(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(parsed, "emotion")) {
    return null;
  }

  return {
    emotion: parsed.emotion,
    intensity: parsed.intensity,
    camera: parsed.camera ?? "wide",
    action: parsed.action ?? "none"
  };
}

export function parsePerformancePrefix(raw) {
  const rawText = stripThinkingTags(String(raw || ""));
  const split = extractPerformanceSplit(rawText);

  if (!split.found) {
    return {
      intent: null,
      text: rawText
    };
  }

  try {
    const parsed = JSON.parse(split.prefix.trim());
    const intent = normalizeIntent(parsed);

    if (intent) {
      return {
        intent,
        text: split.text
      };
    }
  } catch {
    // Fall through to raw text.
  }

  return {
    intent: null,
    text: rawText
  };
}

export function createStreamPrefixBuffer() {
  let buffer = "";
  let resolved = false;
  let intent = null;
  let insideThink = false;

  function resolveFromBuffer() {
    const cleaned = stripThinkingTags(buffer);
    const split = extractPerformanceSplit(cleaned);

    if (!split.found) {
      return null;
    }

    try {
      const parsed = JSON.parse(split.prefix.trim());
      const nextIntent = normalizeIntent(parsed);

      return {
        intent: nextIntent,
        textDelta: split.text
      };
    } catch {
      return {
        intent: null,
        textDelta: split.text || buffer
      };
    }
  }

  return {
    push(delta) {
      const nextDelta = String(delta || "");

      if (resolved) {
        // Even after resolved, strip any residual thinking tags from pass-through deltas.
        const cleanDelta = stripThinkingTags(nextDelta);
        return {
          resolved: true,
          intent,
          textDelta: cleanDelta
        };
      }

      buffer += nextDelta;

      // Increase limit to 1500 to accommodate thinking blocks before the JSON prefix.
      if (buffer.length > 1500) {
        resolved = true;
        intent = null;
        const textDelta = stripThinkingTags(buffer);
        buffer = "";

        return {
          resolved: true,
          intent,
          textDelta
        };
      }

      const result = resolveFromBuffer();

      if (!result) {
        return {
          resolved: false,
          intent: null,
          textDelta: ""
        };
      }

      resolved = true;
      intent = result.intent;
      const textDelta = result.textDelta;
      buffer = "";

      return {
        resolved: true,
        intent,
        textDelta
      };
    },
    getIntent() {
      return intent;
    },
    isResolved() {
      return resolved;
    }
  };
}
