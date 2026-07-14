// Live rating leaderboards per time control (for the Ratings menu buttons).
// One screen per time control: Chess.com top list first, then Lichess separately.
import { getAllUserMappings } from './userMap';
import { fetchChessComStats, fetchLichessStats } from './chessApis';

export type RatingTC = 'blitz' | 'rapid' | 'bullet';

const TOP_LIMIT = 50;

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

interface RatedPlayer {
  tgUsername: string;
  rating: number;
}

function formatRanking(players: RatedPlayer[]): string[] {
  return players
    .sort((a, b) => b.rating - a.rating)
    .slice(0, TOP_LIMIT)
    .map((p, i) => `${getPositionEmoji(i + 1)} ${p.tgUsername} — ${p.rating}`);
}

export async function renderRatingsForTC(tc: RatingTC): Promise<string> {
  const userMap = await getAllUserMappings();
  const entries = Object.entries(userMap);

  if (entries.length === 0) {
    return `📈 ${TC_LABELS[tc]} Ratings\n\nNo registered users yet.`;
  }

  const chesscom: RatedPlayer[] = [];
  const lichess: RatedPlayer[] = [];

  await Promise.all(entries.map(async ([tgUsername, mappings]) => {
    try {
      const [ccStats, liStats] = await Promise.all([
        mappings.chess ? fetchChessComStats(mappings.chess) : Promise.resolve(null),
        mappings.lichess ? fetchLichessStats(mappings.lichess) : Promise.resolve(null)
      ]);

      const key = `chess_${tc}` as 'chess_blitz' | 'chess_rapid' | 'chess_bullet';
      const ccRating = ccStats?.[key]?.last?.rating;
      if (ccRating != null) chesscom.push({ tgUsername, rating: ccRating });

      const liRating = liStats?.perfs?.[tc]?.rating;
      if (liRating != null) lichess.push({ tgUsername, rating: liRating });
    } catch (error) {
      console.error(`Error fetching ratings for ${tgUsername}:`, error);
    }
  }));

  const lines = [`📈 ${TC_LABELS[tc]} Ratings (Top ${TOP_LIMIT})`, ""];

  lines.push(`♟ Chess.com:`);
  if (chesscom.length === 0) {
    lines.push(`No ${tc} ratings found.`);
  } else {
    lines.push(...formatRanking(chesscom));
  }

  lines.push("");
  lines.push(`♞ Lichess:`);
  if (lichess.length === 0) {
    lines.push(`No ${tc} ratings found.`);
  } else {
    lines.push(...formatRanking(lichess));
  }

  return lines.join('\n');
}
