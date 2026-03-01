export interface TelegramSendMessageParams {
  botToken: string;
  chatId: string;
  text: string;
}

export interface TelegramSendMessageResult {
  messageId: string;
  rawResponse: unknown;
}

interface TelegramApiSuccess {
  ok: true;
  result?: {
    message_id?: number | string;
  };
}

interface TelegramApiFailure {
  ok?: false;
  description?: string;
  error_code?: number;
}

function parseJsonOrNull(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function sendTelegramMessage(
  params: TelegramSendMessageParams
): Promise<TelegramSendMessageResult> {
  const response = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      disable_web_page_preview: true
    })
  });

  const rawText = await response.text();
  const payload = parseJsonOrNull(rawText) as TelegramApiSuccess | TelegramApiFailure | null;

  if (!response.ok || !payload || payload.ok !== true) {
    const description =
      typeof payload === "object" && payload && "description" in payload && typeof payload.description === "string"
        ? payload.description
        : rawText || response.statusText;
    const statusCode =
      typeof payload === "object" && payload && "error_code" in payload && typeof payload.error_code === "number"
        ? payload.error_code
        : response.status;
    throw new Error(`Telegram sendMessage failed (${statusCode}): ${description}`);
  }

  const messageId = payload.result?.message_id;

  if (messageId === undefined || messageId === null) {
    throw new Error("Telegram sendMessage succeeded but response did not include result.message_id.");
  }

  return {
    messageId: String(messageId),
    rawResponse: payload
  };
}
