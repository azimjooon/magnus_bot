// Game invites: Lichess open challenge (created via API, restricted to the two players)
// plus a prefilled Chess.com challenge link (Chess.com has no public challenge API).
import { InlineKeyboard } from "grammy";
import { getUserMappings } from "./userMap";

export interface InviteTimeControl {
  label: string;
  limit: number;     // initial clock, seconds
  increment: number; // seconds per move
}

export const INVITE_TIME_CONTROLS: InviteTimeControl[] = [
  { label: "🔫 1+0", limit: 60, increment: 0 },
  { label: "⚡ 3+0", limit: 180, increment: 0 },
  { label: "⚡ 5+0", limit: 300, increment: 0 },
  { label: "🏃 10+0", limit: 600, increment: 0 }
];

async function createLichessOpenChallenge(
  tc: InviteTimeControl,
  rated: boolean,
  lichessUsers?: [string, string]
): Promise<string | null> {
  try {
    const params = new URLSearchParams();
    params.set("rated", String(rated));
    params.set("clock.limit", String(tc.limit));
    params.set("clock.increment", String(tc.increment));
    // Restrict the open challenge so only these two accounts can join
    if (lichessUsers) params.set("users", lichessUsers.join(","));

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded"
    };
    if (process.env.LICHESS_API_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.LICHESS_API_TOKEN}`;
    }

    const response = await fetch("https://lichess.org/api/challenge/open", {
      method: "POST",
      headers,
      body: params.toString()
    });

    if (!response.ok) {
      console.error(`Lichess open challenge failed: ${response.status} ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    const id = data.challenge?.id ?? data.id;
    return data.challenge?.url ?? data.url ?? (id ? `https://lichess.org/${id}` : null);
  } catch (error) {
    console.error("Error creating Lichess open challenge:", error);
    return null;
  }
}

export interface InviteMessage {
  text: string;
  keyboard: InlineKeyboard;
}

export async function buildInvite(
  challengerTg: string,
  opponentTg: string,
  tcIndex: number,
  rated: boolean
): Promise<InviteMessage | null> {
  const tc = INVITE_TIME_CONTROLS[tcIndex];
  if (!tc) return null;

  const [challenger, opponent] = await Promise.all([
    getUserMappings(challengerTg),
    getUserMappings(opponentTg)
  ]);

  const bothOnLichess = !!(challenger?.lichess && opponent?.lichess);
  const lichessUrl = bothOnLichess
    ? await createLichessOpenChallenge(tc, rated, [challenger!.lichess!, opponent!.lichess!])
    : null;
  const chesscomUrl = opponent?.chess
    ? `https://www.chess.com/play/online/new?opponent=${encodeURIComponent(opponent.chess)}`
    : null;

  if (!lichessUrl && !chesscomUrl) {
    return null;
  }

  const lines = [
    "🎯 Даъват ба бозӣ! / Game Invite!",
    "",
    `@${challengerTg} ⚔️ @${opponentTg}`,
    `${tc.label} • ${rated ? "⭐ Rated" : "🎲 Casual"}`,
    ""
  ];

  if (lichessUrl) {
    lines.push("♞ Lichess: ҳарду бозигар тугмаро пахш кунанд / both players tap the button to join");
  }
  if (chesscomUrl) {
    lines.push(`♟ Chess.com: @${challengerTg} тугмаро пахш кунад / taps the button to send the challenge`);
    lines.push("   (вақт ва навъи бозӣ дар Chess.com интихоб кунед / pick time and rated mode on Chess.com)");
  }

  const keyboard = new InlineKeyboard();
  if (lichessUrl) keyboard.url("♞ Play on Lichess", lichessUrl).row();
  if (chesscomUrl) keyboard.url("♟ Challenge on Chess.com", chesscomUrl).row();

  return { text: lines.join("\n"), keyboard };
}
