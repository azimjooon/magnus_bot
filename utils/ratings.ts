// Live rating leaderboards per platform and time control (for the Ratings menu buttons)
import { getAllUserMappings } from './userMap';
import { fetchChessComStats, fetchLichessStats } from './chessApis';

export type RatingPlatform = 'chesscom' | 'lichess';
export type RatingTC = 'blitz' | 'rapid' | 'bullet';

const PLATFORM_LABELS: Record<RatingPlatform, string> = {
  chesscom: 'Chess.com',
  lichess: 'Lichess'
};

const TC_LABELS: Record<RatingTC, string> = {
  blitz: '⚡ Blitz',
  rapid: '🏃 Rapid',
  bullet: '🔫 Bullet'
};

function getPositionEmoji(position: number): string {
  switch (position) {
    case 1: return "🥇";
    case 2: return "🥈";
    case 3: return "🥉";
    default: return `${position}.`;
  }
}

export async function renderRatingsTable(platform: RatingPlatform, tc: RatingTC): Promise<string> {
  const userMap = await getAllUserMappings();

  const entries = Object.entries(userMap)
    .map(([tgUsername, mappings]) => ({
      tgUsername,
      platformUsername: platform === 'chesscom' ? mappings.chess : mappings.lichess
    }))
    .filter(e => e.platformUsername);

  if (entries.length === 0) {
    return `📈 ${PLATFORM_LABELS[platform]} ${TC_LABELS[tc]}\n\nNo registered ${PLATFORM_LABELS[platform]} accounts yet.`;
  }

  const ratings = await Promise.all(entries.map(async e => {
    let rating: number | null = null;
    try {
      if (platform === 'chesscom') {
        const stats = await fetchChessComStats(e.platformUsername!);
        const key = `chess_${tc}` as 'chess_blitz' | 'chess_rapid' | 'chess_bullet';
        rating = stats?.[key]?.last?.rating ?? null;
      } else {
        const stats = await fetchLichessStats(e.platformUsername!);
        rating = stats?.perfs?.[tc]?.rating ?? null;
      }
    } catch (error) {
      console.error(`Error fetching ${platform} rating for ${e.tgUsername}:`, error);
    }
    return { tgUsername: e.tgUsername, rating };
  }));

  const ranked = ratings
    .filter((r): r is { tgUsername: string; rating: number } => r.rating !== null)
    .sort((a, b) => b.rating - a.rating);

  const lines = [`📈 ${PLATFORM_LABELS[platform]} ${TC_LABELS[tc]} Ratings`, ""];

  if (ranked.length === 0) {
    lines.push(`No ${tc} ratings found for registered players.`);
  } else {
    ranked.forEach((r, i) => {
      lines.push(`${getPositionEmoji(i + 1)} ${r.tgUsername} — ${r.rating}`);
    });
  }

  return lines.join('\n');
}
