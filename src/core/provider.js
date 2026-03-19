function clipText(text, limit = 32) {
  if (!text) {
    return "";
  }

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function buildMockReply(context) {
  const latestUserMessage = context.messages.at(-1)?.content?.trim() || "";
  const recentSummary = context.memory.recentSummaries[0];
  const isFirstTurnThisLaunch = context.session.launchTurnCount === 0;
  const asksForJudgment = /(该不该|要不要|怎么看|觉得|判断|建议)/.test(
    latestUserMessage
  );
  const emotionalSignal = /(累|烦|难过|焦虑|害怕|失眠|崩|委屈|压力)/.test(
    latestUserMessage
  );
  const greeting = /(你好|在吗|早上好|晚上好|晚安|嗨)/.test(latestUserMessage);
  const wantsContinuation = /(上次|之前|继续|后来|记得)/.test(latestUserMessage);

  const continuityLine =
    recentSummary && (isFirstTurnThisLaunch || wantsContinuation)
      ? `我还记得上次我们停在「${clipText(recentSummary.topicLabel || recentSummary.summary, 18)}」，所以你这句一出来，语境就接上了。`
      : "";

  let body = "我在听。你这句话里已经有重点了，只是还没完全摊开。";
  let close = "如果你愿意，把下一层也说出来，我会继续接着。";

  if (greeting) {
    body = "我在。你不用先把状态整理漂亮，直接从今天最想说的那件事开始。";
    close = "先给我第一句就够了。";
  } else if (emotionalSignal) {
    body = "先别急着把自己拽得太紧。把最卡的那一段交给我，我们一点点拆。";
    close = "不用一次说完整，我能跟上。";
  } else if (asksForJudgment) {
    body = "如果只说我的判断，我会先看你现在最想保住的是什么，再谈动作。";
    close = "你把最难取舍的那一点补给我，我会说得更准。";
  } else if (/(想|计划|准备|打算)/.test(latestUserMessage)) {
    body = "听起来你不是没有方向，只是还缺一个能站稳的落点。";
    close = "把你最犹豫的那个分叉说出来，我们继续往下接。";
  }

  return [continuityLine, body, close].filter(Boolean).join(" ");
}

async function requestOpenAiCompatible(context, config) {
  const apiKey = process.env[config.llm.apiKeyEnv];

  if (!apiKey) {
    return buildMockReply(context);
  }

  const endpoint = new URL("/chat/completions", config.llm.baseUrl).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.llm.model,
      temperature: config.llm.temperature,
      max_tokens: config.llm.maxTokens,
      messages: [
        {
          role: "system",
          content: context.systemPrompt
        },
        ...context.messages
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return payload.choices?.[0]?.message?.content?.trim() || buildMockReply(context);
}

export async function generateReply(context, config) {
  if (config.llm.mode === "openai-compatible") {
    try {
      return await requestOpenAiCompatible(context, config);
    } catch (error) {
      console.warn("Falling back to mock provider:", error.message);
    }
  }

  return buildMockReply(context);
}
