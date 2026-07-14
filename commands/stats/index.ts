import { getUserMappings } from "../../utils/userMap";
import { fetchChessComStats, fetchLichessStats, formatCombinedStats } from "../../utils/chessApis";

// Renders stats for a registered Telegram user (driven by the "My Stats" menu button)
export async function renderStatsFor(telegramUsername: string): Promise<string> {
  try {
    const userMappings = await getUserMappings(telegramUsername);

    if (!userMappings || (!userMappings.chess && !userMappings.lichess)) {
      return "⚠️ You are not registered yet. Use /start to register your chess accounts.";
    }

    const chessComStats = userMappings.chess ? await fetchChessComStats(userMappings.chess) : null;
    const lichessStats = userMappings.lichess ? await fetchLichessStats(userMappings.lichess) : null;

    if (!chessComStats && !lichessStats) {
      return "⚠️ Could not fetch stats from Chess.com or Lichess right now. Please try again later.";
    }

    return formatCombinedStats(telegramUsername, chessComStats, lichessStats);
  } catch (err) {
    console.error(err);
    return "🚨 Error while fetching stats. Please try again later.";
  }
}
