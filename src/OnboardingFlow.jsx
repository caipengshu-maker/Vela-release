import { useEffect, useState } from "react";

const DEFAULT_VOICE_ID = "Chinese (Mandarin)_Sweet_Lady";

const llmAdvancedSnippet = `// vela.user.jsonc 示例
{
  "llm": {
    "provider": "minimax-messages",
    "baseUrl": "https://api.minimaxi.com/anthropic",
    "model": "MiniMax-M2.7",
    "apiKey": "YOUR_API_KEY"
  }
}`;

const voiceAdvancedSnippet = `// vela.user.jsonc 示例
{
  "asr": { "enabled": true, "provider": "webspeech" },
  "tts": {
    "enabled": true,
    "provider": "minimax-websocket",
    "voiceId": "Chinese (Mandarin)_Sweet_Lady"
  }
}`;

export function OnboardingFlow({ isSubmitting, initialValues, onComplete }) {
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [asrEnabled, setAsrEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [error, setError] = useState("");

  useEffect(() => {
    setStep(1);
    setUserName(initialValues?.userName || "");
    setApiKey(initialValues?.llmApiKey || "");
    setAsrEnabled(Boolean(initialValues?.asrEnabled));
    setTtsEnabled(Boolean(initialValues?.ttsEnabled));
    setVoiceId(initialValues?.voiceId || DEFAULT_VOICE_ID);
    setError("");
  }, [initialValues]);

  function goToStep(nextStep) {
    if (nextStep === 2 && !String(userName || "").trim()) {
      setError("先填一个你希望 Vela 如何称呼你的名字。");
      return;
    }

    if (nextStep === 3 && !String(apiKey || "").trim()) {
      setError("需要先提供 LLM API Key。");
      return;
    }

    setError("");
    setStep(nextStep);
  }

  async function handleFinish() {
    if (isSubmitting) {
      return;
    }

    const trimmedUserName = String(userName || "").trim();
    const trimmedApiKey = String(apiKey || "").trim();
    const trimmedVoiceId = String(voiceId || "").trim() || DEFAULT_VOICE_ID;

    if (!trimmedUserName) {
      setError("先填一个你希望 Vela 如何称呼你的名字。");
      setStep(1);
      return;
    }

    if (!trimmedApiKey) {
      setError("需要先提供 LLM API Key。");
      setStep(2);
      return;
    }

    setError("");

    try {
      await onComplete?.({
        userName: trimmedUserName,
        llmApiKey: trimmedApiKey,
        asrEnabled: Boolean(asrEnabled),
        ttsEnabled: Boolean(ttsEnabled),
        voiceId: trimmedVoiceId
      });
    } catch (submitError) {
      setError(submitError?.message || "初始化失败，请重试。");
    }
  }

  return (
    <section className="chat-shell onboarding-shell onboarding-v2">
      <div className="chat-header onboarding-header">
        <div className="chat-header-copy">
          <span className="eyebrow">First Run</span>
          <h2>欢迎来到 Vela</h2>
          <p>三步完成初始配置。所有设置都会保存在本机用户数据目录，不会写回仓库文件。</p>
        </div>
      </div>

      <div className="onboarding-steps-indicator">Step {step} / 3</div>

      {step === 1 ? (
        <section className="onboarding-step-card">
          <h3>Step 1 · 你的称呼</h3>
          <p>先告诉 Vela 该怎么称呼你。这个名字会用于对话、记忆和后续欢迎语。</p>
          <label className="field-block">
            <span>昵称</span>
            <input
              value={userName}
              onChange={(event) => setUserName(event.target.value.slice(0, 20))}
              placeholder="比如：小蔡"
              maxLength={20}
            />
          </label>

          <div className="onboarding-actions">
            <button type="button" onClick={() => goToStep(2)}>
              下一步
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="onboarding-step-card">
          <h3>Step 2 · LLM API Key</h3>
          <p>默认使用 MiniMax Messages。把你的 API Key 填在这里，首次启动完成后会保存在本机配置覆盖文件中。</p>
          <label className="field-block">
            <span>API Key</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value.trim())}
              placeholder="输入可用的 API Key"
            />
          </label>

          <div className="onboarding-advanced">
            <p>如果你要换别的 LLM 提供商，可以后续直接编辑本机配置覆盖文件：</p>
            <pre>{llmAdvancedSnippet}</pre>
          </div>

          <div className="onboarding-actions">
            <button type="button" className="secondary-button" onClick={() => goToStep(1)}>
              上一步
            </button>
            <button type="button" onClick={() => goToStep(3)}>
              下一步
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="onboarding-step-card">
          <h3>Step 3 · 语音偏好</h3>

          <label className="onboarding-toggle">
            <input
              type="checkbox"
              checked={asrEnabled}
              onChange={(event) => setAsrEnabled(event.target.checked)}
            />
            <span>启用语音输入（Web Speech）</span>
          </label>

          <label className="onboarding-toggle">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(event) => setTtsEnabled(event.target.checked)}
            />
            <span>启用语音播报（MiniMax WebSocket TTS）</span>
          </label>

          <label className="field-block">
            <span>默认 Voice ID</span>
            <input
              value={voiceId}
              onChange={(event) => setVoiceId(event.target.value)}
              placeholder={DEFAULT_VOICE_ID}
            />
          </label>

          <div className="onboarding-advanced">
            <p>不确定时保留默认 Voice ID 即可。需要更细的语音配置，可以之后编辑本机配置覆盖文件：</p>
            <pre>{voiceAdvancedSnippet}</pre>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="onboarding-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => goToStep(2)}
              disabled={isSubmitting}
            >
              上一步
            </button>
            <button type="button" onClick={() => void handleFinish()} disabled={isSubmitting}>
              {isSubmitting ? "初始化中..." : "完成初始化"}
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
