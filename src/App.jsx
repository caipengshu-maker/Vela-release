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
          <p>不需要组织得很完整。你可以直接把第一句交给我。</p>
        </div>
      ) : null}

      {messages.map((message) => (
        <article
          key={message.id}
          className={`message-row is-${message.role}`}
        >
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

export default function App() {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
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
        </div>
      )}
    </main>
  );
}
