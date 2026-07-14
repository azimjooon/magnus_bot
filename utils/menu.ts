// Callback router for the button-driven UI. All bot features are reachable from here.
import { Context } from "grammy";
import { renderTop, TopOption } from "../commands/top";
import { renderStandings, renderRecentChampions } from "../commands/standings";
import { renderStatsFor } from "../commands/stats";
import { renderRatingsForTC, RatingTC } from "./ratings";
import { renderHeadToHead } from "./headToHead";
import { getAllUserMappings } from "./userMap";
import { handleRegistrationInput } from "./registration";
import { mainMenu, backToMenu, ratingsMenu, MENU_TEXT } from "./keyboards";
import { InlineKeyboard } from "grammy";

// Replace the menu message content in place; fall back to a new message if editing fails
async function show(ctx: Context, text: string, keyboard: InlineKeyboard = backToMenu()): Promise<void> {
  try {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { reply_markup: keyboard });
  }
}

async function showLoading(ctx: Context): Promise<void> {
  try {
    await ctx.editMessageText("⏳ Loading... / Боркунӣ...");
  } catch {
    // Non-fatal: the final show() will still update or resend
  }
}

function compareUserKeyboard(usernames: string[], firstIndex?: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  let buttonsInRow = 0;
  usernames.forEach((name, i) => {
    if (firstIndex !== undefined && i === firstIndex) return;
    const callback = firstIndex === undefined ? `cmp1:${i}` : `cmp2:${firstIndex}:${i}`;
    kb.text(`@${name}`, callback);
    buttonsInRow++;
    if (buttonsInRow === 2) {
      kb.row();
      buttonsInRow = 0;
    }
  });
  if (buttonsInRow > 0) kb.row();
  kb.text("⬅️ Menu", "menu");
  return kb;
}

async function sortedRegisteredUsers(): Promise<string[]> {
  const userMap = await getAllUserMappings();
  return Object.keys(userMap).sort((a, b) => a.localeCompare(b));
}

export async function handleMenuCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  // Acknowledge the tap immediately so the client stops the spinner
  await ctx.answerCallbackQuery().catch(() => {});

  try {
    // Registration flow buttons (reg:1, reg:2, reg:yes, reg:no)
    if (data.startsWith("reg:")) {
      await handleRegistrationInput(ctx, data.slice(4));
      return;
    }

    if (data === "menu") {
      await show(ctx, MENU_TEXT, mainMenu());
      return;
    }

    if (data.startsWith("top:")) {
      const option = data.slice(4) as TopOption;
      await showLoading(ctx);
      const isPrivate = ctx.chat?.type === "private";
      const text = await renderTop(option, ctx.from?.username ?? null, isPrivate);
      await show(ctx, text);
      return;
    }

    if (data === "st:all") {
      await showLoading(ctx);
      await show(ctx, await renderStandings());
      return;
    }

    if (data === "st:recent") {
      await showLoading(ctx);
      await show(ctx, await renderRecentChampions());
      return;
    }

    if (data === "stats:me") {
      const username = ctx.from?.username;
      if (!username) {
        await show(ctx, "❌ You need to set a Telegram username to use this feature.");
        return;
      }
      await showLoading(ctx);
      await show(ctx, await renderStatsFor(username));
      return;
    }

    if (data === "ratings") {
      await show(ctx, "📈 Ratings / Рейтингҳо\n\nИнтихоб кунед / Choose a time control:", ratingsMenu());
      return;
    }

    if (data.startsWith("rt:")) {
      const tc = data.slice(3) as RatingTC;
      await showLoading(ctx);
      const text = await renderRatingsForTC(tc);
      await show(ctx, text, ratingsMenu());
      return;
    }

    if (data === "cmp") {
      const users = await sortedRegisteredUsers();
      if (users.length < 2) {
        await show(ctx, "⚠️ Need at least 2 registered users to compare.");
        return;
      }
      await show(ctx, "⚔️ Compare players\n\nSelect the FIRST player:", compareUserKeyboard(users));
      return;
    }

    if (data.startsWith("cmp1:")) {
      const firstIndex = parseInt(data.slice(5), 10);
      const users = await sortedRegisteredUsers();
      if (isNaN(firstIndex) || !users[firstIndex]) {
        await show(ctx, "⚠️ Player list changed, please try again.", mainMenu());
        return;
      }
      await show(
        ctx,
        `⚔️ Compare players\n\nFirst: @${users[firstIndex]}\nSelect the SECOND player:`,
        compareUserKeyboard(users, firstIndex)
      );
      return;
    }

    if (data.startsWith("cmp2:")) {
      const [i, j] = data.slice(5).split(":").map(n => parseInt(n, 10));
      const users = await sortedRegisteredUsers();
      if (isNaN(i) || isNaN(j) || !users[i] || !users[j]) {
        await show(ctx, "⚠️ Player list changed, please try again.", mainMenu());
        return;
      }
      await showLoading(ctx);
      await show(ctx, await renderHeadToHead(users[i], users[j]));
      return;
    }

    // Unknown callback: show the menu as a safe default
    await show(ctx, MENU_TEXT, mainMenu());
  } catch (error) {
    console.error("Error handling menu callback:", error);
    await show(ctx, "🚨 Something went wrong. Please try again.", mainMenu());
  }
}
