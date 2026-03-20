const HARD_BREAK_PATTERN = /[。！？!?；;\n]/;
const SOFT_BREAK_PATTERN = /[，、,:： ]/;
const DEFAULT_MIN_LENGTH = 12;
const DEFAULT_MAX_LENGTH = 24;

function normalizeBuffer(buffer) {
  return String(buffer || "");
}

export function splitSpeechSegment(
  buffer,
  {
    force = false,
    minLength = DEFAULT_MIN_LENGTH,
    maxLength = DEFAULT_MAX_LENGTH
  } = {}
) {
  const normalizedBuffer = normalizeBuffer(buffer);

  if (!normalizedBuffer.trim()) {
    return {
      segment: "",
      rest: ""
    };
  }

  if (force) {
    return {
      segment: normalizedBuffer.trim(),
      rest: ""
    };
  }

  for (let index = 0; index < normalizedBuffer.length; index += 1) {
    if (HARD_BREAK_PATTERN.test(normalizedBuffer[index]) && index + 1 >= minLength) {
      return {
        segment: normalizedBuffer.slice(0, index + 1).trim(),
        rest: normalizedBuffer.slice(index + 1)
      };
    }
  }

  if (normalizedBuffer.length < minLength) {
    return {
      segment: "",
      rest: normalizedBuffer
    };
  }

  let splitIndex = -1;
  const maxIndex = Math.min(maxLength, normalizedBuffer.length - 1);

  for (let index = maxIndex; index >= minLength - 1; index -= 1) {
    if (SOFT_BREAK_PATTERN.test(normalizedBuffer[index])) {
      splitIndex = index;
      break;
    }
  }

  if (splitIndex === -1) {
    splitIndex = maxIndex;
  }

  return {
    segment: normalizedBuffer.slice(0, splitIndex + 1).trim(),
    rest: normalizedBuffer.slice(splitIndex + 1)
  };
}
