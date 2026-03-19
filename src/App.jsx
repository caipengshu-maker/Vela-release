import { useEffect, useMemo, useRef, useState } from "react";

const initialState = {
  app: null,
  persona: null,
  avatar: null,
  messages: [],
  welcomeNote: "",
  memoryPeek: null,
  voiceMode: {
    enabled: false,
    available: false
  },
  onboarding: {
    required: false,
    completed: true
  },
  session: {
    launchTurnCount: 0,
    lifetimeTurnCount: 0
  }
};

function AvatarPanel({ avatar, app, persona, memoryPeek }) {
  return (
    <section className="avatar-shell">
      <div className="avatar-panel">
        <div className={`avatar-stage is-${avatar?.presence || "listening"}`}>
          <div className="avatar-halo" />
          <div className="avatar-orbit avatar-orbit-a" />
          <div className="avatar-orbit avatar-orbit-b" />
          <div className="avatar-silhouette">
            <div className="avatar-face avatar-face-left" />
            <div className="avatar-face avatar-face-right" />
            <div className="avatar-mouth" />
          </div>
        </div>

        <div className="panel-copy">
          <span className="eyebrow">{app?.tagline}</span>
          <h1>{persona?.name || "Vela"}</h1>
          <p>{persona?.shortBio}</p>
        </div>

        <div className="status-row">
          <span className="status-pill">{avatar?.label || "静静在场"}</span>
          <span className="status-pill subtle">{avatar?.emotionLabel || "平静"}</span>
        </div>

        <p className="status-caption">{avatar?.caption || "在这里，等你把话慢慢说清楚。"}</p>

        <div className="memory-card">
          <span className="memory-label">最近留下的线索</span>
          <p>{memoryPeek?.summary || "还没有新的会话摘要。先说第一句吧。"}</p>
          {memoryPeek?.createdAtLabel ? (
            <span className="memory-time">{memoryPeek.createdAtLabel}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MessageList({ messages, welcomeNote, isBusy }) {
  const listRef = useRef(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, isBusy]);

  return (
    <div className="conversation" ref={listRef}>
      {welcomeNote ? <div className="welcome-card">{welcomeNote}</div> : null}

      {messages.length === 0 ? (
        <div className="empty-card">
          <span>今晚的空气很轻。</span>
          <p>不需要组织得很完整。你可以直接把第一句交给她。</p>
        </div>
      ) : null}

      {messages.map((message) => (
        <article key={message.id} className={`message-row is-${message.role}`}>
          <div className="message-bubble">
            <span className="message-role">
              {message.role === "assistant" ? "Vela" : "你"}
            </span>
            <p>{message.content}</p>
          </div>
        </article>
      ))}

      {isBusy ? (
        <article className="message-row is-assistant">
          <div className="message-bubble is-pending">
            <span className="message-role">Vela</span>
            <p>让我把这句话接稳一点。</p>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function OnboardingPanel({ onboarding, onConfirm, isSubmitting }) {
  const [velaName, setVelaName] = useState(onboarding.fields.velaName || "Vela");
  const [userName, setUserName] = useState(onboarding.fields.userName || "");
  const [temperament, setTemperament] = useState(onboarding.fields.temperament || "gentle-cool");
  const [distance, setDistance] = useState(onboarding.fields.distance || "warm");

  async function handleSubmit(event) {
    event.preventDefault();
    await onConfirm({
      velaName: velaName.trim() || "Vela",
      userName: userName.trim(),
      temperament,
      distance
    });
  }

  return (
    <section className="chat-shell onboarding-shell">
      <div className="chat-header">
        <div>
          <span className="eyebrow">First Wake</span>
          <h2>先别把这一步做成填表。</h2>
          <p>你不是在配置一个工具，而是在决定她第一次怎么醒来。</p>
        </div>
      </div>

      <form className="onboarding-form" onSubmit={handleSubmit}>
        <div className="onboarding-copy">
          <p>{onboarding.prompt}</p>
        </div>

        <label className="field-block">
          <span>她先叫什么？</span>
          <input
            value={velaName}
            onChange={(event) => setVelaName(event.target.value)}
            placeholder="Vela"
          />
        </label>

        <label className="field-block">
          <span>她怎么叫你会更顺？</span>
          <input
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            placeholder="可以留空，后面再说"
          />
        </label>

        <div className="field-block">
          <span>先给她一个气质底色</span>
          <div className="choice-grid">
            {onboarding.options.temperament.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`choice-card ${temperament === option.id ? "is-active" : ""}`}
                onClick={() => setTemperament(option.id)}
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field-block">
          <span>你想让她一开始离你多近？</span>
          <div className="choice-grid compact">
            {onboarding.options.distance.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`choice-card ${distance === option.id ? "is-active" : ""}`}
                onClick={() => setDistance(option.id)}
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="composer-actions">
          <span className="onboarding-hint">后面都还能改，现在只先把她温柔地叫醒。</span>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "唤醒中" : "让她这样醒来"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [error, setError] = useState("");
  const [transientAvatar, setTransientAvatar] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const nextState = await window.vela.bootstrap();
        if (isMounted) {
          setState(nextState);
        }
      } catch (bootstrapError) {
        if (isMounted) {
          setError(bootstrapError.message || "启动 Vela 失败。");
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
    if (!state.avatar || state.avatar.presence !== "speaking") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setTransientAvatar({
        ...state.avatar,
        presence: "listening",
        label: "在听",
        caption: "我在，继续吧。"
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [state.avatar]);

  const activeAvatar = transientAvatar && state.avatar?.presence === "speaking"
    ? transientAvatar
    : state.avatar;

  const headerMeta = useMemo(() => {
    if (!state.session) {
      return "连续人格样机";
    }

    return `本轮 ${state.session.launchTurnCount} 轮 · 累计 ${state.session.lifetimeTurnCount} 轮`;
  }, [state.session]);

  async function handleOnboarding(payload) {
    setIsOnboarding(true);
    setError("");

    try {
      const nextState = await window.vela.completeOnboarding(payload);
      setState(nextState);
    } catch (submitError) {
      setError(submitError.message || "初始化失败。");
    } finally {
      setIsOnboarding(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmed = draft.trim();
    if (!trimmed || isSending) {
      return;
    }

    const optimisticMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    setDraft("");
    setError("");
    setIsSending(true);
    setTransientAvatar(null);
    setState((current) => ({
      ...current,
      welcomeNote: "",
      avatar: {
        ...(current.avatar || {}),
        presence: "thinking",
        label: "在想",
        caption: "让我先把语境和旧事接上。"
      },
      messages: [...current.messages, optimisticMessage]
    }));

    try {
      const nextState = await window.vela.sendMessage(trimmed);
      setState(nextState);
    } catch (sendError) {
      setError(sendError.message || "消息发送失败。");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      {isLoading ? (
        <div className="loading-screen">Vela 正在把记忆和语气接回来……</div>
      ) : (
        <div className="surface">
          <AvatarPanel
            avatar={activeAvatar}
            app={state.app}
            persona={state.persona}
            memoryPeek={state.memoryPeek}
          />

          {state.onboarding?.required ? (
            <OnboardingPanel
              onboarding={state.onboarding}
              onConfirm={handleOnboarding}
              isSubmitting={isOnboarding}
            />
          ) : (
            <section className="chat-shell">
              <header className="chat-header">
                <div>
                  <span className="eyebrow">Companion Prototype</span>
                  <h2>{state.app?.name || "Vela"}</h2>
                  <p>{headerMeta}</p>
                </div>

                <div className="mode-row">
                  <span className="mode-pill active">文本模式</span>
                  <span className="mode-pill disabled">语音稍后</span>
                </div>
              </header>

              <MessageList
                messages={state.messages}
                welcomeNote={state.welcomeNote}
                isBusy={isSending}
              />

              <form className="composer" onSubmit={handleSubmit}>
                <label className="composer-field">
                  <span className="sr-only">输入消息</span>
                  <textarea
                    rows="3"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="把今晚最想说的那句话交给她。"
                  />
                </label>

                <div className="composer-actions">
                  {error ? <p className="error-text">{error}</p> : <span />}
                  <button type="submit" disabled={isSending || !draft.trim()}>
                    {isSending ? "回应中" : "发送"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
