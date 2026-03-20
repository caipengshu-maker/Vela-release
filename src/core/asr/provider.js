const placeholderAsrProvider = {
  id: "placeholder",
  label: "ASR Placeholder",
  capabilities: {
    streamingInput: false
  }
};

export function getAsrCapabilities(config) {
  const enabled = Boolean(config.asr?.enabled);

  return {
    id: placeholderAsrProvider.id,
    label: placeholderAsrProvider.label,
    available: false,
    configured: enabled,
    status: enabled ? "placeholder" : "idle",
    reason: enabled ? "asr-placeholder" : "asr-disabled",
    capabilities: placeholderAsrProvider.capabilities
  };
}
