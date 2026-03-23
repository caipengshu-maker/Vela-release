import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayerService } from "./audio-player.js";
import { useEffectEvent } from "react";
import { createWebSpeechProvider } from "./core/asr/provider.js";
import {
  releaseCloseCamera,
  settleAvatarState
} from "./core/avatar-state.js";
import { VrmAvatarStage } from "./vrm-avatar-stage.jsx";
import { SplashScreen } from "./SplashScreen.jsx";
import { BgmController } from "./core/bgm-controller.js";
import { SettingsModal } from "./SettingsModal.jsx";
import { OnboardingFlow } from "./OnboardingFlow.jsx";

const initialState = {
  app: null,
  persona: null,
  avatar: null,
  avatarAsset: null,
  messages: [],
  bridgeDiaryNote: "",
  welcomeNote: "",
  memoryPeek: null,
  voiceMode: {
    enabled: false,
    available: false,
    inputMode: "text",
    outputMode: "text"
  },
  modelStatus: {
    availableModels: [],
    selectedModel: "auto",
    selectedLabel: "自动",
    activeLabel: "主模型",
    fallbackUsed: false,
    fallbackReason: null,
    manualSelection: false,
    cooldownUntil: null,
    cooldownActive: false
  },
  thinkingMode: "balanced",
  thinkingModes: [],
  llm: null,
  tts: null,
  asr: null,
  onboarding: {
    required: false,
    completed: true
  },
  status: {
    phase: "idle",
    speech: {
      status: "idle"
    },
    asr: {
      status: "idle"
    }
  },
  session: {
    launchTurnCount: 0,
    lifetimeTurnCount: 0
  },
  window: {
    fullscreen: false
  }
};

function Icon({ children, className = "", size = 20, strokeWidth = 1.8 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function MicIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M6 11.5a6 6 0 0 0 12 0" />
      <path d="M12 17.5V21" />
    </Icon>
  );
}

function SendIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 11.5 21 3 13.5 21l-2.6-6.9L3 11.5Z" />
      <path d="M10.9 14.1 21 3" />
    </Icon>
  );
}

function ReplayIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 11a8 8 0 1 1 2.34 5.66" />
      <path d="M3 5v6h6" />
    </Icon>
  );
}

function WaveIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 15c1.4 0 1.4-4 2.8-4S9.2 17 10.6 17s1.4-7 2.8-7 1.4 4 2.8 4 1.4-3 2.8-3" />
    </Icon>
  );
}

function UpRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </Icon>
  );
}

function FullscreenEnterIcon(props) {
  return (
    <Icon {...props}>
      <path d="M8 4H4v4" />
      <path d="M4 4l5 5" />
      <path d="M16 4h4v4" />
      <path d="M20 4l-5 5" />
      <path d="M8 20H4v-4" />
      <path d="M4 20l5-5" />
      <path d="M16 20h4v-4" />
      <path d="M20 20l-5-5" />
    </Icon>
  );
}

function FullscreenExitIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9 4H4v5" />
      <path d="M4 9l6-6" />
      <path d="M15 4h5v5" />
      <path d="M20 9l-6-6" />
      <path d="M9 20H4v-5" />
      <path d="M4 15l6 6" />
      <path d="M15 20h5v-5" />
      <path d="M20 15l-6 6" />
    </Icon>
  );
}

function StopIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <rect x="9" y="9" width="6" height="6" rx="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

function SpeakerIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6.5 10.5v3h3.6l4.4 3.5V7l-4.4 3.5H6.5Z" />
      <path d="M16.8 8.2a4.8 4.8 0 0 1 0 7.6" />
      <path d="M19.2 6.1a8 8 0 0 1 0 11.8" />
    </Icon>
  );
}

function SpeakerMutedIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6.5 10.5v3h3.6l4.4 3.5V7l-4.4 3.5H6.5Z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </Icon>
  );
}

function ModelSwitcherIcon(props) {
  return (
    <Icon {...props} strokeWidth={1.7}>
      <path d="M12 4.8 14.9 12 12 19.2 9.1 12 12 4.8Z" />
      <path d="M8.2 8.2h1.8l1.2 1.8" />
      <path d="M15.8 15.8H14l-1.2-1.8" />
    </Icon>
  );
}

function buildComposerModelOptions(availableModels) {
  const normalizedModels = Array.isArray(availableModels)
    ? availableModels
        .filter((model) => model && model.id && model.label)
        .map((model) => ({
          id: String(model.id).trim(),
          label: String(model.label).trim()
        }))
        .filter((model) => model.id && model.label)
    : [];

  if (normalizedModels.length > 1) {
    const hasAuto = normalizedModels.some((model) => model.id === "auto");
    return hasAuto
      ? normalizedModels
      : [...normalizedModels, { id: "auto", label: "自动" }];
  }

  return [
    { id: "minimax", label: "MiniMax (主)" },
    { id: "k2p5", label: "Kimi (备)" },
    { id: "auto", label: "自动" }
  ];
}

function isModelSelected(modelStatus, modelId) {
  if (!modelStatus || !modelId) {
    return false;
  }

  return String(modelStatus.selectedModel || "").trim() === String(modelId).trim();
}

function upsertAssistantMessage(messages, messageId, content, streaming, patch = {}) {
  let found = false;
  const nextMessages = messages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    found = true;
    return {
      ...message,
      content,
      streaming,
      ...(patch.variant ? { variant: patch.variant } : {}),
      ...(patch.replayAudio ? { replayAudio: patch.replayAudio } : {}),
      ...(patch.llm
        ? {
            llm: {
              ...(message.llm || {}),
              ...patch.llm
            }
          }
        : {})
    };
  });

  if (!found) {
    nextMessages.push({
      id: messageId,
      role: "assistant",
      content,
      streaming,
      ...(patch.variant ? { variant: patch.variant } : {}),
      ...(patch.replayAudio ? { replayAudio: patch.replayAudio } : {}),
      ...(patch.llm ? { llm: patch.llm } : {})
    });
  }

  return nextMessages;
}

function attachReplayToLatestAssistant(messages, replayAudio) {
  let applied = false;
  const nextMessages = [...messages];

  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    const message = nextMessages[index];
    if (message.role !== "assistant" || message.streaming) {
      continue;
    }

    nextMessages[index] = {
      ...message,
      replayAudio
    };
    applied = true;
    break;
  }

  return applied ? nextMessages : messages;
}

function getLatestAssistantProviderMeta(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant") {
      return message.llm?.providerMeta || null;
    }
  }

  return null;
}

async function getBrowserLocation() {
  if (!navigator?.geolocation?.getCurrentPosition) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position?.coords?.latitude);
        const lon = Number(position?.coords?.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          resolve(null);
          return;
        }

        resolve({
          lat,
          lon,
          cachedAt: new Date().toISOString()
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60 * 60 * 1000
      }
    );
  });
}

function buildAvatarPresenceCopy(avatar) {
  const presence = avatar?.presence || "idle";
  const emotion = avatar?.emotion || "calm";

  if (presence === "thinking") {
    return {
      kicker: "她在整理语气",
      title: "先把这句话接稳",
      caption: "会慢一点，但不会把你晾在这里。"
    };
  }

  if (presence === "listening") {
    return {
      kicker: "她在听",
      title: "你可以继续往下说",
      caption: "不用把第一句整理得太完整。"
    };
  }

  if (presence === "speaking") {
    if (emotion === "concerned") {
      return {
        kicker: "她放轻了语气",
        title: "更像是在先接住你",
        caption: "不是劝说，是先把情绪托住。"
      };
    }

    if (emotion === "affectionate" || emotion === "whisper") {
      return {
        kicker: "距离稍微近了一点",
        title: "但不会突然越界",
        caption: "亲近感应该自然，不该用力。"
      };
    }

    return {
      kicker: "她在回应",
      title: "把这句话慢慢接上",
      caption: "你说下去就好。"
    };
  }

  return {
    kicker: "她在这里",
    title: "等你开口",
    caption: "安静，但不是空白。"
  };
}

function buildVoiceModeCopy(voiceMode) {
  if (voiceMode.enabled && voiceMode.available) {
    return {
      title: "语音回复已开启",
      detail: "她会把回复说出来，也可以在消息里重播。"
    };
  }

  if (voiceMode.enabled) {
    return {
      title: "语音回复待命中",
      detail: "这轮先用文字继续，语音链路还没完全接上。"
    };
  }

  return {
    title: "当前以文字回复",
    detail: "需要时可以切到语音回复。"
  };
}

function buildModelNotice(modelStatus, providerMeta) {
  if (providerMeta?.fallbackUsed || modelStatus?.fallbackUsed) {
    return "当前使用备用模型";
  }

  if (modelStatus?.manualSelection) {
    return `当前固定为 ${modelStatus.activeLabel}`;
  }

  return `当前主模型：${modelStatus?.activeLabel || "主模型"}`;
}

function applyRuntimeEvent(state, event) {
  if (!event || !event.type) {
    return state;
  }

  if (event.type === "assistant-state") {
    return {
      ...state,
      avatar: event.avatar || state.avatar,
      status: event.status || state.status,
      voiceMode: event.voiceMode || state.voiceMode,
      thinkingMode: event.thinkingMode || state.thinkingMode,
      modelStatus: event.modelStatus || state.modelStatus
    };
  }

  if (event.type === "assistant-stream-start") {
    return {
      ...state,
      messages: upsertAssistantMessage(state.messages, event.messageId, "", true)
    };
  }

  if (event.type === "assistant-stream-delta") {
    return {
      ...state,
      messages: upsertAssistantMessage(
        state.messages,
        event.messageId,
        event.content,
        true
      )
    };
  }

  if (event.type === "assistant-stream-complete") {
    return {
      ...state,
      messages: upsertAssistantMessage(
        state.messages,
        event.messageId,
        event.content,
        false,
        event.providerMeta
          ? {
              llm: {
                providerMeta: event.providerMeta
              }
            }
          : {}
      )
    };
  }

  if (event.type === "speech-state") {
    return {
      ...state,
      status: {
        ...(state.status || {}),
        speech: event.speech
      }
    };
  }

  if (event.type === "speech-error") {
    return {
      ...state,
      status: {
        ...(state.status || {}),
        speech: {
          ...(state.status?.speech || {}),
          status: "error",
          lastError: event.message
        }
      }
    };
  }

  if (event.type === "window-state") {
    return {
      ...state,
      window: {
        ...(state.window || {}),
        ...(event.window || {})
      }
    };
  }

  return state;
}

function StatusBadge({ label, subtle = false, icon = null }) {
  return (
    <div className={`status-badge ${subtle ? "is-subtle" : ""}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ErrorHint({ message, tone = "soft" }) {
  if (!message) {
    return null;
  }

  return (
    <div className={`error-hint is-${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
    </div>
  );
}

function StartupErrorScreen({ message, onRetry }) {
  return (
    <div className="startup-error-screen">
      <div className="startup-error-card" role="alert" aria-live="assertive">
        <div className="startup-error-icon">⚠</div>
        <h2>启动失败，请检查网络连接</h2>
        <p>{message || "启动失败，请检查网络连接"}</p>
        <button type="button" onClick={onRetry}>
          重试
        </button>
      </div>
    </div>
  );
}

function AvatarPanel({ avatar, avatarAsset, app, persona, bgmEnabled, onToggleBgm }) {
  const presenceCopy = buildAvatarPresenceCopy(avatar);

  return (
    <section className="avatar-shell">
      <div className="avatar-panel">
        <div
          className={`avatar-stage is-${avatar?.presence || "idle"} camera-${avatar?.camera || "wide"} emotion-${avatar?.emotion || "calm"} action-${avatar?.action || "none"}`}
        >
          <div className="scene-backdrop" />
          <div className="scene-glow" />
          <div className="avatar-halo" />
          <div className="avatar-orbit avatar-orbit-a" />
          <div className="avatar-orbit avatar-orbit-b" />
          <VrmAvatarStage avatar={avatar} avatarAsset={avatarAsset} />
          {!avatarAsset?.path ? (
            <div className="stage-copy">
              <span className="stage-kicker">{presenceCopy.kicker}</span>
              <strong>{presenceCopy.title}</strong>
              <p>{avatar?.caption || presenceCopy.caption}</p>
            </div>
          ) : null}
        </div>

        <div className="panel-copy-row">
          <div className="panel-copy">
            <span className="eyebrow">{app?.tagline || "克制而持续地在场"}</span>
            <h1>{persona?.name || "Vela"}</h1>
            <p>{persona?.shortBio}</p>
          </div>

          <button
            type="button"
            className={`panel-audio-toggle ${bgmEnabled ? "is-active" : "is-muted"}`}
            onClick={onToggleBgm}
            title={bgmEnabled ? "关闭背景音乐" : "开启背景音乐"}
            aria-label={bgmEnabled ? "关闭背景音乐" : "开启背景音乐"}
          >
            {bgmEnabled ? <SpeakerIcon size={16} /> : <SpeakerMutedIcon size={16} />}
          </button>
        </div>

      </div>
    </section>
  );
}

function MessageList({ messages, welcomeNote, bridgeDiaryNote, isBusy, assistantName, onReplay, sendError, onRetrySend }) {
  const listRef = useRef(null);
  const endRef = useRef(null);
  const hasStreamingAssistant = messages.some(
    (message) => message.role === "assistant" && message.streaming
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isBusy, sendError]);

  return (
    <div className="conversation" ref={listRef}>
      {bridgeDiaryNote ? (
        <div className="bridge-diary-note" aria-label="Vela bridge diary note">
          <div className="bridge-diary-note-inner">
            <span className="bridge-diary-avatar">V</span>
            <p>{bridgeDiaryNote}</p>
          </div>
        </div>
      ) : null}

      {welcomeNote ? <div className="welcome-card">{welcomeNote}</div> : null}

      {messages.length === 0 ? (
        <div className="empty-card">
          <p>想说什么就说什么，她在听。</p>
        </div>
      ) : null}

      {messages.map((message) => (
        <article
          key={message.id}
          className={`message-row is-${message.role} ${message.variant === "system-tip" ? "is-system-tip" : ""}`}
        >
          <div
            className={`message-bubble ${message.streaming ? "is-streaming" : ""} ${message.variant === "system-tip" ? "is-tip" : ""}`}
          >
            <div className="message-heading">
              <span className="message-role">
                {message.role === "assistant" ? assistantName || "Vela" : "你"}
              </span>
              {message.replayAudio ? (
                <button
                  type="button"
                  className="message-icon-button"
                  onClick={() => onReplay(message.replayAudio)}
                  title="重播语音"
                >
                  <ReplayIcon size={16} />
                </button>
              ) : null}
            </div>
            <p>
              {message.content}
              {message.streaming ? <span className="stream-caret" /> : null}
            </p>
          </div>
        </article>
      ))}

      {sendError ? (
        <article className="message-row is-assistant">
          <div className="message-error-banner" role="alert" aria-live="polite">
            <span>{sendError}</span>
            <button type="button" onClick={onRetrySend}>
              重试
            </button>
          </div>
        </article>
      ) : null}

      {isBusy && !hasStreamingAssistant ? (
        <article className="message-row is-assistant">
          <div className="message-bubble is-pending">
            <span className="message-role">{assistantName || "Vela"}</span>
            <p>她正在把这句话接稳。</p>
          </div>
        </article>
      ) : null}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}

const WAKE_TRANSITION_MS = 220;
const WAKE_PROGRESS_MIN_MS = 3200;
const WAKE_SUCCESS_HOLD_MS = 1600;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function OnboardingPanel({ onboarding, onConfirm, onComplete, isSubmitting }) {
  const [userName, setUserName] = useState(onboarding.fields.userName || "");
  const [phase, setPhase] = useState("welcome");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setPhase("welcome");
    setSubmitError("");
    setUserName(onboarding.fields.userName || "");
  }, [onboarding.fields.userName, onboarding.required]);

  async function handleWakeSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmitError("");
    setPhase("waking");

    try {
      const payload = {
        velaName: onboarding.fields.velaName || "Vela",
        userName: userName.trim(),
        temperament: onboarding.fields.temperament || "gentle-cool",
        distance: onboarding.fields.distance || "warm"
      };
      const [nextState] = await Promise.all([
        onConfirm(payload),
        wait(WAKE_PROGRESS_MIN_MS)
      ]);

      setPhase("success");
      await wait(WAKE_SUCCESS_HOLD_MS);
      onComplete(nextState);
    } catch (error) {
      setPhase("setup");
      setSubmitError(error.message || "唤醒失败，请再试一次。");
    }
  }

  return (
    <section className="chat-shell onboarding-shell">
      <div className="chat-header">
        <div className="chat-header-copy">
          <span className="eyebrow">First Wake</span>
          <h2>把这次见面做成自然唤醒</h2>
          <p>不用填很多设置，先轻轻叫醒她。</p>
        </div>
      </div>

      <div className="onboarding-form">
        {phase === "welcome" ? (
          <section className="onboarding-step">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 1 / 4</span>
              <p>准备好后，我们就从第一声称呼开始。</p>
            </div>
            <div className="composer-actions">
              <span className="onboarding-hint">这一步只负责开始，不需要复杂设置。</span>
              <button type="button" onClick={() => setPhase("setup")} disabled={isSubmitting}>
                开始唤醒
              </button>
            </div>
          </section>
        ) : null}

        {phase === "setup" ? (
          <form className="onboarding-step" onSubmit={handleWakeSubmit}>
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 2 / 4</span>
              <p>{onboarding.prompt}</p>
            </div>

            <label className="field-block">
              <span>她怎么叫你会更自然？</span>
              <input
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                placeholder="可以留空，之后再改"
              />
            </label>

            <div className="composer-actions">
              {submitError ? (
                <p className="error-text">{submitError}</p>
              ) : (
                <span className="onboarding-hint">先完成这个轻设置，其他内容后面再说。</span>
              )}
              <button type="submit" disabled={isSubmitting}>
                进入唤醒
              </button>
            </div>
          </form>
        ) : null}

        {phase === "waking" ? (
          <section className="onboarding-step onboarding-status">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 3 / 4</span>
              <p className="onboarding-status-title">正在唤醒</p>
              <p>她的语气、记忆和关系状态正在对齐，请稍等片刻。</p>
            </div>
          </section>
        ) : null}

        {phase === "success" ? (
          <section className="onboarding-step onboarding-status">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 4 / 4</span>
              <p className="onboarding-status-title">唤醒完成</p>
              <p>她已经在这里了，接下来直接开始对话就好。</p>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isMainEntering, setIsMainEntering] = useState(false);
  const [isSwitchingVoice, setIsSwitchingVoice] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({
    userAlias: "",
    bgmVolume: 42,
    ttsVolume: 100
  });
  const [isAsrListening, setIsAsrListening] = useState(false);
  const [asrHint, setAsrHint] = useState("");
  const [ttsHint, setTtsHint] = useState("");
  const [sendError, setSendError] = useState("");
  const [error, setError] = useState("");
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [isFullscreenBusy, setIsFullscreenBusy] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState("");
  const audioPlayerRef = useRef(null);
  const asrProviderRef = useRef(null);
  const bgmControllerRef = useRef(null);
  const asrHintTimerRef = useRef(null);
  const ttsHintTimerRef = useRef(null);
  const modelSwitcherRef = useRef(null);
  const proactiveBusyRef = useRef(false);

  useEffect(() => {
    const bgm = new BgmController();
    bgmControllerRef.current = bgm;

    return () => {
      void bgm.dispose();
      bgmControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = new AudioPlayerService();
    audioPlayerRef.current = player;

    return () => {
      void player.dispose();
    };
  }, []);

  useEffect(() => {
    asrProviderRef.current = createWebSpeechProvider();

    return () => {
      if (asrHintTimerRef.current) {
        window.clearTimeout(asrHintTimerRef.current);
        asrHintTimerRef.current = null;
      }
      if (ttsHintTimerRef.current) {
        window.clearTimeout(ttsHintTimerRef.current);
        ttsHintTimerRef.current = null;
      }

      asrProviderRef.current?.stop();
      asrProviderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    setSettingsDraft({
      userAlias: state.persona?.userName || "",
      bgmVolume: Number(state.audio?.bgmVolume ?? 42),
      ttsVolume: Number(state.audio?.ttsVolume ?? Math.round((state.tts?.volume ?? 1) * 100))
    });
  }, [state.audio?.bgmVolume, state.audio?.ttsVolume, state.persona?.userName, state.tts?.volume]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [nextState, windowState] = await Promise.all([
          window.vela.bootstrap(),
          window.vela.getWindowState().catch(() => ({ fullscreen: false }))
        ]);
        if (isMounted) {
          setState({
            ...nextState,
            window: {
              ...(nextState.window || {}),
              ...(windowState || {})
            }
          });
          setIsMainEntering(false);

          void window.vela.loadBridgeDiary().then((diaryState) => {
            if (!isMounted || !diaryState?.bridgeDiaryNote) {
              return;
            }

            setState((current) => ({
              ...current,
              bridgeDiaryNote: diaryState.bridgeDiaryNote
            }));
          }).catch(() => {});
        }
      } catch (bootstrapError) {
        if (isMounted) {
          setError(bootstrapError.message || "启动失败，请检查网络连接");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncLocationAndMaybeGreet() {
      try {
        const location = await getBrowserLocation();

        if (cancelled || !location) {
          return;
        }

        await window.vela.cacheLocation(location);
      } catch {
        // Ignore geolocation/cache failures and keep city fallback working.
      }
    }

    void syncLocationAndMaybeGreet();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.vela.onEvent((event) => {
      if (event.type === "speech-audio-chunk") {
        audioPlayerRef.current?.appendChunk(event.chunk);
        bgmControllerRef.current?.duck();
      }

      const replay =
        event.type === "speech-finished" && !event.cancelled
          ? audioPlayerRef.current?.finish(event.sessionId || "vela-tts")
          : null;

      if (event.type === "speech-finished" && event.cancelled) {
        audioPlayerRef.current?.reset();
        bgmControllerRef.current?.unduck();
      }

      if (event.type === "speech-finished" && !event.cancelled) {
        bgmControllerRef.current?.unduck();
      }

      if (event.type === "speech-error") {
        audioPlayerRef.current?.reset();
        bgmControllerRef.current?.unduck();
        flashTtsHint("语音暂时不可用");
      }

      setState((current) => {
        const nextState = applyRuntimeEvent(current, event);

        if (replay?.url) {
          return {
            ...nextState,
            messages: attachReplayToLatestAssistant(nextState.messages, replay)
          };
        }

        return nextState;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isModelMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (modelSwitcherRef.current && !modelSwitcherRef.current.contains(event.target)) {
        setIsModelMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsModelMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModelMenuOpen]);

  useEffect(() => {
    if (isLoading || state.onboarding?.required) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void maybeRunProactive("open");
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isLoading, state.onboarding?.required]);

  useEffect(() => {
    if (isLoading || state.onboarding?.required) {
      return undefined;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void maybeRunProactive("open");
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoading, state.onboarding?.required]);

  useEffect(() => {
    if (isLoading || state.onboarding?.required) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void maybeRunProactive("trigger");
      }
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isLoading, state.onboarding?.required]);

  useEffect(() => {
    const bgm = bgmControllerRef.current;
    if (!bgm) {
      return undefined;
    }

    bgm.setEnabled(bgmEnabled);

    if (!bgmEnabled) {
      bgm.pause();
      return undefined;
    }

    const getSceneTrack = () => {
      const hour = new Date().getHours();
      const sceneType = hour >= 6 && hour < 18 ? "day" : "night";
      return `/assets/bgm/${sceneType}.mp3`;
    };

    const syncTrack = () => {
      const track = getSceneTrack();
      if (!bgm.activeTrackUrl) {
        void bgm.loadAndPlay(track);
        return;
      }

      void bgm.switchTrack(track);
    };

    void bgm.resume().then(() => {
      syncTrack();
    });

    const intervalId = window.setInterval(() => {
      syncTrack();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [bgmEnabled, isLoading, state.onboarding?.required]);

  useEffect(() => {
    if (state.voiceMode.enabled || state.avatar?.presence !== "speaking") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setState((current) => {
        if (current.voiceMode.enabled || current.avatar?.presence !== "speaking") {
          return current;
        }

        const nextAvatar = settleAvatarState(current.avatar, {
          voiceModeEnabled: false
        });

        return {
          ...current,
          avatar: nextAvatar,
          status: {
            ...(current.status || {}),
            phase: nextAvatar.presence
          }
        };
      });
    }, 1100);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [state.avatar, state.voiceMode.enabled]);

  useEffect(() => {
    if (!state.avatar?.cameraHoldMs || state.avatar.camera !== "close") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setState((current) => {
        if (!current.avatar || current.avatar.camera !== "close") {
          return current;
        }

        return {
          ...current,
          avatar: releaseCloseCamera(current.avatar)
        };
      });
    }, state.avatar.cameraHoldMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [state.avatar]);

  useEffect(() => {
    if (!isMainEntering) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setIsMainEntering(false);
    }, WAKE_TRANSITION_MS + 30);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isMainEntering]);

  const canInterrupt = useMemo(() => {
    return (
      state.status?.phase === "speaking" ||
      ["queued", "speaking", "finishing"].includes(state.status?.speech?.status)
    );
  }, [state.status]);

  const latestAssistantProviderMeta = useMemo(
    () => getLatestAssistantProviderMeta(state.messages),
    [state.messages]
  );

  const canUseAsr = Boolean(
    (state.status?.asr?.configured && state.status?.asr?.available) ||
    (state.asr?.configured && state.asr?.available)
  );

  const naturalComposerHint = useMemo(() => {
    if (isVoiceMode && state.voiceMode.enabled) {
      return "语音模式已开，听写和播报可以分开控制。";
    }

    if (isVoiceMode) {
      return "语音模式已开，先说最想说的那一句。";
    }

    if (state.voiceMode.enabled && !state.voiceMode.available) {
      return "语音回复还没完全接通，这轮会先用文字继续。";
    }

    if (state.modelStatus?.fallbackUsed || latestAssistantProviderMeta?.fallbackUsed) {
      return "当前会自动走备用模型，不影响继续对话。";
    }

    return "不用整理得太完整，先说最想说的那一句。";
  }, [
    latestAssistantProviderMeta?.fallbackUsed,
    state.modelStatus?.fallbackUsed,
    isVoiceMode,
    state.voiceMode.available,
    state.voiceMode.enabled
  ]);

  const composerModelOptions = useMemo(
    () => buildComposerModelOptions(state.modelStatus?.availableModels),
    [state.modelStatus?.availableModels]
  );

  function clearAsrHint() {
    if (asrHintTimerRef.current) {
      window.clearTimeout(asrHintTimerRef.current);
      asrHintTimerRef.current = null;
    }

    setAsrHint("");
  }

  function flashAsrHint(message) {
    clearAsrHint();
    setAsrHint(message);
    asrHintTimerRef.current = window.setTimeout(() => {
      setAsrHint("");
      asrHintTimerRef.current = null;
    }, 5000);
  }

  function clearTtsHint() {
    if (ttsHintTimerRef.current) {
      window.clearTimeout(ttsHintTimerRef.current);
      ttsHintTimerRef.current = null;
    }

    setTtsHint("");
  }

  function flashTtsHint(message) {
    clearTtsHint();
    setTtsHint(message);
    ttsHintTimerRef.current = window.setTimeout(() => {
      setTtsHint("");
      ttsHintTimerRef.current = null;
    }, 5000);
  }

  function getSendErrorMessage(rawMessage) {
    const message = String(rawMessage || "").toLowerCase();

    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("etimedout")
    ) {
      return "请求超时，请重试";
    }

    if (
      message.includes("429") ||
      message.includes("503") ||
      message.includes("rate") ||
      message.includes("limit") ||
      message.includes("model") ||
      message.includes("provider") ||
      message.includes("unavailable") ||
      message.includes("overloaded")
    ) {
      return "模型暂时不可用";
    }

    return "连接失败，点击重试";
  }

  function getAsrErrorMessage(errorLike) {
    const code = String(errorLike?.code || errorLike?.message || "").toLowerCase();

    if (code.includes("not-allowed") || code.includes("permission") || code.includes("service-not-allowed")) {
      return "请允许麦克风权限";
    }

    return "无法识别语音";
  }

  const maybeRunProactive = useEffectEvent(async (kind) => {
    if (
      proactiveBusyRef.current ||
      isLoading ||
      isSending ||
      state.onboarding?.required ||
      state.status?.phase === "thinking" ||
      state.status?.phase === "speaking"
    ) {
      return;
    }

    proactiveBusyRef.current = true;

    try {
      const nextState =
        kind === "open"
          ? await window.vela.proactiveOpen()
          : await window.vela.proactiveTrigger();

      if (nextState?.messages) {
        setState(nextState);
      }
    } catch {
      // Keep proactive checks silent in the UI.
    } finally {
      proactiveBusyRef.current = false;
    }
  });

  async function handleOnboarding(payload) {
    setIsOnboarding(true);
    setError("");

    try {
      const nextState = await window.vela.ipcRenderer.invoke("vela:complete-onboarding-v2", payload);
      return nextState;
    } catch (submitError) {
      const message = submitError.message || "初始化失败。";
      setError(message);
      throw new Error(message);
    } finally {
      setIsOnboarding(false);
    }
  }

  function handleOnboardingComplete(nextState) {
    setError("");
    setState(nextState);
    setIsMainEntering(true);
  }

  async function handleInterrupt() {
    setError("");

    try {
      const nextState = await window.vela.interruptOutput();
      audioPlayerRef.current?.reset();
      setState(nextState);
    } catch (interruptError) {
      setError(interruptError.message || "停止当前语音失败。");
    }
  }

  const submitDraftText = useEffectEvent(async (text, options = {}) => {
    const trimmed = String(text || "").trim();
    const isRetry = Boolean(options.retry);

    if (!trimmed || isSending) {
      return;
    }

    if (canInterrupt) {
      try {
        const interruptedState = await window.vela.interruptOutput();
        audioPlayerRef.current?.reset();
        setState(interruptedState);
      } catch (interruptError) {
        setError(interruptError.message || "打断当前输出失败。");
      }
    }

    const optimisticMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    setDraft("");
    setError("");
    setSendError("");
    setLastUserMessage(trimmed);
    setIsSending(true);
    setState((current) => ({
      ...current,
      welcomeNote: "",
      avatar: current.avatar
        ? {
            ...current.avatar,
            presence: "thinking",
            label: "她停一下在想",
            action: "none",
            actionLabel: "安静地等着",
            caption: "她在想怎么把这句话接稳。"
          }
        : current.avatar,
      status: {
        ...(current.status || {}),
        phase: "thinking"
      },
      messages: isRetry ? current.messages : [...current.messages, optimisticMessage]
    }));

    try {
      const nextState = await window.vela.sendMessage(trimmed);
      setState(nextState);
      setSendError("");
    } catch (sendError) {
      setSendError(getSendErrorMessage(sendError.message || sendError));
      audioPlayerRef.current?.reset();
    } finally {
      setIsSending(false);
    }
  });

  function handleSubmit(event) {
    event.preventDefault();
    void submitDraftText(draft);
  }

  function handleRetrySend() {
    if (!lastUserMessage || isSending) {
      return;
    }

    void submitDraftText(lastUserMessage, { retry: true });
  }

  const stopAsrListening = useEffectEvent((options = {}) => {
    const provider = asrProviderRef.current || createWebSpeechProvider();
    asrProviderRef.current = provider;

    if (provider.isListening()) {
      provider.stop();
    }

    setIsAsrListening(false);

    if (!options.keepHint) {
      clearAsrHint();
    }
  });

  const asrRetryCountRef = useRef(0);

  const startAsrListening = useEffectEvent(() => {
    if (isSending) {
      return;
    }

    const provider = asrProviderRef.current || createWebSpeechProvider();
    asrProviderRef.current = provider;

    if (provider.isListening()) {
      return;
    }

    setError("");

    provider.start(
      (transcript) => {
        const nextTranscript = String(transcript || "").trim();
        setIsAsrListening(false);

        if (!nextTranscript) {
          if (isMicEnabled && isVoiceMode) {
            flashAsrHint("无法识别语音");
            window.setTimeout(() => void startAsrListening(), 1000);
          }
          return;
        }

        clearAsrHint();
        setDraft(nextTranscript);
        void submitDraftText(nextTranscript);

        if (isMicEnabled && isVoiceMode) {
          window.setTimeout(() => void startAsrListening(), 1500);
        }
      },
      (asrError) => {
        setIsAsrListening(false);
        flashAsrHint(getAsrErrorMessage(asrError));
      }
    );

    setIsAsrListening(true);
  });

  async function handleVoiceToggle() {
    setIsSwitchingVoice(true);
    setError("");

    try {
      const nextState = await window.vela.setVoiceMode(!state.voiceMode.enabled);
      if (state.voiceMode.enabled) {
        audioPlayerRef.current?.reset();
      }
      setState(nextState);
    } catch (toggleError) {
      setError(toggleError.message || "语音模式切换失败。");
    } finally {
      setIsSwitchingVoice(false);
    }
  }

  async function handleVoiceModeEnter() {
    setIsVoiceMode(true);
    setIsMicEnabled(true);

    // Always call backend to ensure TTS is enabled — don't trust frontend state
    setIsSwitchingVoice(true);
    try {
      const nextState = await window.vela.setVoiceMode(true);
      setState(nextState);
    } catch (e) {
      setError(e.message || "语音模式启动失败");
    } finally {
      setIsSwitchingVoice(false);
    }

    void startAsrListening();
  }

  async function handleVoiceModeExit() {
    stopAsrListening();
    setIsMicEnabled(false);
    setIsVoiceMode(false);

    // Disable TTS when exiting voice mode
    if (state.voiceMode.enabled) {
      setIsSwitchingVoice(true);
      try {
        const nextState = await window.vela.setVoiceMode(false);
        audioPlayerRef.current?.reset();
        setState(nextState);
      } catch (e) {
        setError(e.message || "语音模式关闭失败");
      } finally {
        setIsSwitchingVoice(false);
      }
    }
  }

  function handleMicToggle() {
    if (isMicEnabled) {
      // Turn off
      stopAsrListening();
      setIsMicEnabled(false);
    } else {
      // Turn on
      setIsMicEnabled(true);
      void startAsrListening();
    }
  }

  function handleAsrToggle() {
    handleMicToggle();
  }

  async function handleModelSwitch(modelId) {
    if (!modelId) {
      return;
    }

    setIsModelMenuOpen(false);
    setError("");

    try {
      const nextState = await window.vela.switchModel(modelId);
      if (nextState) {
        setState(nextState);
      }
    } catch (switchError) {
      setError(switchError.message || "模型切换失败。");
    }
  }

  async function handleSettingsSave(nextState, payload) {
    if (payload && bgmControllerRef.current) {
      bgmControllerRef.current.setVolume(Number(payload.bgmVolume) / 100);
    }

    if (nextState) {
      setState(nextState);
    }
  }

  async function handleFullscreenToggle() {
    if (isFullscreenBusy) {
      return;
    }

    setIsFullscreenBusy(true);
    setError("");

    try {
      const nextWindowState = await window.vela.setFullscreen(!state.window?.fullscreen);
      setState((current) => ({
        ...current,
        window: {
          ...(current.window || {}),
          ...(nextWindowState || {})
        }
      }));
      setIsSettingsOpen(false);
      setIsModelMenuOpen(false);
    } catch (fullscreenError) {
      setError(fullscreenError.message || "全屏切换失败。");
    } finally {
      setIsFullscreenBusy(false);
    }
  }

  function handleReplay(replayAudio) {
    audioPlayerRef.current?.playReplay(replayAudio);
  }

  function handleBgmToggle() {
    setBgmEnabled((current) => {
      const next = !current;
      const bgm = bgmControllerRef.current;
      if (bgm) {
        bgm.setEnabled(next);
        if (!next) {
          bgm.pause();
        } else {
          void bgm.resume();
        }
      }
      return next;
    });
  }

  const isFullscreen = Boolean(state.window?.fullscreen);

  return (
    <main className={`app-shell ${isFullscreen ? "is-fullscreen" : ""}`}>
      {!splashDone ? (
        <SplashScreen onDone={() => setSplashDone(true)} />
      ) : (
        <>
          <div className="ambient ambient-a" />
          <div className="ambient ambient-b" />

          {isLoading ? (
            <div className="loading-screen" />
          ) : error && !state.app ? (
            <StartupErrorScreen
              message={error}
              onRetry={() => {
                window.location.reload();
              }}
            />
          ) : (
            <div className={`surface ${isFullscreen ? "is-fullscreen" : ""}`}>
              <AvatarPanel
                avatar={state.avatar}
                avatarAsset={state.avatarAsset}
                app={state.app}
                persona={state.persona}
                bgmEnabled={bgmEnabled}
                onToggleBgm={handleBgmToggle}
              />

              {state.onboarding?.required ? (
                <OnboardingFlow
                  initialValues={{
                    userName: state.persona?.userName || "",
                    llmApiKey: state.llm?.apiKey || "",
                    asrEnabled: state.asr?.enabled,
                    ttsEnabled: state.tts?.enabled
                  }}
                  onComplete={async (payload) => {
                    const nextState = await handleOnboarding(payload);
                    handleOnboardingComplete(nextState);
                    return nextState;
                  }}
                  isSubmitting={isOnboarding}
                />
              ) : (
                <section className={`chat-shell ${isMainEntering ? "is-main-enter" : ""} ${isFullscreen ? "is-fullscreen" : ""}`}>

              <MessageList
                messages={state.messages}
                bridgeDiaryNote={state.bridgeDiaryNote}
                welcomeNote={state.welcomeNote}
                isBusy={isSending}
                assistantName={state.persona?.name || "Vela"}
                onReplay={handleReplay}
                sendError={sendError}
                onRetrySend={handleRetrySend}
              />

              <form
                className={`composer ${isVoiceMode ? "is-voice-mode" : ""}`}
                onSubmit={handleSubmit}
              >
                <div className={`composer-field ${isVoiceMode ? "is-voice-mode" : ""}`}>
                  <label className="sr-only" htmlFor="composer-draft">
                    输入消息
                  </label>

                  <div className="composer-voice-controls" aria-hidden={!isVoiceMode}>
                    <div className="voice-control-group">
                      <button
                        type="button"
                        className={`voice-control-button mic-control ${isMicEnabled ? "is-active" : "is-muted"}`}
                        onClick={handleMicToggle}
                        disabled={isSending}
                        title={isMicEnabled ? "关闭麦克风" : "开启麦克风"}
                        aria-label={isMicEnabled ? "关闭麦克风" : "开启麦克风"}
                      >
                        {isMicEnabled ? <MicIcon size={16} /> : <SpeakerMutedIcon size={16} />}
                      </button>
                      <ErrorHint message={asrHint} tone="asr" />
                    </div>
                    <div className="voice-control-group">
                      <button
                        type="button"
                        className={`voice-control-button speaker-control ${state.voiceMode.enabled ? "is-active" : "is-muted"}`}
                        onClick={handleVoiceToggle}
                        disabled={isSwitchingVoice}
                        title={state.voiceMode.enabled ? "关闭语音回复" : "开启语音回复"}
                        aria-label={state.voiceMode.enabled ? "关闭语音回复" : "开启语音回复"}
                      >
                        {state.voiceMode.enabled ? <SpeakerIcon size={16} /> : <SpeakerMutedIcon size={16} />}
                      </button>
                      <ErrorHint message={ttsHint} tone="tts" />
                    </div>
                  </div>

                  <textarea
                    id="composer-draft"
                    rows="3"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      isAsrListening
                        ? "正在听..."
                        : isVoiceMode
                          ? "说点什么，或者直接打字。"
                          : "把现在最想说的那句交给她。"
                    }
                  />

                  <div className="composer-primary-action">
                    {draft.trim() ? (
                      <button
                        type="submit"
                        className="composer-primary-button is-send"
                        disabled={isSending}
                        title="发送"
                        aria-label="发送"
                      >
                        <SendIcon size={20} />
                      </button>
                    ) : isVoiceMode ? (
                      <button
                        type="button"
                        className="composer-primary-button is-stop"
                        onClick={handleVoiceModeExit}
                        title="停止"
                      >
                        <StopIcon size={16} />
                        <span>停止</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="composer-primary-button is-voice-start"
                        onClick={handleVoiceModeEnter}
                        disabled={isSending}
                        title="开始说话"
                      >
                        <MicIcon size={16} />
                        <span>开始说话</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="composer-actions">
                  <div className="composer-meta">
                    <button
                      type="button"
                      className="secondary-button settings-trigger"
                      onClick={() => setIsSettingsOpen(true)}
                    >
                      Settings
                    </button>
                    <div
                      className={`composer-model-switcher ${isModelMenuOpen ? "model-switcher-open" : ""}`}
                      ref={modelSwitcherRef}
                    >
                      <button
                        type="button"
                        className="model-switcher-button"
                        onClick={() => setIsModelMenuOpen((current) => !current)}
                        title={`切换模型：${state.modelStatus?.selectedLabel || "自动"}`}
                        aria-label="切换模型"
                        aria-haspopup="menu"
                        aria-expanded={isModelMenuOpen}
                      >
                        <ModelSwitcherIcon size={14} />
                      </button>

                      <div className="model-switcher-menu" role="menu" aria-label="模型切换">
                        {composerModelOptions.map((model) => {
                          const selected = isModelSelected(state.modelStatus, model.id);

                          return (
                            <button
                              key={model.id}
                              type="button"
                              className={`model-switcher-item ${selected ? "is-selected" : ""}`}
                              onClick={() => void handleModelSwitch(model.id)}
                              role="menuitemradio"
                              aria-checked={selected}
                            >
                              <span className="model-switcher-item-label">{model.label}</span>
                              {selected ? <span className="model-switcher-check">✓</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {error ? (
                      <p className="error-text">{error}</p>
                    ) : (
                      <span className="composer-hint">
                        {isAsrListening ? "正在听..." : naturalComposerHint}
                      </span>
                    )}
                  </div>

                  <div className="composer-secondary-actions">
                    <button
                      type="button"
                      className={`secondary-button fullscreen-toggle ${isFullscreen ? "is-active" : ""}`}
                      onClick={handleFullscreenToggle}
                      disabled={isFullscreenBusy}
                      title={isFullscreen ? "退出沉浸模式" : "进入沉浸模式"}
                      aria-label={isFullscreen ? "退出沉浸模式" : "进入沉浸模式"}
                    >
                      {isFullscreen ? <FullscreenExitIcon size={15} /> : <FullscreenEnterIcon size={15} />}
                      <span>{isFullscreen ? "退出沉浸" : "沉浸模式"}</span>
                    </button>
                    {canInterrupt ? (
                      <button type="button" className="secondary-button" onClick={handleInterrupt}>
                        <UpRightIcon size={15} />
                        <span>先停一下</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </form>
                </section>
              )}
            </div>
          )}
        </>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        initialValues={settingsDraft}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={handleSettingsSave}
      />
    </main>
  );
}




