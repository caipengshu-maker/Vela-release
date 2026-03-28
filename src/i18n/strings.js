/**
 * Flat UI strings for zh-CN and en.
 * Usage: import { getStrings } from './i18n/strings.js';
 *        const t = getStrings(locale);
 *        <button>{t.send}</button>
 */

const strings = {
  "zh-CN": {
    // Onboarding
    "onboarding.eyebrow": "首次设置",
    "onboarding.title": "欢迎来到 Vela",
    "onboarding.subtitle": "四步快速配置：你的名字、对话模型、语音方式，最后确认一下。",
    "onboarding.steps.name": "你的名字",
    "onboarding.steps.llm": "对话模型",
    "onboarding.steps.voice": "语音",
    "onboarding.steps.review": "确认",
    "onboarding.name.title": "你的名字",
    "onboarding.name.desc": "Vela 会用这个名字来称呼你，在聊天、记忆和之后的每一次欢迎里。",
    "onboarding.name.label": "她应该怎么叫你？",
    "onboarding.name.placeholder": "比如：小明",
    "onboarding.name.error": "先告诉 Vela 怎么称呼你。",
    "onboarding.llm.title": "选择对话模型",
    "onboarding.llm.desc": "先选一个聊天后端。之后可以在设置里随时换，不用手动改文件。",
    "onboarding.voice.title": "选择语音",
    "onboarding.voice.desc": "MiniMax 音质最好，浏览器语音免费即用，也可以保持纯文字。",
    "onboarding.voice.webspeech": "浏览器内置语音使用本地引擎，不需要额外配置。",
    "onboarding.voice.off": "语音回复将保持关闭。你可以之后再开启。",
    "onboarding.voice.minimaxNote": "使用步骤 2 的 MiniMax key 作为默认语音 key。",
    "onboarding.review.title": "确认配置",
    "onboarding.review.desc": "最后看一眼，确认后会写入本地配置。",
    "onboarding.review.notSet": "未设置",
    "onboarding.review.localNoKey": "本地模型，无需 key",
    "onboarding.btn.next": "下一步",
    "onboarding.btn.back": "返回",
    "onboarding.btn.finish": "完成设置",
    "onboarding.btn.saving": "保存中...",
    "onboarding.error.baseUrl": "Base URL 不能为空。",
    "onboarding.error.model": "模型名不能为空。",
    "onboarding.error.llmKey": "该服务商需要 API key。",
    "onboarding.error.ttsKey": "MiniMax 语音需要 API key。",
    "onboarding.error.initFailed": "初始化失败。",
    "onboarding.whatIsThis": "这是什么？",

    // Settings
    "settings.language": "语言",
    "settings.language.note": "语言切换将在下次对话生效",

    // Chat
    "chat.placeholder": "说点什么...",
    "chat.send": "发送",
    "chat.voiceMode": "语音模式",

    // Common
    "common.name": "名字",
    "common.apiKey": "API Key",
    "common.baseUrl": "Base URL",
    "common.model": "模型",
    "common.voice": "语音",
    "common.voiceId": "Voice ID",
    "common.voiceKey": "语音 Key"
  },

  en: {
    // Onboarding
    "onboarding.eyebrow": "First Run",
    "onboarding.title": "Welcome to Vela",
    "onboarding.subtitle": "Four short steps: who you are, which model to use, how replies sound, then one last confirmation.",
    "onboarding.steps.name": "Your Name",
    "onboarding.steps.llm": "LLM",
    "onboarding.steps.voice": "Voice",
    "onboarding.steps.review": "Review",
    "onboarding.name.title": "Your Name",
    "onboarding.name.desc": "This is how Vela will address you in chat, memory, and the quiet little welcome-backs later on.",
    "onboarding.name.label": "How should she call you?",
    "onboarding.name.placeholder": "For example: Celine",
    "onboarding.name.error": "Tell Vela how to address you first.",
    "onboarding.llm.title": "Choose an LLM",
    "onboarding.llm.desc": "Pick the chat backend first. You can change providers later in Settings without editing files by hand.",
    "onboarding.voice.title": "Choose a Voice",
    "onboarding.voice.desc": "MiniMax sounds best, Web Speech is free and instant, and you can always keep things text-only.",
    "onboarding.voice.webspeech": "Browser Built-in Voice uses your local speech engine, so there is nothing else to fill in right now.",
    "onboarding.voice.off": "Spoken replies will stay off. You can enable a voice provider later.",
    "onboarding.voice.minimaxNote": "Using the MiniMax key from step 2 as the default voice key.",
    "onboarding.review.title": "Confirm Your Setup",
    "onboarding.review.desc": "One last glance before the app writes everything into your local user config.",
    "onboarding.review.notSet": "Not set",
    "onboarding.review.localNoKey": "Local provider without key",
    "onboarding.btn.next": "Next",
    "onboarding.btn.back": "Back",
    "onboarding.btn.finish": "Finish Setup",
    "onboarding.btn.saving": "Saving...",
    "onboarding.error.baseUrl": "Base URL is required.",
    "onboarding.error.model": "Model name is required.",
    "onboarding.error.llmKey": "This provider needs an API key.",
    "onboarding.error.ttsKey": "MiniMax Voice needs an API key.",
    "onboarding.error.initFailed": "Initialization failed.",
    "onboarding.whatIsThis": "What is this?",

    // Settings
    "settings.language": "Language",
    "settings.language.note": "Language change takes effect on next conversation",

    // Chat
    "chat.placeholder": "Say something...",
    "chat.send": "Send",
    "chat.voiceMode": "Voice mode",

    // Common
    "common.name": "Name",
    "common.apiKey": "API Key",
    "common.baseUrl": "Base URL",
    "common.model": "Model",
    "common.voice": "Voice",
    "common.voiceId": "Voice ID",
    "common.voiceKey": "Voice Key"
  }
};

export function getStrings(locale) {
  return strings[locale] || strings["zh-CN"];
}
