import { NextResponse, type NextRequest } from "next/server";
import { runDigestJob } from "@/server/digest";
import { requireTelegramWebhookConfig } from "@/server/env";
import { runPollJob } from "@/server/poll";
import { sendTelegramMessage } from "@/server/telegram";

export const runtime = "nodejs";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
    };
    entities?: Array<{
      type?: string;
      offset?: number;
      length?: number;
    }>;
  };
};

function noStoreJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function extractCommandText(message: NonNullable<TelegramUpdate["message"]>): string | null {
  const text = message.text;
  if (!text) return null;

  const entities = message.entities ?? [];
  const commandEntity = entities.find((entity) => entity.type === "bot_command" && entity.offset === 0);

  if (commandEntity && typeof commandEntity.length === "number" && commandEntity.length > 0) {
    return text.slice(0, commandEntity.length).trim();
  }

  const firstToken = text.trim().split(/\s+/, 1)[0];
  return firstToken.startsWith("/") ? firstToken : null;
}

function isUpdateCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();
  return normalized === "/update" || normalized.startsWith("/update@");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let config;
  try {
    config = requireTelegramWebhookConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return noStoreJson({ ok: false, error: message }, 503);
  }

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token")?.trim();
  if (!receivedSecret || receivedSecret !== config.webhookSecret) {
    return noStoreJson({ ok: false, error: "Unauthorized." }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return noStoreJson({ ok: false, error: "Invalid JSON body." }, 400);
  }

  if (!update.message) {
    return noStoreJson({ ok: true, ignored: "non_message_update" }, 200);
  }

  const incomingChatId = update.message.chat?.id;
  if (incomingChatId === null || incomingChatId === undefined || String(incomingChatId) !== config.chatId.trim()) {
    return noStoreJson({ ok: true, ignored: "chat_not_allowed" }, 200);
  }

  const command = extractCommandText(update.message);
  if (!command || !isUpdateCommand(command)) {
    return noStoreJson({ ok: true, ignored: "unsupported_command" }, 200);
  }

  try {
    const pollResult = await runPollJob();
    const digest = await runDigestJob({
      mode: "preview",
      snapshotDate: new Date(pollResult.snapshotDate)
    });

    const sent = await sendTelegramMessage({
      botToken: config.botToken,
      chatId: config.chatId,
      text: digest.text
    });

    return noStoreJson(
      {
        ok: true,
        handled: "update",
        snapshotDate: digest.snapshotDate,
        digestVariant: digest.variant,
        telegramMessageId: sent.messageId
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      await sendTelegramMessage({
        botToken: config.botToken,
        chatId: config.chatId,
        text: `Update failed: ${message}`
      });
    } catch {
      // Best-effort fallback notification.
    }

    console.error({
      event: "telegram_update_command_failed",
      error: message,
      updateId: update.update_id,
      chatId: update.message.chat?.id
    });

    return noStoreJson({ ok: false, error: message }, 500);
  }
}
