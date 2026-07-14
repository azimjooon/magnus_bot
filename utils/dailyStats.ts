// Detailed stats collector for /top views.
// Single pass over each player's games producing: overall leaderboard stats,
// per-time-control breakdowns (blitz/bullet/rapid kings) and win streaks.
import { fetchLichessGames } from './chessApis';

export type TimeControl = 'blitz' | 'bullet' | 'rapid';
export type GameResult = 'win' | 'loss' | 'draw';

export interface TCStats {
  wins: number;
  losses: number;
  games: number;         // wins + losses (draws excluded, same as overall stats)
  winRate: number;       // percent
  weightedScore: number; // (winRate/100) * sqrt(games) * 100
}

export interface DetailedPlayerStats {
  username: string;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  weightedScore: number; // 0 unless totalGames >= 3 (main leaderboard rule)
  perTC: Record<TimeControl, TCStats>;
  bestStreak: number;    // longest consecutive-win run in period, max across platforms; draws reset it
}

const WEIGHT_FACTOR = 100;

function emptyTC(): TCStats {
  return { wins: 0, losses: 0, games: 0, winRate: 0, weightedScore: 0 };
}

function emptyStats(username: string): DetailedPlayerStats {
  return {
    username,
    wins: 0,
    losses: 0,
    totalGames: 0,
    winRate: 0,
    weightedScore: 0,
    perTC: { blitz: emptyTC(), bullet: emptyTC(), rapid: emptyTC() },
    bestStreak: 0
  };
}

// Mirror of processGame() in gameStats.ts, but distinguishes draws (needed for streaks)
export function getGameResult(game: any, username: string, platform: 'chess.com' | 'lichess'): GameResult {
  if (platform === 'chess.com') {
    const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
    const playerResult = isWhite ? game.white.result : game.black.result;
    const opponentResult = isWhite ? game.black.result : game.white.result;

    if (playerResult === 'win' || opponentResult === 'resigned' ||
        opponentResult === 'timeout' || opponentResult === 'abandoned') {
      return 'win';
    }
    if (opponentResult === 'win' || playerResult === 'resigned' ||
        playerResult === 'timeout' || playerResult === 'abandoned') {
      return 'loss';
    }
    return 'draw';
  }

  // Lichess
  const whitePlayer = game.players.white.user?.name?.toLowerCase();
  const isWhite = whitePlayer === username.toLowerCase();
  const winner = game.winner;

  if (!winner) return 'draw';
  return (isWhite && winner === 'white') || (!isWhite && winner === 'black') ? 'win' : 'loss';
}

function timeControlOf(game: any, platform: 'chess.com' | 'lichess'): TimeControl | null {
  const value = platform === 'chess.com' ? game.time_class : game.speed;
  if (value === 'blitz' || value === 'rapid' || value === 'bullet') return value;
  if (value === 'ultraBullet') return 'bullet';
  return null; // daily / classical / correspondence — count toward overall only
}

interface TimedResult {
  time: number;
  result: GameResult;
  tc: TimeControl | null;
}

async function fetchChessComResults(chessUsername: string, startMs: number, endMs: number): Promise<TimedResult[]> {
  const results: TimedResult[] = [];
  try {
    const archivesRes = await fetch(`https://api.chess.com/pub/player/${chessUsername}/games/archives`);
    if (!archivesRes.ok) return results;
    const archives = await archivesRes.json();
    if (!archives.archives?.length) return results;

    const currentMonth = archives.archives[archives.archives.length - 1];
    const gamesRes = await fetch(currentMonth);
    if (!gamesRes.ok) return results;

    const data = await gamesRes.json();
    for (const game of data.games || []) {
      const time = game.end_time * 1000;
      if (time < startMs || time > endMs) continue;
      results.push({
        time,
        result: getGameResult(game, chessUsername, 'chess.com'),
        tc: timeControlOf(game, 'chess.com')
      });
    }
  } catch (error) {
    console.error(`Error fetching Chess.com games for ${chessUsername}:`, error);
  }
  return results;
}

async function fetchLichessResults(lichessUsername: string, startMs: number, endMs: number): Promise<TimedResult[]> {
  const results: TimedResult[] = [];
  try {
    const games = await fetchLichessGames(lichessUsername, startMs, endMs);
    if (!games) return results;

    for (const game of games) {
      const time = game.lastMoveAt || game.createdAt;
      if (time < startMs || time > endMs) continue;
      results.push({
        time,
        result: getGameResult(game, lichessUsername, 'lichess'),
        tc: timeControlOf(game, 'lichess')
      });
    }
  } catch (error) {
    console.error(`Error fetching Lichess games for ${lichessUsername}:`, error);
  }
  return results;
}

// Longest run of consecutive wins; losses AND draws reset the streak
function maxWinStreak(results: TimedResult[]): number {
  const sorted = [...results].sort((a, b) => a.time - b.time);
  let best = 0;
  let current = 0;
  for (const r of sorted) {
    if (r.result === 'win') {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

function applyResults(stats: DetailedPlayerStats, results: TimedResult[]) {
  for (const r of results) {
    if (r.result === 'draw') continue; // draws excluded from win/loss stats (existing behavior)
    const buckets: { wins: number; losses: number }[] = [stats];
    if (r.tc) buckets.push(stats.perTC[r.tc]);
    for (const b of buckets) {
      if (r.result === 'win') b.wins++;
      else b.losses++;
    }
  }

  stats.totalGames = stats.wins + stats.losses;
  stats.winRate = stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0;
  stats.weightedScore = stats.totalGames >= 3
    ? (stats.winRate / 100) * Math.sqrt(stats.totalGames) * WEIGHT_FACTOR
    : 0;

  for (const tc of ['blitz', 'bullet', 'rapid'] as TimeControl[]) {
    const s = stats.perTC[tc];
    s.games = s.wins + s.losses;
    s.winRate = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    // Kings need only 1+ game in the control, so no 3-game floor here
    s.weightedScore = s.games > 0 ? (s.winRate / 100) * Math.sqrt(s.games) * WEIGHT_FACTOR : 0;
  }
}

export async function collectDetailedStats(
  userMap: Record<string, { chess: string | null; lichess: string | null }>,
  startDate: Date,
  endDate: Date
): Promise<Map<string, DetailedPlayerStats>> {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const playerStats = new Map<string, DetailedPlayerStats>();

  await Promise.all(Object.entries(userMap).map(async ([tgUsername, mappings]) => {
    const stats = emptyStats(tgUsername);
    playerStats.set(tgUsername, stats);

    try {
      const [chesscomResults, lichessResults] = await Promise.all([
        mappings.chess ? fetchChessComResults(mappings.chess, startMs, endMs) : Promise.resolve([]),
        mappings.lichess ? fetchLichessResults(mappings.lichess, startMs, endMs) : Promise.resolve([])
      ]);

      applyResults(stats, [...chesscomResults, ...lichessResults]);
      // Streaks are per platform; the displayed value is the best of the two
      stats.bestStreak = Math.max(maxWinStreak(chesscomResults), maxWinStreak(lichessResults));
    } catch (error) {
      console.error(`Error collecting stats for ${tgUsername}:`, error);
    }
  }));

  return playerStats;
}
