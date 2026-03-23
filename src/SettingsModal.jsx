import { useEffect, useState } from "react";

function percentLabel(value) {
  const normalized = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${Math.max(0, Math.min(100, normalized))}%`;
}

export function SettingsModal({
  isOpen,
  initialValues,
  onClose,
  onSaved,
  models,
  selectedModel,
  onModelSwitch
}) {
  const [userAlias, setUserAlias] = useState("");
  const [bgmVolume, setBgmVolume] = useState(60);
  const [ttsVolume, setTtsVolume] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setUserAlias(initialValues?.userAlias || "");
    setBgmVolume(Number.isFinite(Number(initialValues?.bgmVolume)) ? Number(initialValues.bgmVolume) : 60);
    setTtsVolume(Number.isFinite(Number(initialValues?.ttsVolume)) ? Number(initialValues.ttsVolume) : 100);
    setError("");
  }, [isOpen, initialValues]);

  if (!isOpen) {
    return null;
  }

  async function handleSave() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const payload = {
        userName: String(userAlias || "").trim(),
        bgmVolume: Number(bgmVolume),
        ttsVolume: Number(ttsVolume)
      };

      const nextState = await window.vela.ipcRenderer.invoke("vela:update-settings", payload);
      onSaved?.(nextState, payload);
      onClose?.();
    } catch (saveError) {
      setError(saveError?.message || "设置保存失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="settings-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-modal-header">
          <h3>Settings</h3>
          <p>调整语音与称呼偏好</p>
        </div>

        <div className="settings-modal-body">
          <label className="field-block">
            <span>你的称呼：</span>
            <input
              value={userAlias}
              onChange={(event) => setUserAlias(event.target.value)}
              placeholder="比如：舒总"
            />
          </label>

          <label className="field-block settings-slider-block">
            <span>BGM Volume：{percentLabel(bgmVolume)}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={bgmVolume}
              onChange={(event) => setBgmVolume(Number(event.target.value))}
            />
          </label>

          <label className="field-block settings-slider-block">
            <span>TTS Volume：{percentLabel(ttsVolume)}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={ttsVolume}
              onChange={(event) => setTtsVolume(Number(event.target.value))}
            />
          </label>

          {Array.isArray(models) && models.length > 0 ? (
            <label className="field-block">
              <span>模型选择</span>
              <select value={selectedModel || "auto"} onChange={(e) => onModelSwitch?.(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="settings-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>
            Close
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
