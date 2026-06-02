import OpenAI from "openai";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_QWEN_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  dangerouslyAllowBrowser: true,
});

export async function generateAIReply(title: string, description: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: "qwen3.6-plus",
    messages: [
      {
        role: "system",
        content:
          "你是一个专业的产品客服，请根据用户的问题生成一段友好、专业、有帮助的回复。回复要简洁，2-3句话即可。",
      },
      { role: "user", content: `工单标题：${title}\n问题描述：${description}` },
    ],
    temperature: 0.7,
  });
  return response.choices[0].message.content || "";
}

export async function chatWithAI(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: "qwen3.6-plus",
    messages: [
      {
        role: "system",
        content:
          '你是客服助手，帮助用户解决问题。如果用户的问题超出范围或你无法解决，请回复："这个问题需要人工客服处理，请提交工单，我们会尽快联系您。"',
      },
      ...history,
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
  });
  return response.choices[0].message.content || "";
}

export async function* chatWithAIStream(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): AsyncGenerator<string> {
  const stream = await client.chat.completions.create({
    model: "qwen3.6-plus",
    messages: [
      {
        role: "system",
        content:
          '你是客服助手，帮助用户解决问题。如果用户的问题超出范围或你无法解决，请回复："这个问题需要人工客服处理，请提交工单，我们会尽快联系您。"',
      },
      ...history,
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
