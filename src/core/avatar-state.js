const presenceLabels = {
  idle: "静静在场",
  listening: "在听",
  thinking: "在想",
  speaking: "回应中"
};

const emotionLabels = {
  calm: "平静",
  warm: "温柔",
  focused: "专注",
  concerned: "关切"
};

function detectEmotion(replyText) {
  if (/(难过|别急|先缓一下|慢一点|我陪你)/.test(replyText)) {
    return "concerned";
  }

  if (/(判断|先看|重点|拆开|理顺)/.test(replyText)) {
    return "focused";
  }

  if (/(记得|我在|继续吧|还记着)/.test(replyText)) {
    return "warm";
  }

  return "calm";
}

function buildCaption(presence, emotion) {
  if (presence === "thinking") {
    return "让我先把语境和旧事接稳。";
  }

  if (presence === "speaking" && emotion === "concerned") {
    return "语气会放轻一点，但不会敷衍。";
  }

  if (presence === "speaking" && emotion === "focused") {
    return "她在给你一个更稳的判断。";
  }

  if (presence === "speaking") {
    return "她已经把回应接上来了。";
  }

  return "在这里，等你把下一句慢慢说完。";
}

export function mapAvatarState({ presence, replyText = "" }) {
  const emotion = presence === "thinking" ? "focused" : detectEmotion(replyText);

  return {
    presence,
    emotion,
    label: presenceLabels[presence] || presenceLabels.listening,
    emotionLabel: emotionLabels[emotion] || emotionLabels.calm,
    caption: buildCaption(presence, emotion)
  };
}
