export type LeaderboardUser = {
  id: string;
  name: string;
  rankTitle: string;
  points: number;
  avatarInitials?: string;
};

export const leaderboardUsers: LeaderboardUser[] = [
  { id: "1", name: "Enkhjin T.", rankTitle: "Arcane Illustrator", points: 12450, avatarInitials: "ET" },
  { id: "2", name: "Bat-Erdene U.", rankTitle: "Neon Sorcerer", points: 11890, avatarInitials: "BU" },
  { id: "3", name: "Nomin-Erdene", rankTitle: "Pixel Alchemist", points: 11230, avatarInitials: "NE" },
  { id: "4", name: "Anu D.", rankTitle: "UI Spellbinder", points: 10980, avatarInitials: "AD" },
  { id: "5", name: "Tengis B.", rankTitle: "Layout Enchanter", points: 10420, avatarInitials: "TB" },
];

export type Post = {
  id: string;
  title: string;
  description: string;
  author: string;
  points: number;
  reactions?: string[]; // Optional for backward compatibility
};

export const samplePosts: Post[] = [
  {
    id: "p1",
    title: "Cyberpunk onboarding screen",
    description: "Neon gradients, glassmorphism, and animated SVG badge.",
    author: "Enkhjin T.",
    points: 420,
    reactions: [],
  },
  {
    id: "p2",
    title: "Gamified lesson dashboard",
    description: "Card layout with XP, streaks, and tiny interactions.",
    author: "Bat-Erdene U.",
    points: 290,
    reactions: [],
  },
];
