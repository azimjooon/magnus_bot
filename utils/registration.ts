import { Context } from "grammy";
import { saveUserMapping } from "../utils/supabase";
import { verifyChessComUser, verifyLichessUser } from "../utils/chessApis";
import { mainMenu, platformSelectKeyboard, yesNoKeyboard } from "../utils/keyboards";

// Store user states for registration flow
const userStates = new Map<number, { 
  step: 'waiting_for_platform' | 'waiting_for_chess_username' | 'waiting_for_lichess_username' | 'waiting_for_additional_platform';
  chessUsername?: string;
  lichessUsername?: string;
}>();

export async function handleRegistration(ctx: Context): Promise<void> {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  await handleRegistrationInput(ctx, text);
}

// Shared entry point for both typed answers and inline-button callbacks (reg:* callback data)
export async function handleRegistrationInput(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const userState = userStates.get(userId);

  if (userState?.step === 'waiting_for_platform') {
    await handlePlatformSelection(ctx, text);
  } else if (userState?.step === 'waiting_for_chess_username') {
    await handleChessUsernameInput(ctx, text);
  } else if (userState?.step === 'waiting_for_lichess_username') {
    await handleLichessUsernameInput(ctx, text);
  } else if (userState?.step === 'waiting_for_additional_platform') {
    await handleAdditionalPlatformSelection(ctx, text);
  }
}

async function handlePlatformSelection(ctx: Context, selection: string): Promise<void> {
  const userId = ctx.from?.id;
  const telegramUsername = ctx.from?.username;
  if (!userId || !telegramUsername) return;

  const choice = selection.toLowerCase();
  
  // Handle cancellation
  if (choice === 'не' || choice === 'нест' || choice === 'no' || choice === 'n' || choice === 'cancel') {
    userStates.delete(userId);
    await ctx.reply(
      "✅ Бекор карда шуд. / Cancelled.\n" +
      "Шумо метавонед ҳар вақт /start-ро истифода баред.\n" +
      "You can use /start anytime to register for additional platforms."
    );
    return;
  }
  
  // Get existing mappings to preserve them
  const { getUserMappings } = await import('../utils/supabase');
  const existingMappings = await getUserMappings(telegramUsername);
  
  if (choice === '1' || choice === 'chess.com' || choice === 'chesscom') {
    const currentState = {
      step: 'waiting_for_chess_username' as const,
      lichessUsername: existingMappings?.lichess || undefined
    };
    userStates.set(userId, currentState);
    
    await ctx.reply(
      "♟️ Chess.com танланди! / Chess.com selected!\n\n" +
      "Лутфан номи корбарии Chess.com-и худро ворид кунед:\n" +
      "Please enter your Chess.com username:"
    );
  } else if (choice === '2' || choice === 'lichess') {
    const currentState = {
      step: 'waiting_for_lichess_username' as const,
      chessUsername: existingMappings?.chess || undefined
    };
    userStates.set(userId, currentState);
    
    await ctx.reply(
      "♟️ Lichess танланди! / Lichess selected!\n\n" +
      "Лутфан номи корбарии Lichess-и худро ворид кунед:\n" +
      "Please enter your Lichess username:"
    );
  } else {
    await ctx.reply(
      "❌ Интихоби нодуруст. Лутфан интихоб кунед:\n" +
      "❌ Invalid choice. Please select a platform:",
      { reply_markup: platformSelectKeyboard() }
    );
  }
}

async function handleChessUsernameInput(ctx: Context, chessUsername: string): Promise<void> {
  const userId = ctx.from?.id;
  const telegramUsername = ctx.from?.username;
  
  if (!userId || !telegramUsername) {
    await ctx.reply("❌ Unable to get your Telegram information. Please try again.");
    return;
  }

  // Validate chess.com username format (basic validation)
  if (chessUsername.length < 3 || chessUsername.length > 25) {
    await ctx.reply("❌ Invalid username. Chess.com usernames must be 3-25 characters long. Please try again:");
    return;
  }

  // Verify the chess.com username exists by making an API call
  const isValidUser = await verifyChessComUser(chessUsername);
  if (!isValidUser) {
    await ctx.reply(`❌ Chess.com user "${chessUsername}" not found. Please check the spelling and try again:`);
    return;
  }

  // Get current state to preserve any existing lichess username
  const currentState = userStates.get(userId);
  const lichessUsername = currentState?.lichessUsername;

  // Save to database
  const result = await saveUserMapping(telegramUsername, chessUsername, lichessUsername);
  
  if (!result.success) {
    await ctx.reply(`❌ Хатогӣ ҳангоми сабт: ${result.error}\n❌ Error during registration: ${result.error}`);
    return;
  }

  // Remove user from registration flow
  userStates.delete(userId);

  await ctx.reply(
    "✅ Муваффақият! Шумо сабт шудед! / Success! You are registered!\n\n" +
    `🎯 Telegram: @${telegramUsername}\n` +
    `♟️ Chess.com: ${chessUsername}\n` +
    `${lichessUsername ? `♟️ Lichess: ${lichessUsername}\n` : ''}`,
    lichessUsername ? { reply_markup: mainMenu() } : undefined
  );

  // Ask if they want to add the other platform
  if (!lichessUsername) {
    userStates.set(userId, {
      step: 'waiting_for_additional_platform',
      chessUsername
    });
    await ctx.reply(
      "➕ Оё шумо мехоҳед Lichess-ро низ илова кунед?\n" +
      "➕ Would you like to also add Lichess?",
      { reply_markup: yesNoKeyboard() }
    );
  }
}

async function handleLichessUsernameInput(ctx: Context, lichessUsername: string): Promise<void> {
  const userId = ctx.from?.id;
  const telegramUsername = ctx.from?.username;
  
  if (!userId || !telegramUsername) {
    await ctx.reply("❌ Unable to get your Telegram information. Please try again.");
    return;
  }

  // Validate lichess username format (basic validation)
  if (lichessUsername.length < 3 || lichessUsername.length > 20) {
    await ctx.reply("❌ Invalid username. Lichess usernames must be 3-20 characters long. Please try again:");
    return;
  }

  // Verify the lichess username exists by making an API call
  const isValidUser = await verifyLichessUser(lichessUsername);
  if (!isValidUser) {
    await ctx.reply(`❌ Lichess user "${lichessUsername}" not found. Please check the spelling and try again:`);
    return;
  }

  // Get current state to preserve any existing chess.com username
  const currentState = userStates.get(userId);
  const chessUsername = currentState?.chessUsername;

  // Save to database
  const result = await saveUserMapping(telegramUsername, chessUsername, lichessUsername);
  
  if (!result.success) {
    await ctx.reply(`❌ Хатогӣ ҳангоми сабт: ${result.error}\n❌ Error during registration: ${result.error}`);
    return;
  }

  // Remove user from registration flow
  userStates.delete(userId);

  await ctx.reply(
    "✅ Муваффақият! Шумо сабт шудед! / Success! You are registered!\n\n" +
    `🎯 Telegram: @${telegramUsername}\n` +
    `${chessUsername ? `♟️ Chess.com: ${chessUsername}\n` : ''}` +
    `♟️ Lichess: ${lichessUsername}`,
    chessUsername ? { reply_markup: mainMenu() } : undefined
  );

  // Ask if they want to add the other platform
  if (!chessUsername) {
    userStates.set(userId, {
      step: 'waiting_for_additional_platform',
      lichessUsername
    });
    await ctx.reply(
      "➕ Оё шумо мехоҳед Chess.com-ро низ илова кунед?\n" +
      "➕ Would you like to also add Chess.com?",
      { reply_markup: yesNoKeyboard() }
    );
  }
}

async function handleAdditionalPlatformSelection(ctx: Context, response: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const currentState = userStates.get(userId);
  if (!currentState) return;

  const answer = response.toLowerCase();
  const isYes = ['ҳа', 'бале', 'yes', 'y', 'ha', 'bale'].includes(answer);
  const isNo = ['не', 'нест', 'no', 'n', 'ne', 'nest'].includes(answer);

  if (isYes) {
    if (currentState.chessUsername) {
      // They already have chess.com, ask for lichess
      userStates.set(userId, { 
        step: 'waiting_for_lichess_username',
        chessUsername: currentState.chessUsername 
      });
      await ctx.reply(
        "♟️ Лутфан номи корбарии Lichess-и худро ворид кунед:\n" +
        "♟️ Please enter your Lichess username:"
      );
    } else {
      // They already have lichess, ask for chess.com
      userStates.set(userId, { 
        step: 'waiting_for_chess_username',
        lichessUsername: currentState.lichessUsername 
      });
      await ctx.reply(
        "♟️ Лутфан номи корбарии Chess.com-и худро ворид кунед:\n" +
        "♟️ Please enter your Chess.com username:"
      );
    }
  } else if (isNo) {
    userStates.delete(userId);
    await ctx.reply(
      "✅ Хуб! Шумо ҳар вақт метавонед платформаи дигарро бо /start илова кунед.\n" +
      "✅ Great! You can always add the other platform later with /start.",
      { reply_markup: mainMenu() }
    );
  } else {
    await ctx.reply(
      "❌ Лутфан интихоб кунед / Please answer:",
      { reply_markup: yesNoKeyboard() }
    );
  }
}

export function startRegistrationFlow(userId: number): void {
  userStates.set(userId, { step: 'waiting_for_platform' });
}

export function isUserInRegistrationFlow(userId: number): boolean {
  return userStates.has(userId);
}
