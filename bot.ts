// bot.ts
import { Bot } from "grammy";
import * as dotenv from "dotenv";
import { handleStart } from "./commands/start";
import { handleRegistration, isUserInRegistrationFlow } from "./utils/registration";
import { handleMenuCallback } from "./utils/menu";
import { BotError, GrammyError, HttpError } from "grammy";

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is missing");

export const bot = new Bot(token);

// /start is the only command: it registers new users and opens the button menu.
// Everything else is driven by inline keyboard callbacks.
bot.command("start", handleStart);
bot.on("callback_query:data", handleMenuCallback);

// Handle text messages for username registration only in private chats
bot.on("message:text", async (ctx) => {
  // Only process text messages in private chats
  if (ctx.chat?.type === "private") {
    const userId = ctx.from?.id;
    
    // Check if user is in registration flow
    if (userId && isUserInRegistrationFlow(userId)) {
      await handleRegistration(ctx);
    }
    // If not in registration flow, we can ignore the message
    // (previously this called handleUsername for all text messages)
  }
});

// Global error handler
bot.catch((err: BotError) => {
  const ctx = err.ctx;
  const errorContext = {
    updateId: ctx.update.update_id,
    userId: ctx.from?.id,
    chatId: ctx.chat?.id,
    timestamp: new Date().toISOString()
  };
  
  if (err.error instanceof GrammyError) {
    // Handle specific Telegram API errors
    if (err.error.description.includes("Forbidden: bot was blocked by the user")) {
      console.log(JSON.stringify({
        level: "warn",
        type: "bot_blocked",
        message: `Bot was blocked by user ${ctx.from?.id}`,
        ...errorContext,
        error: err.error.description
      }));
    } else if (err.error.description.includes("Too Many Requests")) {
      console.log(JSON.stringify({
        level: "warn",
        type: "rate_limit",
        message: "Rate limit exceeded",
        ...errorContext,
        error: err.error.description
      }));
    } else if (err.error.description.includes("Bad Request")) {
      console.log(JSON.stringify({
        level: "error",
        type: "bad_request",
        message: "Bad request error",
        ...errorContext,
        error: err.error.description
      }));
    } else {
      console.log(JSON.stringify({
        level: "error",
        type: "telegram_api_error",
        message: "Other Telegram API error",
        ...errorContext,
        error: err.error.description
      }));
    }
  } else if (err.error instanceof HttpError) {
    // Handle network errors
    console.log(JSON.stringify({
      level: "error",
      type: "network_error",
      message: "HTTP error occurred",
      ...errorContext,
      error: err.error.message
    }));
  } else {
    // Handle non-Telegram API errors
    console.log(JSON.stringify({
      level: "error",
      type: "unknown_error",
      message: "Unknown error occurred",
      ...errorContext,
      error: String(err.error)
    }));
  }
});
