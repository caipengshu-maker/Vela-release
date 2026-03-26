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
import { VelaTitleScreen } from "./VelaTitleScreen.jsx";
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

function formatRelativeTimestamp(value, now = Date.now()) {
  const timestamp = Date.parse(String(value || "").trim());

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMinutes < 1) {
    return "刚刚";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }

  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  const date = new Date(timestamp);
  const nowDate = new Date(now);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startOfNow = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const dayDiff = Math.floor((startOfNow - startOfDate) / 86400000);

  if (dayDiff === 1) {
    return "昨天";
  }

  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
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

  return null;
}

function getBundledBgmAssetPath() {
  const hour = new Date().getHours();
  const sceneType = hour >= 6 && hour < 18 ? "day" : "night";
  return `assets/bgm/${sceneType}.mp3`;
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

function AvatarPanel({
  avatar,
  avatarAsset,
  app,
  persona,
  bgmEnabled,
  onToggleBgm,
  isFullscreen,
  onToggleFullscreen,
  isFullscreenBusy,
  isChatMinimized,
  onToggleChatMinimized
}) {
  const presenceCopy = buildAvatarPresenceCopy(avatar);

  return (
    <section className={`avatar-shell ${isFullscreen ? "is-fullscreen" : ""}`}>
      <div className="avatar-panel">
        <div
          className={`avatar-stage is-${avatar?.presence || "idle"} camera-${avatar?.camera || "wide"} emotion-${avatar?.emotion || "calm"} action-${avatar?.action || "none"} ${isFullscreen ? "is-fullscreen" : ""}`}
        >
          {isFullscreen ? (
            <div className="fullscreen-overlay-controls">
              <button
                type="button"
                className="avatar-overlay-button"
                onClick={onToggleChatMinimized}
                title={isChatMinimized ? "展开聊天面板" : "收起聊天面板"}
                aria-label={isChatMinimized ? "展开聊天面板" : "收起聊天面板"}
              >
                <span>{isChatMinimized ? "显示聊天" : "收起聊天"}</span>
              </button>
              <button
                type="button"
                className="avatar-overlay-button avatar-overlay-button-exit"
                onClick={onToggleFullscreen}
                disabled={isFullscreenBusy}
                title="退出沉浸模式"
                aria-label="退出沉浸模式"
              >
                <FullscreenExitIcon size={14} />
                <span>退出全屏</span>
              </button>
            </div>
          ) : null}
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
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const hasStreamingAssistant = messages.some(
    (message) => message.role === "assistant" && message.streaming
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isBusy, sendError]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeTick(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const showAmbientEmpty = messages.length === 0 && !welcomeNote;

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

      {showAmbientEmpty ? (
        <div className="empty-ambient-text" aria-hidden="true">
          <p>她在，你说就好。</p>
        </div>
      ) : null}

      {messages.length === 0 && welcomeNote ? (
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
            {message.createdAt ? (
              <time className="message-timestamp" dateTime={message.createdAt}>
                {formatRelativeTimestamp(message.createdAt, timeTick)}
              </time>
            ) : null}
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

export default function App() {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSettled, setIsSettled] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [titleDone, setTitleDone] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isMainEntering, setIsMainEntering] = useState(false);
  const [isSwitchingVoice, setIsSwitchingVoice] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
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
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [isFarewelling, setIsFarewelling] = useState(false);
  const isFullscreen = Boolean(state.window?.fullscreen);
  const audioPlayerRef = useRef(null);
  const asrProviderRef = useRef(null);
  const bgmControllerRef = useRef(null);
  const asrHintTimerRef = useRef(null);
  const ttsHintTimerRef = useRef(null);
  const lipSyncFrameRef = useRef(null);
  const lipSyncActiveRef = useRef(false);
  const lipSyncLastFrameAtRef = useRef(0);
  const lipSyncSmoothedRef = useRef(0);
  const proactiveBusyRef = useRef(false);

  const stopLipSync = useEffectEvent(() => {
    lipSyncActiveRef.current = false;

    if (lipSyncFrameRef.current) {
      window.cancelAnimationFrame(lipSyncFrameRef.current);
      lipSyncFrameRef.current = null;
    }

    lipSyncLastFrameAtRef.current = 0;
    lipSyncSmoothedRef.current = 0;
    audioPlayerRef.current?.resetLipSync?.();
    window.__velaSetMouthOpenness?.(0);
    window.__velaSetVisemeWeights?.(null);
  });

  const tickLipSync = useEffectEvent((frameAt) => {
    if (!lipSyncActiveRef.current) {
      lipSyncFrameRef.current = null;
      return;
    }

    const lastFrameAt = lipSyncLastFrameAtRef.current || frameAt;
    lipSyncLastFrameAtRef.current = frameAt;

    const frame = audioPlayerRef.current?.update(frameAt - lastFrameAt) || {
      amplitude: 0,
      visemeActive: false,
      visemeWeights: {}
    };
    const amplitude = Number(frame.amplitude || 0);
    const previous = lipSyncSmoothedRef.current;
    const smoothed = frame.visemeActive
      ? 0
      : previous + (amplitude - previous) * 0.3;

    lipSyncSmoothedRef.current = smoothed;
    window.__velaSetMouthOpenness?.(smoothed);
    window.__velaSetVisemeWeights?.(
      frame.visemeActive ? frame.visemeWeights : null
    );

    lipSyncFrameRef.current = window.requestAnimationFrame(tickLipSync);
  });

  const startLipSync = useEffectEvent(() => {
    if (lipSyncActiveRef.current || !audioPlayerRef.current) {
      return;
    }

    lipSyncActiveRef.current = true;
    lipSyncLastFrameAtRef.current = performance.now();
    lipSyncFrameRef.current = window.requestAnimationFrame(tickLipSync);
  });

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
    player.setPlaybackEndedHandler(() => {
      bgmControllerRef.current?.unduck();
      stopLipSync();
    });
    audioPlayerRef.current = player;

    return () => {
      player.setPlaybackEndedHandler(null);
      stopLipSync();
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
    const bgm = bgmControllerRef.current;
    if (!bgm) {
      return;
    }

    bgm.setVolume(Number(state.audio?.bgmVolume ?? 42) / 100);
  }, [state.audio?.bgmVolume]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [nextState, windowState, fullscreenValue] = await Promise.all([
          window.vela.bootstrap(),
          window.vela.getWindowState().catch(() => ({ fullscreen: false })),
          window.vela.isFullscreen().catch(() => false)
        ]);
        if (isMounted) {
          setState({
            ...nextState,
            window: {
              ...(nextState.window || {}),
              ...(windowState || {}),
              fullscreen: Boolean(
                typeof fullscreenValue === "boolean"
                  ? fullscreenValue
                  : windowState?.fullscreen
              )
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
          // Give VRM a moment to render first frame + settle hair physics
          setTimeout(() => {
            if (isMounted) setIsSettled(true);
          }, 600);
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
        startLipSync();
      }

      if (event.type === "farewell") {
        triggerFarewell();
        return;
      }

      const replay =
        event.type === "speech-finished" && !event.cancelled
          ? audioPlayerRef.current?.finish(event.sessionId || "vela-tts")
          : null;

      if (event.type === "speech-finished" && event.cancelled) {
        audioPlayerRef.current?.reset();
        bgmControllerRef.current?.unduck();
        stopLipSync();
      }

      if (event.type === "speech-error") {
        audioPlayerRef.current?.reset();
        bgmControllerRef.current?.unduck();
        stopLipSync();
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
      stopLipSync();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      const key = String(event.key || "").toLowerCase();
      const targetTag = String(event.target?.tagName || "").toLowerCase();
      const isTypingTarget =
        targetTag === "textarea" ||
        targetTag === "input" ||
        event.target?.isContentEditable;

      if (key === "escape" && isFullscreen) {
        event.preventDefault();
        void handleFullscreenToggle(false);
      }

      if (key === "f11") {
        event.preventDefault();
        void handleFullscreenToggle();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "f" && !isTypingTarget) {
        event.preventDefault();
        void handleFullscreenToggle();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleFullscreenToggle, isFullscreen]);

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

    const syncTrack = async () => {
      const assetPath = getBundledBgmAssetPath();
      if (bgm.activeTrackUrl === assetPath && bgm.current) {
        return;
      }

      try {
        const payload = await window.vela.readBundledAsset(assetPath);
        const arrayBuffer = toArrayBuffer(payload);

        if (!arrayBuffer) {
          return;
        }

        await bgm.loadFromBuffer(arrayBuffer, assetPath);
      } catch (err) {
        console.warn("[bgm] failed to load:", assetPath, err?.message);
      }
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
      content: trimmed,
      createdAt: new Date().toISOString()
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

  async function handleFullscreenToggle(nextValue) {
    if (isFullscreenBusy) {
      return;
    }

    setIsFullscreenBusy(true);
    setError("");

    try {
      const nextWindowState =
        typeof nextValue === "boolean"
          ? await window.vela.setFullscreen(nextValue)
          : await window.vela.toggleFullscreen();

      setState((current) => ({
        ...current,
        window: {
          ...(current.window || {}),
          ...(nextWindowState || {})
        }
      }));
      setIsSettingsOpen(false);
    } catch (fullscreenError) {
      setError(fullscreenError.message || "全屏切换失败。");
    } finally {
      setIsFullscreenBusy(false);
    }
  }

  function handleReplay(replayAudio) {
    audioPlayerRef.current?.playReplay(replayAudio);
    bgmControllerRef.current?.duck();
    startLipSync();
  }

  function triggerFarewell() {
    setIsFarewelling(true);
    setState((current) => {
      if (!current.avatar) {
        return current;
      }

      return {
        ...current,
        avatar: {
          ...current.avatar,
          presence: "speaking",
          emotion: "affectionate",
          action: "wave",
          actionLabel: "挥手",
          expression: "happy",
          motion: "soft-lean",
          caption: "那我先轻轻挥一下手。",
          camera: current.avatar.camera === "close" ? "close" : "wide"
        },
        status: {
          ...(current.status || {}),
          phase: "speaking"
        }
      };
    });
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

  const relationshipStage = String(state.avatar?.relationshipStage || "reserved").trim().toLowerCase();
  const relationshipClass = ["reserved", "warm", "close"].includes(relationshipStage)
    ? `relationship-${relationshipStage}`
    : "relationship-reserved";

  useEffect(() => {
    if (!isFullscreen) {
      setIsChatMinimized(false);
    }
  }, [isFullscreen]);

  return (
    <main className={`app-shell ${relationshipClass} ${isFullscreen ? "is-fullscreen" : ""} ${isFarewelling ? "is-farewelling" : ""} ${!titleDone ? "is-title-active" : ""}`}>
      {/* Content always renders behind the overlay stack so VRM loads early. */}
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      {error && !state.app ? (
        <StartupErrorScreen
          message={error}
          onRetry={() => {
            window.location.reload();
          }}
        />
          ) : (
            <div className={`surface ${isFullscreen ? "is-fullscreen" : ""} ${isChatMinimized ? "is-chat-minimized" : ""}`}>
              <AvatarPanel
                avatar={state.avatar}
                avatarAsset={state.avatarAsset}
                app={state.app}
                persona={state.persona}
                bgmEnabled={bgmEnabled}
                onToggleBgm={handleBgmToggle}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => void handleFullscreenToggle(false)}
                isFullscreenBusy={isFullscreenBusy}
                isChatMinimized={isChatMinimized}
                onToggleChatMinimized={() => setIsChatMinimized((current) => !current)}
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
                <section className={`chat-shell ${isMainEntering ? "is-main-enter" : ""} ${isFullscreen ? "is-fullscreen" : ""} ${isChatMinimized ? "is-minimized" : ""}`}>

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
                      title="设置"
                      aria-label="设置"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    </button>

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
                      onClick={() => void handleFullscreenToggle()}
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

      <SettingsModal
        isOpen={isSettingsOpen}
        initialValues={settingsDraft}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={handleSettingsSave}
        models={composerModelOptions}
        selectedModel={state.modelStatus?.selectedModel || "auto"}
        onModelSwitch={handleModelSwitch}
      />

      {!titleDone ? (
        <VelaTitleScreen
          isReady={isSettled}
          canExit={splashDone}
          onDone={() => setTitleDone(true)}
        />
      ) : null}
      {!splashDone ? <SplashScreen onDone={() => setSplashDone(true)} /> : null}
    </main>
  );
}



