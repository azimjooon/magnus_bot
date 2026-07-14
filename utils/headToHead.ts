// Head-to-head comparison between two registered players (extracted from the old /score command
// so it can be driven by inline buttons)
import { getUserMappings } from "./userMap";
import { fetchLichessGames } from "./chessApis";

export async function renderHeadToHead(tgUser1: string, tgUser2: string): Promise<string> {
    const userMappingsArray = await Promise.all([getUserMappings(tgUser1), getUserMappings(tgUser2)]);

    if (userMappingsArray.some(mapping => !mapping || (!mapping.chess && !mapping.lichess))) {
        return "⚠️ One or both users haven't registered any chess platform usernames. They should use /start first.";
    }

    const [user1Mappings, user2Mappings] = userMappingsArray as Array<{ chess: string | null; lichess: string | null }>;

    // Prioritize Chess.com for head-to-head comparison, fall back to Lichess
    const player1 = user1Mappings.chess || user1Mappings.lichess;
    const player2 = user2Mappings.chess || user2Mappings.lichess;

    if (!player1 || !player2) {
        return "⚠️ Unable to determine chess usernames for comparison.";
    }

    const platform = (user1Mappings.chess && user2Mappings.chess) ? 'chess.com' : 'lichess';

    try {
        let headToHeadGames: any[] = [];

        if (platform === 'chess.com') {
            const archivesRes = await fetch(`https://api.chess.com/pub/player/${player1}/games/archives`);
            if (!archivesRes.ok) {
                return "⚠️ Error fetching game archives. Please try again later.";
            }

            const archives = await archivesRes.json();
            const currentMonth = archives.archives[archives.archives.length - 1];

            const gamesRes = await fetch(currentMonth);
            if (!gamesRes.ok) {
                return "⚠️ Error fetching games. Please try again later.";
            }

            const { games } = await gamesRes.json();

            headToHeadGames = games.filter((game: any) =>
                (game.white.username.toLowerCase() === player1.toLowerCase() && game.black.username.toLowerCase() === player2.toLowerCase()) ||
                (game.white.username.toLowerCase() === player2.toLowerCase() && game.black.username.toLowerCase() === player1.toLowerCase())
            );
        } else {
            const now = Date.now();
            const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

            const games1 = await fetchLichessGames(player1, oneMonthAgo, now);
            const games2 = await fetchLichessGames(player2, oneMonthAgo, now);

            if (!games1 || !games2) {
                return "⚠️ Error fetching games from Lichess. Please try again later.";
            }

            const allGames = [...games1, ...games2];
            const gameIds = new Set();

            headToHeadGames = allGames.filter(game => {
                const whiteName = game.players.white.user?.name?.toLowerCase();
                const blackName = game.players.black.user?.name?.toLowerCase();
                const isHeadToHead = (
                    (whiteName === player1.toLowerCase() && blackName === player2.toLowerCase()) ||
                    (whiteName === player2.toLowerCase() && blackName === player1.toLowerCase())
                );

                if (isHeadToHead && !gameIds.has(game.id)) {
                    gameIds.add(game.id);
                    return true;
                }
                return false;
            });
        }

        if (headToHeadGames.length === 0) {
            return `📊 No games found between @${tgUser1} and @${tgUser2} for this month on ${platform}.`;
        }

        let player1Wins = 0;
        let player2Wins = 0;
        let draws = 0;

        if (platform === 'chess.com') {
            headToHeadGames.forEach((game: any) => {
                const isPlayer1White = game.white.username.toLowerCase() === player1.toLowerCase();
                const player1Result = isPlayer1White ? game.white.result : game.black.result;
                const player2Result = isPlayer1White ? game.black.result : game.white.result;

                if (player1Result === 'win' || player2Result === 'resigned' ||
                    player2Result === 'timeout' || player2Result === 'abandoned') {
                    player1Wins++;
                } else if (player2Result === 'win' || player1Result === 'resigned' ||
                    player1Result === 'timeout' || player1Result === 'abandoned') {
                    player2Wins++;
                } else {
                    draws++;
                }
            });
        } else {
            headToHeadGames.forEach((game: any) => {
                const whitePlayer = game.players.white.user?.name?.toLowerCase();
                const winner = game.winner;

                if (!winner) {
                    draws++;
                } else if ((whitePlayer === player1.toLowerCase() && winner === 'white') ||
                          (whitePlayer !== player1.toLowerCase() && winner === 'black')) {
                    player1Wins++;
                } else {
                    player2Wins++;
                }
            });
        }

        const lastGameUrl = platform === 'chess.com'
            ? headToHeadGames[headToHeadGames.length - 1].url
            : `https://lichess.org/${headToHeadGames[headToHeadGames.length - 1].id}`;

        return [
            `📊 Head-to-head stats for this month (${platform}):`,
            `@${tgUser1} vs @${tgUser2}`,
            ``,
            `Total games: ${headToHeadGames.length}`,
            `@${tgUser1} wins: ${player1Wins}`,
            `@${tgUser2} wins: ${player2Wins}`,
            `Draws: ${draws}`,
            ``,
            `Last game: ${lastGameUrl}`
        ].join('\n');
    } catch (err) {
        console.error(err);
        return "🚨 Error fetching head-to-head stats. Please try again later.";
    }
}
