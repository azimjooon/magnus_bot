import { getAllUserMappings } from "../../utils/userMap";
import { collectDetailedStats, DetailedPlayerStats, TimeControl } from "../../utils/dailyStats";
import { getStartOfDayTajikistan, getTajikistanTime } from "../../utils/timeUtils";

export type TopOption = 'bugun' | 'blitz' | 'bullet' | 'rapid' | 'month';

const TITLES: Record<TopOption, string> = {
    bugun: "🏆 Today's Leaderboard",
    month: "🏆 Monthly Leaderboard",
    blitz: "⚡ Monthly Blitz Leaderboard",
    bullet: "🔫 Monthly Bullet Leaderboard",
    rapid: "🏃 Monthly Rapid Leaderboard"
};

const KING_LABELS: Record<TimeControl, string> = {
    blitz: "👑 King of Blitz",
    bullet: "🔫 Best Bullet Player",
    rapid: "🏃 Rapid Champion"
};

function getPositionEmoji(position: number): string {
    switch (position) {
        case 1: return "🥇";
        case 2: return "🥈";
        case 3: return "🥉";
        default: return `${position}.`;
    }
}

function sortByScore(players: DetailedPlayerStats[], score: (p: DetailedPlayerStats) => number): DetailedPlayerStats[] {
    return [...players].sort((a, b) => {
        if (score(b) !== score(a)) return score(b) - score(a);
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.wins - a.wins;
    });
}

// viewer/isPrivate: "(you: X)" suffixes are shown only in private chats
export async function renderTop(option: TopOption, viewer?: string | null, isPrivate = false): Promise<string> {
    const userMap = await getAllUserMappings();

    if (Object.keys(userMap).length === 0) {
        return "⚠️ No registered users found. Users can register with /start";
    }

    const now = new Date();
    let startDate: Date;

    if (option === 'bugun') {
        startDate = getStartOfDayTajikistan(now);
    } else {
        const tajikTime = getTajikistanTime(now);
        startDate = new Date(Date.UTC(
            tajikTime.getFullYear(),
            tajikTime.getMonth(),
            1,
            -5, // 00:00 Tajikistan time in UTC
            0, 0, 0
        ));
    }

    const playerStats = await collectDetailedStats(userMap, startDate, now);
    const allPlayers = [...playerStats.values()];
    const showYou = isPrivate && viewer && playerStats.has(viewer);
    const viewerStats = viewer ? playerStats.get(viewer) : undefined;

    // Main leaderboard: overall for bugun/month, per-control for blitz/bullet/rapid
    const isTCView = option === 'blitz' || option === 'bullet' || option === 'rapid';
    const boardScore = isTCView
        ? (p: DetailedPlayerStats) => p.perTC[option as TimeControl].weightedScore
        : (p: DetailedPlayerStats) => p.weightedScore;
    const boardGames = isTCView
        ? (p: DetailedPlayerStats) => p.perTC[option as TimeControl].games
        : (p: DetailedPlayerStats) => p.totalGames;

    const sortedPlayers = sortByScore(allPlayers, boardScore).filter(p => boardGames(p) >= 3);

    const lines: string[] = [TITLES[option], ""];

    if (sortedPlayers.length === 0) {
        lines.push("📊 No qualifying players found.");
        lines.push("Players need at least 3 games to appear on the leaderboard.");
    } else {
        let currentRank = 1;
        for (let i = 0; i < sortedPlayers.length; i++) {
            const player = sortedPlayers[i];
            if (i > 0 && Math.abs(boardScore(player) - boardScore(sortedPlayers[i - 1])) >= 0.01) {
                currentRank++;
            }
            lines.push(`${getPositionEmoji(currentRank)} ${player.username}: ${boardScore(player).toFixed(1)}`);
        }
    }

    // Kings of each time control + best win streak — today's view only
    if (option === 'bugun') {
        lines.push("");
        for (const tc of ['blitz', 'bullet', 'rapid'] as TimeControl[]) {
            const contenders = sortByScore(allPlayers.filter(p => p.perTC[tc].games > 0), p => p.perTC[tc].weightedScore);
            const king = contenders[0];
            let line = `${KING_LABELS[tc]}: `;
            if (king) {
                line += `@${king.username} — ${Math.round(king.perTC[tc].weightedScore)}`;
                if (showYou && viewerStats && king.username !== viewer) {
                    line += ` (you: ${Math.round(viewerStats.perTC[tc].weightedScore)})`;
                }
            } else {
                line += "no games yet";
            }
            lines.push(line);
        }

        const streakLeader = allPlayers
            .filter(p => p.bestStreak > 0)
            .sort((a, b) => b.bestStreak - a.bestStreak)[0];
        let streakLine = "🔥 Best Win Streak (today): ";
        if (streakLeader) {
            streakLine += `@${streakLeader.username} — ${streakLeader.bestStreak}`;
            if (showYou && viewerStats && streakLeader.username !== viewer) {
                streakLine += ` (you: ${viewerStats.bestStreak})`;
            }
        } else {
            streakLine += "no wins yet";
        }
        lines.push(streakLine);
    }

    return lines.join('\n');
}
