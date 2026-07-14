import { getAllUserScores, getRecentChampions } from "../../utils/championship";

export async function renderStandings(): Promise<string> {
  const userScores = await getAllUserScores();

  if (userScores.length === 0) {
    return (
      "🏆 CHAMPIONSHIP STANDINGS\n\n" +
      "No scores recorded yet! Start playing to earn championship points.\n\n" +
      "📊 How it works:\n" +
      "• Daily leaderboard resets every day\n" +
      "• Top 3 players earn points: 🥇300, 🥈200, 🥉100\n" +
      "• Need minimum 3 games to qualify\n" +
      "• Rankings based on win rate"
    );
  }

  let message = "🏆 CHAMPIONSHIP STANDINGS\n\n";

  userScores.forEach((user, index) => {
    const position = index + 1;
    const emoji = getPositionEmoji(position);
    message += `${emoji} ${user.telegram_username}: ${user.total_score} points\n`;
  });

  message += "\n📊 Daily points: 🥇300, 🥈200, 🥉100";

  return message;
}

export async function renderRecentChampions(): Promise<string> {
  const recentChampions = await getRecentChampions(7);

  if (recentChampions.length === 0) {
    return (
      "🏆 RECENT DAILY CHAMPIONS\n\n" +
      "No daily champions recorded yet!\n\n" +
      "Championship awards happen daily at 23:55 Tajikistan time.\n" +
      "Be the top player of the day to become champion! 👑"
    );
  }

  let message = "🏆 RECENT DAILY CHAMPIONS\n\n";

  recentChampions.forEach((champion) => {
    const date = new Date(champion.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    message += `📅 ${date}:\n`;
    message += `🥇 ${champion.first_place} (${champion.win_rate_first.toFixed(1)}%)\n`;

    if (champion.second_place) {
      message += `🥈 ${champion.second_place} (${champion.win_rate_second?.toFixed(1)}%)\n`;
    }

    if (champion.third_place) {
      message += `🥉 ${champion.third_place} (${champion.win_rate_third?.toFixed(1)}%)\n`;
    }

    message += "\n";
  });

  return message.trimEnd();
}

function getPositionEmoji(position: number): string {
  switch (position) {
    case 1: return "🥇";
    case 2: return "🥈";
    case 3: return "🥉";
    case 4: return "4️⃣";
    case 5: return "5️⃣";
    case 6: return "6️⃣";
    case 7: return "7️⃣";
    case 8: return "8️⃣";
    case 9: return "9️⃣";
    case 10: return "🔟";
    default: return `${position}.`;
  }
}
