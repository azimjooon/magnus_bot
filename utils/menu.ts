// Callback router for the button-driven UI. All bot features are reachable from here.
import { Context } from "grammy";
import { renderTop, TopOption } from "../commands/top";
import { renderStandings, renderRecentChampions } from "../commands/standings";
import { renderStatsFor } from "../commands/stats";
import { renderRatingsForTC, RatingTC } from "./ratings";
import { renderHeadToHead } from "./headToHead";
import { buildInvite, INVITE_TIME_CONTROLS } from "./invite";
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

// Two-column keyboard of registered users; callbacks carry the user's index in the sorted list
function userSelectKeyboard(
  usernames: string[],
  toCallback: (index: number) => string,
  excludeName?: string
): InlineKeyboard {
  const kb = new InlineKeyboard();
  let buttonsInRow = 0;
  usernames.forEach((name, i) => {
    if (excludeName !== undefined && name === excludeName) return;
    kb.text(`@${name}`, toCallback(i));
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

function compareUserKeyboard(usernames: string[], firstIndex?: number): InlineKeyboard {
  return userSelectKeyboard(
    usernames,
    firstIndex === undefined ? (i) => `cmp1:${i}` : (i) => `cmp2:${firstIndex}:${i}`,
    firstIndex === undefined ? undefined : usernames[firstIndex]
  );
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

    // Game invite flow: pick opponent -> pick time control -> rated/casual -> post invite
    if (data === "inv") {
      const challenger = ctx.from?.username;
      if (!challenger) {
        await show(ctx, "❌ You need a Telegram username to send invites.");
        return;
      }
      const users = await sortedRegisteredUsers();
      const opponents = users.filter(u => u !== challenger);
      if (opponents.length === 0) {
        await show(ctx, "⚠️ No other registered players to invite.");
        return;
      }
      await show(
        ctx,
        "🎯 Даъват / Send invite\n\nҲарифро интихоб кунед / Select your opponent:",
        userSelectKeyboard(users, (i) => `inv1:${i}`, challenger)
      );
      return;
    }

    if (data.startsWith("inv1:")) {
      const opponentIndex = parseInt(data.slice(5), 10);
      const users = await sortedRegisteredUsers();
      if (isNaN(opponentIndex) || !users[opponentIndex]) {
        await show(ctx, "⚠️ Player list changed, please try again.", mainMenu());
        return;
      }
      const kb = new InlineKeyboard();
      INVITE_TIME_CONTROLS.forEach((tc, t) => kb.text(tc.label, `inv2:${opponentIndex}:${t}`));
      kb.row().text("⬅️ Menu", "menu");
      await show(
        ctx,
        `🎯 Invite for @${users[opponentIndex]}\n\nНазорати вақтро интихоб кунед / Select time control:`,
        kb
      );
      return;
    }

    if (data.startsWith("inv2:")) {
      const [opponentIndex, tcIndex] = data.slice(5).split(":").map(n => parseInt(n, 10));
      const users = await sortedRegisteredUsers();
      const tc = INVITE_TIME_CONTROLS[tcIndex];
      if (isNaN(opponentIndex) || !users[opponentIndex] || !tc) {
        await show(ctx, "⚠️ Something changed, please try again.", mainMenu());
        return;
      }
      const kb = new InlineKeyboard()
        .text("⭐ Rated", `inv3:${opponentIndex}:${tcIndex}:1`)
        .text("🎲 Casual", `inv3:${opponentIndex}:${tcIndex}:0`).row()
        .text("⬅️ Menu", "menu");
      await show(
        ctx,
        `🎯 Invite for @${users[opponentIndex]} (${tc.label})\n\nНавъи бозӣ / Game type:`,
        kb
      );
      return;
    }

    if (data.startsWith("inv3:")) {
      const [opponentIndex, tcIndex, ratedFlag] = data.slice(5).split(":").map(n => parseInt(n, 10));
      const challenger = ctx.from?.username;
      const users = await sortedRegisteredUsers();
      if (!challenger || isNaN(opponentIndex) || !users[opponentIndex] || !INVITE_TIME_CONTROLS[tcIndex]) {
        await show(ctx, "⚠️ Something changed, please try again.", mainMenu());
        return;
      }
      await showLoading(ctx);
      const invite = await buildInvite(challenger, users[opponentIndex], tcIndex, ratedFlag === 1);
      if (!invite) {
        await show(ctx, `⚠️ Could not create an invite for @${users[opponentIndex]} — no platform accounts found or Lichess is unavailable.`);
        return;
      }
      // Post the invite as a NEW message so the opponent gets a mention notification,
      // then restore the menu in the original message
      await ctx.reply(invite.text, { reply_markup: invite.keyboard });
      await show(ctx, MENU_TEXT, mainMenu());
      return;
    }

    // Unknown callback: show the menu as a safe default
    await show(ctx, MENU_TEXT, mainMenu());
  } catch (error) {
    console.error("Error handling menu callback:", error);
    await show(ctx, "🚨 Something went wrong. Please try again.", mainMenu());
  }
}
