function clampUnit(value, fallback = 1) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numericValue));
}

export function mapUserVolumeToGain(value) {
  const unitValue = clampUnit(value);
  if (unitValue <= 0) {
    return 0;
  }

  return Math.sqrt(unitValue);
}
