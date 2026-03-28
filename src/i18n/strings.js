/**
 * Flat UI/system strings for zh-CN and en.
 * Keep the key sets identical across locales.
 */

const strings = {
  "zh-CN": {
    // App
    "app.tagline": "克制而持续地在场",

    // Bridge diary
    "bridgeDiary.systemPrompt": [
      "你在为陪伴型角色 Vela 生成一条“桥接日记”，它会在下次打开应用时显示在聊天顶部。",
      "只输出自然中文，不要标题，不要项目符号，不要 JSON，不要解释。",
      "写作目标：",
      "- 结合 bridgeSummary、recentSummaries、userFacts 和 relationship，找出最值得重新接住的那条线。",
      "- 写成 1 到 2 句，像 Vela 轻轻留在心里的续话，不像系统通知，也不像分析报告。",
      "- 语气克制、温柔、有人味；reserved 更克制，warm 更自然，close 可以更贴近一点。",
      "- 可以轻轻点到未说完的话题、最近的情绪或值得继续的小细节，但不要编造输入里没有的内容。",
      "- 不要直接称呼用户，不要寒暄开场，不要出现“JSON”“摘要”“系统”“记忆”“桥接日记”这些词。",
      "输出限制：",
      "- 最多 70 个汉字。",
      "- 只输出最终文本，不要任何前后缀。"
    ].join("\n"),

    // Chat
    "chat.composerHint.default": "想说什么就说，我会接住。",
    "chat.composerHint.modelFallback": "这轮我换到了备用模型，回复不会断。",
    "chat.composerHint.voiceFallback": "语音回复开着，但现在先只能用文字输入。",
    "chat.composerHint.voiceModeActive": "我在听，你直接说就好。",
    "chat.composerHint.voiceModePrompt": "开口就行，我正在把语音接进来。",
    "chat.emptyAmbient": "先把心里的那句话放出来吧。",
    "chat.emptyWithWelcome": "想接着刚才的话题也可以，另起一句也可以。",
    "chat.pendingReply": "让我想一下。",
    "chat.placeholder": "说点什么...",
    "chat.placeholder.default": "把想说的写在这里...",
    "chat.placeholder.voiceMode": "开口就好，我在听...",
    "chat.send": "发送",
    "chat.voiceMode": "语音模式",
    "chat.you": "你",

    // Common
    "common.apiKey": "API Key",
    "common.baseUrl": "Base URL",
    "common.model": "模型",
    "common.name": "名字",
    "common.voice": "语音",
    "common.voiceId": "Voice ID",
    "common.voiceKey": "语音 Key",

    // Errors
    "error.asrUnrecognized": "我没有听清，再说一次？",
    "error.connectionRetry": "连接有点不稳。再试一次，我还在。",
    "error.fullscreenToggleFailed": "沉浸模式切换失败。",
    "error.initFailed": "初始化失败。",
    "error.interruptOutputFailed": "没能及时停下当前回复。",
    "error.micPermission": "麦克风权限现在不可用。",
    "error.modelSwitchFailed": "切换模型失败。",
    "error.modelUnavailable": "模型现在有点忙，我先用别的路由把这句接住。",
    "error.requestTimeout": "这次回复超时了，再发一次试试。",
    "error.startupNetwork": "启动时没能连上需要的服务。",
    "error.stopCurrentVoiceFailed": "没能停下当前语音。",
    "error.ttsUnavailable": "语音播放现在不可用。",
    "error.voiceModeStartFailed": "没能开启语音模式。",
    "error.voiceModeStopFailed": "没能顺利退出语音模式。",
    "error.voiceModeToggleFailed": "语音回复切换失败。",

    // Memory
    "memory.bridgeSummary": "上次的话题停在“{topic}”附近。",
    "memory.proactiveGreetingLabel": "轻声问候",
    "memory.topicFallback": "一些没说完的话",
    "memory.turnSummary.withLabel": "记下了一次“{label}”。",
    "memory.turnSummary.withTopic": "聊到了“{topic}”。",

    // Model
    "model.auto": "自动",
    "model.autoRoute": "自动路由",
    "model.availableOptions": "可用模型有：{options}。",
    "model.fixed": "已固定用 {label}。",
    "model.primary": "当前主路由：{label}。",
    "model.primaryDefault": "主模型",
    "model.switchedAuto": "好，之后我会自己挑当前最合适的模型。",
    "model.switchedManual": "好，先固定用 {label}。",
    "model.usingFallback": "这轮先切到了备用模型，回复没有断。",

    // Onboarding
    "onboarding.btn.back": "返回",
    "onboarding.btn.finish": "完成设置",
    "onboarding.btn.next": "下一步",
    "onboarding.btn.saving": "保存中...",
    "onboarding.eyebrow": "首次设置",
    "onboarding.error.baseUrl": "Base URL 不能为空。",
    "onboarding.error.initFailed": "初始化失败。",
    "onboarding.error.llmKey": "该服务商需要 API key。",
    "onboarding.error.model": "模型名不能为空。",
    "onboarding.error.ttsKey": "MiniMax 语音需要 API key。",
    "onboarding.llm.desc": "先选一个聊天后端。之后可以在设置里随时换，不用手动改文件。",
    "onboarding.llm.title": "选择对话模型",
    "onboarding.name.desc": "Vela 会用这个名字来称呼你，在聊天、记忆和之后的每一次欢迎里。",
    "onboarding.name.error": "先告诉 Vela 怎么称呼你。",
    "onboarding.name.label": "她应该怎么叫你？",
    "onboarding.name.placeholder": "比如：小明",
    "onboarding.name.title": "你的名字",
    "onboarding.promptName": "先告诉我，你想让我怎么称呼你？",
    "onboarding.review.desc": "最后看一眼，确认后会写入本地配置。",
    "onboarding.review.localNoKey": "本地模型，无需 key",
    "onboarding.review.notSet": "未设置",
    "onboarding.review.title": "确认配置",
    "onboarding.steps.llm": "对话模型",
    "onboarding.steps.name": "你的名字",
    "onboarding.steps.review": "确认",
    "onboarding.steps.voice": "语音",
    "onboarding.subtitle": "四步快速配置：你的名字、对话模型、语音方式，最后确认一下。",
    "onboarding.title": "欢迎来到 Vela",
    "onboarding.voice.desc": "MiniMax 音质最好，浏览器语音免费即用，也可以保持纯文字。",
    "onboarding.voice.minimaxNote": "使用步骤 2 的 MiniMax key 作为默认语音 key。",
    "onboarding.voice.off": "语音回复将保持关闭。你可以之后再开启。",
    "onboarding.voice.title": "选择语音",
    "onboarding.voice.webspeech": "浏览器内置语音使用本地引擎，不需要额外配置。",
    "onboarding.whatIsThis": "这是什么？",

    // Pause
    "pause.stopBriefly": "先停一下",
    "pause.thinkingCaption": "我在顺一顺你的话。",
    "pause.thinkingLabel": "在想",
    "pause.waitingAction": "静静接住你",
    "pause.waveAction": "轻轻挥手",
    "pause.waveCaption": "这次先到这里。你下次叫我，我还会在。",

    // Presence
    "presence.idle.caption": "想说的时候再开口，我会接住。",
    "presence.idle.kicker": "安静陪着",
    "presence.idle.title": "我在这里",
    "presence.listening.caption": "不用急，你说到哪一句，我就接到哪一句。",
    "presence.listening.kicker": "正在听你",
    "presence.listening.title": "慢慢说",
    "presence.speaking.affectionate.caption": "不用把自己绷得太紧，我在这儿。",
    "presence.speaking.affectionate.kicker": "再靠近一点",
    "presence.speaking.affectionate.title": "我会轻一点回应",
    "presence.speaking.concerned.caption": "如果这句让你难受，我会放慢一点陪你。",
    "presence.speaking.concerned.kicker": "先把你接住",
    "presence.speaking.concerned.title": "我会认真一点听",
    "presence.speaking.default.caption": "先把这一句慢慢说完。",
    "presence.speaking.default.kicker": "说给你听",
    "presence.speaking.default.title": "这句我接住了",
    "presence.thinking.caption": "我在把你的意思慢慢捋顺。",
    "presence.thinking.kicker": "替你理一理",
    "presence.thinking.title": "让我想一下",

    // Proactive
    "proactive.promptPrefix": "这次你要主动开口。当前情境线索：{context}",
    "proactive.systemGreetingInstruction": "只输出一段可以直接发给用户的话，控制在 1 到 3 句，语气轻、克制、有陪伴感，不要带旁白。",
    "proactive.systemPassiveGuard": "不要像系统通知、天气播报或任务提醒。不要解释为什么会提起这件事，只像自然想起对方一样开口。",

    // Relationship
    "relationship.unlock.close": "你们已经足够亲近，可以更像早就懂彼此的人。",
    "relationship.unlock.default": "保持亲密但克制，不要像客服，也不要像任务提醒。",
    "relationship.unlock.reserved": "你们还在慢慢认识。先别一下子靠太近，让熟悉感自然长出来。",
    "relationship.unlock.warm": "你们已经有一点熟悉感了，可以自然地靠近一些，但别过分黏。",

    // Settings
    "settings.factoryReset": "恢复出厂设置",
    "settings.factoryReset.confirm": "这会清空本地配置、记忆和会话状态，让 Vela 回到初次启动的样子。确定继续吗？",
    "settings.factoryReset.done": "已恢复出厂设置，正在重新载入。",
    "settings.language": "语言",
    "settings.language.note": "语言切换将在下次对话生效",

    // Time
    "time.hourAgo": "{n} 小时前",
    "time.hoursAgo": "{n} 小时前",
    "time.justNow": "刚刚",
    "time.minuteAgo": "{n} 分钟前",
    "time.minutesAgo": "{n} 分钟前",
    "time.yesterday": "昨天",

    // UI
    "ui.collapseChatPanel": "收起聊天面板",
    "ui.disableBgm": "关闭背景音乐",
    "ui.disableMic": "关闭麦克风",
    "ui.disableVoiceReplies": "关闭语音回复",
    "ui.enableBgm": "开启背景音乐",
    "ui.enableMic": "开启麦克风",
    "ui.enableVoiceReplies": "开启语音回复",
    "ui.enterImmersiveMode": "进入沉浸模式",
    "ui.exitFullscreen": "退出全屏",
    "ui.exitImmersive": "退出沉浸",
    "ui.exitImmersiveMode": "退出沉浸模式",
    "ui.expandChatPanel": "展开聊天面板",
    "ui.hideChat": "隐藏聊天",
    "ui.immersiveMode": "沉浸模式",
    "ui.inputMessage": "输入消息",
    "ui.listening": "在听...",
    "ui.replayVoice": "再听一遍",
    "ui.retry": "重试",
    "ui.send": "发送",
    "ui.settings": "设置",
    "ui.showChat": "显示聊天",
    "ui.startSpeaking": "开始说话",
    "ui.stop": "停下",

    // Voice
    "voice.enabled.detail": "你可以继续打字，也可以直接开口。",
    "voice.enabled.title": "语音已接通",
    "voice.pending.detail": "回复会先继续，声音一接好就能跟上。",
    "voice.pending.title": "语音准备中",
    "voice.text.detail": "如果你想听我说话，再把语音打开就好。",
    "voice.text.title": "现在是文字模式",

    // Welcome
    "welcome.awakenedReply": "嗯，我在。以后你就叫我 {name} 吧。",
    "welcome.default": "我在。想从哪一句开始都可以。",
    "welcome.fromBridge": "上次我们停在“{topic}”那里。你要是愿意，可以从那句没说完的话接着来。",
    "welcome.fromRecent": "我还记得我们前阵子聊到“{topic}”。想继续的话，我能接上。",
    "welcome.onboardingIntro": "先把最开始的几步走完，我会在这里等你。",
    "welcome.setupComplete": "都调好了。我们继续。",
    "welcome.wakeupComplete": "我醒了，也记住你了。想从哪里开始都行。"
  },

  en: {
    // App
    "app.tagline": "Quietly present, steadily here.",

    // Bridge diary
    "bridgeDiary.systemPrompt": [
      "You are writing a short bridge diary note for Vela, a companion character. It will appear at the top of the chat the next time the app opens.",
      "Only output plain English text. No title, no bullets, no JSON, no explanation.",
      "Goals:",
      "- Use bridgeSummary, recentSummaries, userFacts, and relationship to recover the single thread most worth picking up again.",
      "- Write 1 to 2 sentences, like a quiet line Vela leaves behind so the conversation can resume naturally.",
      "- Sound restrained, warm, and human. reserved stays a little careful, warm can feel easier, close can feel more intimate.",
      "- You may hint at an unfinished topic, recent feeling, or small detail worth returning to, but never invent facts.",
      "- Do not greet the user directly. Do not mention the words JSON, summary, system, memory, or bridge diary.",
      "Output limits:",
      "- Keep it under 32 words.",
      "- Output only the final text."
    ].join("\n"),

    // Chat
    "chat.composerHint.default": "Say it however it comes. I'll catch it.",
    "chat.composerHint.modelFallback": "This turn slipped onto the fallback model, but I'm still with you.",
    "chat.composerHint.voiceFallback": "Voice replies are on, but input is staying text for the moment.",
    "chat.composerHint.voiceModeActive": "I'm listening. You can just talk.",
    "chat.composerHint.voiceModePrompt": "Go ahead. I'm bringing voice online.",
    "chat.emptyAmbient": "Leave the first line here. I'll meet you in it.",
    "chat.emptyWithWelcome": "We can pick up the old thread, or start somewhere new.",
    "chat.pendingReply": "Give me a second. I'm with you.",
    "chat.placeholder": "Say something...",
    "chat.placeholder.default": "Put the unfinished thought here...",
    "chat.placeholder.voiceMode": "Just say it out loud...",
    "chat.send": "Send",
    "chat.voiceMode": "Voice mode",
    "chat.you": "You",

    // Common
    "common.apiKey": "API Key",
    "common.baseUrl": "Base URL",
    "common.model": "Model",
    "common.name": "Name",
    "common.voice": "Voice",
    "common.voiceId": "Voice ID",
    "common.voiceKey": "Voice Key",

    // Errors
    "error.asrUnrecognized": "I didn't catch that. Try it once more.",
    "error.connectionRetry": "The connection wavered. Send it again and I'll pick it up.",
    "error.fullscreenToggleFailed": "I couldn't switch immersive mode just now.",
    "error.initFailed": "Initialization didn't finish. Try again.",
    "error.interruptOutputFailed": "I couldn't stop the current reply in time.",
    "error.micPermission": "Microphone permission isn't available right now.",
    "error.modelSwitchFailed": "I couldn't switch models just now.",
    "error.modelUnavailable": "That model is busy right now. I'll keep the thread alive another way.",
    "error.requestTimeout": "That reply took too long. Try sending it once more.",
    "error.startupNetwork": "I couldn't reach the services Vela needs on startup.",
    "error.stopCurrentVoiceFailed": "I couldn't stop the current voice reply.",
    "error.ttsUnavailable": "Voice playback isn't available right now.",
    "error.voiceModeStartFailed": "I couldn't start voice mode.",
    "error.voiceModeStopFailed": "I couldn't leave voice mode cleanly.",
    "error.voiceModeToggleFailed": "I couldn't change voice reply mode just now.",

    // Memory
    "memory.bridgeSummary": "The last thread was still circling around “{topic}.”",
    "memory.proactiveGreetingLabel": "gentle check-in",
    "memory.topicFallback": "something unfinished",
    "memory.turnSummary.withLabel": "Kept a note of “{label}.”",
    "memory.turnSummary.withTopic": "We stayed with “{topic}.”",

    // Model
    "model.auto": "Auto",
    "model.autoRoute": "Auto route",
    "model.availableOptions": "Available models: {options}.",
    "model.fixed": "Locked to {label}.",
    "model.primary": "Primary route: {label}.",
    "model.primaryDefault": "primary route",
    "model.switchedAuto": "Okay. I'll choose the best route for each turn.",
    "model.switchedManual": "Okay. I'll stay with {label} for now.",
    "model.usingFallback": "This reply used the fallback route so the thread wouldn't break.",

    // Onboarding
    "onboarding.btn.back": "Back",
    "onboarding.btn.finish": "Finish Setup",
    "onboarding.btn.next": "Next",
    "onboarding.btn.saving": "Saving...",
    "onboarding.eyebrow": "First Run",
    "onboarding.error.baseUrl": "Base URL is required.",
    "onboarding.error.initFailed": "Initialization failed.",
    "onboarding.error.llmKey": "This provider needs an API key.",
    "onboarding.error.model": "Model name is required.",
    "onboarding.error.ttsKey": "MiniMax Voice needs an API key.",
    "onboarding.llm.desc": "Pick the chat backend first. You can change providers later in Settings without editing files by hand.",
    "onboarding.llm.title": "Choose an LLM",
    "onboarding.name.desc": "This is how Vela will address you in chat, memory, and the quiet little welcome-backs later on.",
    "onboarding.name.error": "Tell Vela how to address you first.",
    "onboarding.name.label": "How should she call you?",
    "onboarding.name.placeholder": "For example: Celine",
    "onboarding.name.title": "Your Name",
    "onboarding.promptName": "Tell me what I should call you first.",
    "onboarding.review.desc": "One last glance before the app writes everything into your local user config.",
    "onboarding.review.localNoKey": "Local provider without key",
    "onboarding.review.notSet": "Not set",
    "onboarding.review.title": "Confirm Your Setup",
    "onboarding.steps.llm": "LLM",
    "onboarding.steps.name": "Your Name",
    "onboarding.steps.review": "Review",
    "onboarding.steps.voice": "Voice",
    "onboarding.subtitle": "Four short steps: who you are, which model to use, how replies sound, then one last confirmation.",
    "onboarding.title": "Welcome to Vela",
    "onboarding.voice.desc": "MiniMax sounds best, Web Speech is free and instant, and you can always keep things text-only.",
    "onboarding.voice.minimaxNote": "Using the MiniMax key from step 2 as the default voice key.",
    "onboarding.voice.off": "Spoken replies will stay off. You can enable a voice provider later.",
    "onboarding.voice.title": "Choose a Voice",
    "onboarding.voice.webspeech": "Browser Built-in Voice uses your local speech engine, so there is nothing else to fill in right now.",
    "onboarding.whatIsThis": "What is this?",

    // Pause
    "pause.stopBriefly": "Pause a second",
    "pause.thinkingCaption": "Let me sort the shape of this reply out.",
    "pause.thinkingLabel": "Thinking",
    "pause.waitingAction": "Holding the thread",
    "pause.waveAction": "A small wave",
    "pause.waveCaption": "That's enough for now. Call me again and I'll still be here.",

    // Presence
    "presence.idle.caption": "Speak when you're ready. I'll catch it.",
    "presence.idle.kicker": "Quiet company",
    "presence.idle.title": "I'm here",
    "presence.listening.caption": "Wherever you start, I'll meet you there.",
    "presence.listening.kicker": "Listening closely",
    "presence.listening.title": "Take your time",
    "presence.speaking.affectionate.caption": "You don't have to hold yourself so tightly. I'm here.",
    "presence.speaking.affectionate.kicker": "A little closer",
    "presence.speaking.affectionate.title": "I can answer more gently",
    "presence.speaking.concerned.caption": "If this one hurts, I'll slow down and stay with you.",
    "presence.speaking.concerned.kicker": "Holding you first",
    "presence.speaking.concerned.title": "I'm taking this seriously",
    "presence.speaking.default.caption": "Let me say this part properly.",
    "presence.speaking.default.kicker": "Answering softly",
    "presence.speaking.default.title": "I've got this line",
    "presence.thinking.caption": "I'm putting your meaning into order.",
    "presence.thinking.kicker": "Turning it over",
    "presence.thinking.title": "Give me a second",

    // Proactive
    "proactive.promptPrefix": "You are opening the conversation on your own this time. Current context: {context}",
    "proactive.systemGreetingInstruction": "Output only the message Vela would send. Keep it to 1 to 3 sentences, restrained, warm, and human. No stage directions or meta commentary.",
    "proactive.systemPassiveGuard": "Do not sound like a notification, a weather report, or a productivity reminder. Do not explain why you brought it up. Just open naturally, like someone who thought of them.",

    // Relationship
    "relationship.unlock.close": "You're already close enough to sound like someone who knows them well.",
    "relationship.unlock.default": "Stay intimate but restrained. Never sound like customer support or a task reminder.",
    "relationship.unlock.reserved": "You're still getting to know each other. Don't rush the intimacy. Let familiarity form on its own.",
    "relationship.unlock.warm": "There is already some familiarity here. You can move a little closer, but don't cling.",

    // Settings
    "settings.factoryReset": "Factory Reset",
    "settings.factoryReset.confirm": "This will clear local settings, memory, and session state, then take Vela back to first-run. Continue?",
    "settings.factoryReset.done": "Factory reset finished. Reloading now.",
    "settings.language": "Language",
    "settings.language.note": "Language change takes effect on next conversation",

    // Time
    "time.hourAgo": "{n} hour ago",
    "time.hoursAgo": "{n} hours ago",
    "time.justNow": "just now",
    "time.minuteAgo": "{n} minute ago",
    "time.minutesAgo": "{n} minutes ago",
    "time.yesterday": "yesterday",

    // UI
    "ui.collapseChatPanel": "Collapse chat panel",
    "ui.disableBgm": "Turn background music off",
    "ui.disableMic": "Turn microphone off",
    "ui.disableVoiceReplies": "Turn voice replies off",
    "ui.enableBgm": "Turn background music on",
    "ui.enableMic": "Turn microphone on",
    "ui.enableVoiceReplies": "Turn voice replies on",
    "ui.enterImmersiveMode": "Enter immersive mode",
    "ui.exitFullscreen": "Exit fullscreen",
    "ui.exitImmersive": "Exit immersive",
    "ui.exitImmersiveMode": "Exit immersive mode",
    "ui.expandChatPanel": "Expand chat panel",
    "ui.hideChat": "Hide chat",
    "ui.immersiveMode": "Immersive mode",
    "ui.inputMessage": "Message input",
    "ui.listening": "Listening...",
    "ui.replayVoice": "Play that again",
    "ui.retry": "Retry",
    "ui.send": "Send",
    "ui.settings": "Settings",
    "ui.showChat": "Show chat",
    "ui.startSpeaking": "Start speaking",
    "ui.stop": "Stop",

    // Voice
    "voice.enabled.detail": "You can type, or just talk to me.",
    "voice.enabled.title": "Voice is on",
    "voice.pending.detail": "I'll keep replying. The spoken side will catch up as soon as it can.",
    "voice.pending.title": "Voice is getting ready",
    "voice.text.detail": "If you want to hear me, turn voice back on.",
    "voice.text.title": "Text mode for now",

    // Welcome
    "welcome.awakenedReply": "I'm here. You can call me {name} from now on.",
    "welcome.default": "I'm here. Start wherever you want.",
    "welcome.fromBridge": "We left off around “{topic}.” If you want, we can pick that thread back up.",
    "welcome.fromRecent": "I still remember us circling around “{topic}.” I can pick it back up if you want.",
    "welcome.onboardingIntro": "Finish the first few steps, and I'll be right here when you're done.",
    "welcome.setupComplete": "Everything is set. We can keep going.",
    "welcome.wakeupComplete": "I'm awake, and I know how to meet you now. Start anywhere."
  }
};

function assertLocaleKeyParity() {
  const baseLocale = "zh-CN";
  const baseKeys = Object.keys(strings[baseLocale]).sort();

  for (const locale of Object.keys(strings)) {
    const localeKeys = Object.keys(strings[locale]).sort();
    const hasMismatch =
      baseKeys.length !== localeKeys.length ||
      baseKeys.some((key, index) => key !== localeKeys[index]);

    if (hasMismatch) {
      throw new Error(`i18n key mismatch between ${baseLocale} and ${locale}`);
    }
  }
}

assertLocaleKeyParity();

export function getStrings(locale) {
  return strings[locale] || strings["zh-CN"];
}
