/**
 * Material Symbols used across the repository, including navItems and dynamic
 * ternary states. Keep sorted and add new ligature names when adding an icon.
 * Google Fonts subsets by icon_names; this preserves the existing weight/fill axes.
 * https://developers.google.com/fonts/docs/material_symbols#optimize_the_icon_font
 */
export const MATERIAL_ICON_NAMES = [
  "add",
  "add_photo_alternate",
  "admin_panel_settings",
  "auto_awesome",
  "broken_image",
  "casino",
  "chat_bubble_outline",
  "check_circle",
  "chevron_right",
  "close",
  "edit_note",
  "emoji_events",
  "expand_more",
  "home",
  "ios_share",
  "leaderboard",
  "login",
  "logout",
  "menu",
  "notifications",
  "person",
  "progress_activity",
  "refresh",
  "reply",
  "school",
  "search",
  "send",
  "smart_toy",
  "sync",
  "thumbs_up_down",
] as const;

export const MATERIAL_SYMBOLS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1" +
  "&icon_names=" + MATERIAL_ICON_NAMES.join(",") + "&display=block";
