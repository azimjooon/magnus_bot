// Inline keyboards for the button-driven UI. No local imports here on purpose —
// this module is shared by registration, start and the callback router.
import { InlineKeyboard } from "grammy";

export function mainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🏆 Today's Top", "top:bugun").row()
    .text("⚡ Blitz", "top:blitz")
    .text("🔫 Bullet", "top:bullet")
    .text("🏃 Rapid", "top:rapid").row()
    .text("🏅 Standings", "st:all")
    .text("👑 Champions", "st:recent").row()
    .text("📊 My Stats", "stats:me")
    .text("⚔️ Compare", "cmp").row()
    .text("📈 Ratings", "ratings");
}

export function backToMenu(): InlineKeyboard {
  return new InlineKeyboard().text("⬅️ Menu", "menu");
}

export function ratingsMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔫 Bullet", "rt:bullet")
    .text("⚡ Blitz", "rt:blitz")
    .text("🏃 Rapid", "rt:rapid").row()
    .text("⬅️ Menu", "menu");
}

// Registration flow keyboards (callbacks are routed to the text-based registration handlers)
export function platformSelectKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("1️⃣ Chess.com", "reg:1")
    .text("2️⃣ Lichess", "reg:2").row()
    .text("❌ Cancel / Бекор", "reg:no");
}

export function yesNoKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Yes / Ҳа", "reg:yes")
    .text("❌ No / Не", "reg:no");
}

export const MENU_TEXT =
  "♟️ Magnus Bot Menu\n" +
  "Менюи Magnus Bot\n\n" +
  "Интихоб кунед / Choose an option:";
