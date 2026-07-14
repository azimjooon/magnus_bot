// Temporary smoke test for utils/dailyStats.ts (run: npx ts-node test-daily-stats.ts)
import { collectDetailedStats } from './utils/dailyStats';

const now = Date.now();
const hoursAgo = (h: number) => now - h * 60 * 60 * 1000;

// Chess.com: win(blitz), win(blitz), draw(rapid), win(blitz), loss(rapid) -> blitz 3-0, rapid 0-1, streak max 2
const chessComGames = [
  { end_time: Math.floor(hoursAgo(10) / 1000), time_class: 'blitz', white: { username: 'alice_cc', result: 'win' }, black: { username: 'opp', result: 'checkmated' } },
  { end_time: Math.floor(hoursAgo(9) / 1000), time_class: 'blitz', white: { username: 'opp', result: 'resigned' }, black: { username: 'alice_cc', result: 'win' } },
  { end_time: Math.floor(hoursAgo(8) / 1000), time_class: 'rapid', white: { username: 'alice_cc', result: 'agreed' }, black: { username: 'opp', result: 'agreed' } },
  { end_time: Math.floor(hoursAgo(7) / 1000), time_class: 'blitz', white: { username: 'alice_cc', result: 'win' }, black: { username: 'opp', result: 'timeout' } },
  { end_time: Math.floor(hoursAgo(6) / 1000), time_class: 'rapid', white: { username: 'opp', result: 'win' }, black: { username: 'alice_cc', result: 'checkmated' } },
];

// Lichess: 4 consecutive bullet wins -> streak 4 (should beat chess.com's 2)
const lichessGames = Array.from({ length: 4 }, (_, i) => ({
  id: `g${i}`,
  rated: true,
  speed: 'bullet',
  createdAt: hoursAgo(5 - i),
  lastMoveAt: hoursAgo(5 - i),
  status: 'mate',
  players: { white: { user: { name: 'alice_li' } }, black: { user: { name: 'opp' } } },
  winner: 'white'
}));

const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string) => {
  const u = String(url);
  if (u.includes('/games/archives')) {
    return { ok: true, json: async () => ({ archives: ['https://api.chess.com/pub/player/alice_cc/games/2026/07'] }) };
  }
  if (u.includes('/games/2026/07')) {
    return { ok: true, json: async () => ({ games: chessComGames }) };
  }
  if (u.includes('lichess.org/api/games')) {
    return { ok: true, text: async () => lichessGames.map(g => JSON.stringify(g)).join('\n') };
  }
  return realFetch(url as any);
};

async function main() {
  const userMap = { alice: { chess: 'alice_cc', lichess: 'alice_li' } };
  const stats = await collectDetailedStats(userMap as any, new Date(hoursAgo(12)), new Date(now));
  const alice = stats.get('alice')!;

  const checks: [string, boolean][] = [
    ['overall wins = 7', alice.wins === 7],
    ['overall losses = 1', alice.losses === 1],
    ['totalGames = 8 (draw excluded)', alice.totalGames === 8],
    ['blitz: 3 wins 0 losses', alice.perTC.blitz.wins === 3 && alice.perTC.blitz.losses === 0],
    ['bullet: 4 wins', alice.perTC.bullet.wins === 4],
    ['rapid: 0 wins 1 loss', alice.perTC.rapid.wins === 0 && alice.perTC.rapid.losses === 1],
    ['bestStreak = 4 (lichess beats chess.com 2, draw resets)', alice.bestStreak === 4],
    ['blitz weighted = 100*sqrt(3) ~ 173', Math.abs(alice.perTC.blitz.weightedScore - 100 * Math.sqrt(3)) < 0.01],
    ['overall weighted > 0 (>=3 games)', alice.weightedScore > 0],
  ];

  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
    if (!ok) failed++;
  }
  if (failed) {
    console.log(JSON.stringify(alice, null, 2));
    process.exit(1);
  }
  console.log('All checks passed');
}

main();
