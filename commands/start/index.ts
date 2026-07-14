import { CommandContext, GrammyError, InlineKeyboard } from "grammy";
import { getUserMappings } from "../../utils/supabase";
import { startRegistrationFlow } from "../../utils/registration";
import { mainMenu, platformSelectKeyboard } from "../../utils/keyboards";

export async function handleStart(ctx: CommandContext<any>) {
  try {
    const userId = ctx.from?.id;
    const telegramUsername = ctx.from?.username;

    if (!userId) {
      await ctx.reply("❌ Unable to get your user information. Please try again.");
      return;
    }

    if (!telegramUsername) {
      await ctx.reply(
        "❌ You need to set a Telegram username to use this bot.\n\n" +
        "Go to Telegram Settings → Username and create one, then try /start again."
      );
      return;
    }

    // Check if user is already registered
    const existingMappings = await getUserMappings(telegramUsername);
    const isPrivate = ctx.chat?.type === "private";
    const isRegistered = !!(existingMappings && (existingMappings.chess || existingMappings.lichess));

    // Registration requires typing usernames, which only works in a private chat.
    // In groups: registered users get the menu, unregistered users are sent to the bot's DM.
    if (!isPrivate) {
      if (isRegistered) {
        await ctx.reply(
          `👋 @${telegramUsername}, менюро истифода баред / use the menu below:`,
          { reply_markup: mainMenu() }
        );
        return;
      }

      const botUsername = ctx.me?.username;
      const goToBot = new InlineKeyboard();
      if (botUsername) {
        goToBot.url("🤖 Ба бот равед / Open the bot", `https://t.me/${botUsername}?start=register`);
      }

      await ctx.reply(
        `⚠️ @${telegramUsername}, сабти ном танҳо дар чати шахсии бот имконпазир аст.\n` +
        `⚠️ Registration is only possible in a private chat with the bot.\n\n` +
        `Ба бот гузаред ва он ҷо /start-ро пахш кунед:\n` +
        `Go to the bot and press /start there:` +
        (botUsername ? "" : `\n\nПаёми шахсӣ ба бот нависед / Send a private message to the bot.`),
        botUsername ? { reply_markup: goToBot } : undefined
      );
      return;
    }

    if (isRegistered && existingMappings) {
      let platformsText = "";
      if (existingMappings.chess) platformsText += `♟️ Chess.com: ${existingMappings.chess}\n`;
      if (existingMappings.lichess) platformsText += `♟️ Lichess: ${existingMappings.lichess}\n`;
      
      // Check if user has both platforms registered
      if (existingMappings.chess && existingMappings.lichess) {
        await ctx.reply(
          `👋 Хуш омадед! / Welcome back!\n\n` +
          `Шумо дар ҳарду платформа сабт шудаед:\n` +
          `You're registered on both platforms:\n` +
          `🎯 Telegram: @${telegramUsername}\n` +
          platformsText + "\n" +
          `🏆 Daily Championship: Top 3 players earn points daily!\n` +
          `Awards: 🥇300pts, 🥈200pts, 🥉100pts (need 3+ games)\n\n` +
          `Менюро истифода баред / Use the menu below:`,
          { reply_markup: mainMenu() }
        );
        return;
      }

      // User has only one platform, offer to add the other
      const missingPlatform = existingMappings.chess ? 'Lichess' : 'Chess.com';

      await ctx.reply(
        `👋 Хуш омадед! / Welcome back!\n\n` +
        `Шумо аллакай сабт шудаед:\n` +
        `You're already registered:\n` +
        `🎯 Telegram: @${telegramUsername}\n` +
        platformsText + "\n" +
        `➕ Оё мехоҳед ${missingPlatform}-ро низ илова кунед?\n` +
        `➕ Would you like to add ${missingPlatform} as well?\n\n` +
        `Интихоб кунед ё "Cancel" пахш кунед:\n` +
        `Select a platform or press "Cancel":`,
        { reply_markup: platformSelectKeyboard() }
      );

      // Set user to platform selection state with existing data
      startRegistrationFlow(userId);
      return;
    }

    // Start registration flow for new users
    startRegistrationFlow(userId);

    await ctx.reply(
      "👋 Хуш омадед ба Magnus Bot! / Welcome to Magnus Bot!\n\n" +
      "🎯 Биёед ҳисоби шахматии худро сабт кунем.\n" +
      "🎯 Let's register your chess account.\n\n" +
      "Кадом платформаро интихоб мекунед?\n" +
      "Which platform would you like to choose?",
      { reply_markup: platformSelectKeyboard() }
    );
  } catch (err) {
    const errorContext = {
      updateId: ctx.update.update_id,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      timestamp: new Date().toISOString()
    };

    if (err instanceof GrammyError && err.description.includes("bot was blocked by the user")) {
      console.log(JSON.stringify({
        level: "warn",
        type: "bot_blocked",
        message: `Bot was blocked by user ${ctx.from?.id}`,
        ...errorContext,
        error: err.description
      }));
    } else {
      console.log(JSON.stringify({
        level: "error",
        type: "reply_failed",
        message: "Failed to send reply in /start",
        ...errorContext,
        error: err instanceof Error ? err.message : String(err)
      }));
    }
  }
}

// Legacy function - keeping for compatibility but not using GitHub flow anymore
export async function handleUsername(ctx: any) {
  // This function is now handled by the registration flow
  // We'll redirect to the new registration system
  const userId = ctx.from?.id;
  if (userId) {
    const { handleRegistration } = await import("../../utils/registration");
    await handleRegistration(ctx);
  }
}