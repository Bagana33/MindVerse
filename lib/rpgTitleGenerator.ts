/**
 * Mindverse Realm - Personalized Crazy RPG Title Generator
 * 
 * Each student gets a UNIQUE title generated from their:
 * - Name/nickname (first letter, syllables, meaning)
 * - XP level & realm tier
 * - Grade (10, 11, 12)
 * - Email domain / patterns
 * - Special combinations
 */

export type UserTitleProfile = {
  email: string;
  name?: string;
  nickname?: string;
  experience: number;
  grade?: string;
};

// ── Modifier pools by category ──────────────────────────────────────────────

const ADJECTIVES_BY_XP: Record<string, string[]> = {
  beginner: [
    "Нойрмог", "Тэнэмэл", "Зоригтой", "Цочмог", "Тунгаамал", "Гагцхүү",
    "Будилсан", "Анхны", "Хачин", "Онцгой", "Гайхалтай", "Сэрдэг",
    "Чимээгүй", "Хайр дурлалтай", "Аймхай", "Эргэлзэмтгий", "Суугаа",
  ],
  mid: [
    "Галзуу", "Хурдан", "Нууцлаг", "Тархи зовсон", "Хар хилэн",
    "Цагдаагдсан", "Зан мэдэхгүй", "Гал сэтгэлтэй", "Бараан", "Хадмал",
    "Зодоглосон", "Шуурган", "Тэсрэх", "Ухаантай мэт", "Гоёмсог",
    "Хоёр нүүртэй", "Нисдэг", "Хов жив мэдэх",
  ],
  advanced: [
    "Алдарт", "Домогт", "Сэрдэг", "Цэргийн", "Зэрлэг", "Тэмцэгч",
    "Мөнхийн", "Хэт дэвшилтэт", "Аюулгүй", "Тасралтгүй", "Огторгуйн",
    "Тэнгэрийн", "Харанхуйн", "Нийгмийг эздийн", "Бүрэн хүчтэй",
  ],
  master: [
    "Домогт", "Мөнх", "Тэнгэрлэг", "Бурхан мэт", "Хязгааргүй",
    "Ертөнцийн", "Харанхуйн хаан", "Гэрлийн тэргүүн", "Огторгуйн эзэн",
    "Гэдэг нэрт", "Сөхрөшгүй", "Нисэгч", "Эрин зуунуудын",
  ],
};

const NOUN_CLASSES: Record<string, string[]> = {
  A: ["Мастер", "Баатар", "Эзэн", "Тэнүүчин", "Дарга", "Ноён", "Уран бүтээлч"],
  B: ["Самурай", "Мэргэн", "Тулаанч", "Шинжээч", "Судлаач", "Шидтэн"],
  C: ["Хааны бичвэрч", "Харгис алхагч", "Хар ухаалаг", "Тухайн үеийн дагина"],
  D: ["Пиксел хулгайч", "Шугамын дарга", "Цусан дизайнер", "Хар мана шидтэн"],
  E: ["Дизайны тамгатан", "Хоосон цаасны дайсан", "Deadlines-ын хохирогч", "Ctrl+Z-ийн мэргэжилтэн"],
};

// Funny Mongolian/English combo titles for specific patterns
const SPECIAL_COMBOS: { match: (u: UserTitleProfile) => boolean; title: string; emoji: string }[] = [
  {
    match: (u) => (u.experience || 0) === 0,
    title: "Хичээлийн 1-р өдрөөс оргосон",
    emoji: "🏃",
  },
  {
    match: (u) => Math.round(u.experience || 0) % 69 === 0 && (u.experience || 0) > 50,
    title: "Алтан тоон аз таарсан",
    emoji: "✨",
  },
  {
    match: (u) => (u.experience || 0) > 999,
    title: "Хүн биш бол мэтийн XP тэнгэрлэг",
    emoji: "🌌",
  },
  {
    match: (u) => (u.grade === "10"),
    title: "Арав дугаар ангийн нойрмог баатар",
    emoji: "😴",
  },
  {
    match: (u) => (u.grade === "12"),
    title: "ЭЕШ-ийн дараа гарах домогт баатар",
    emoji: "📚",
  },
  {
    match: (u) => (u.nickname || u.name || "").toLowerCase().includes("a"),
    title: "А үсэгт бүх юмыг мэдэгч",
    emoji: "🅰️",
  },
  {
    match: (u) => {
      const name = (u.nickname || u.name || u.email || "").toLowerCase();
      return name.startsWith("b");
    },
    title: "Б баатрын угийн шинэ гарлага",
    emoji: "⚡",
  },
  {
    match: (u) => (u.experience || 0) >= 100 && (u.experience || 0) < 150,
    title: "Хагас шатсан Ctrl+S мартсан",
    emoji: "💾",
  },
  {
    match: (u) => (u.experience || 0) >= 300 && (u.experience || 0) < 400,
    title: "Deadline-аас 2 минутын өмнө аврагч",
    emoji: "⏰",
  },
  {
    match: (u) => (u.experience || 0) >= 500 && (u.experience || 0) < 600,
    title: "Хагас мастер бүрэн гацаагүй",
    emoji: "🎯",
  },
  {
    match: (u) => (u.experience || 0) >= 750 && (u.experience || 0) < 850,
    title: "3D объект нүдэндээ унасан ч тэсгэсэн",
    emoji: "🗿",
  },
];

// Name-initial based titles (for first letter of name/nickname)
const INITIAL_TITLES: Record<string, { title: string; emoji: string }> = {
  А: { title: "Авьяасын Аюулт Аглаг Баатар", emoji: "🌟" },
  Б: { title: "Бүтээлийн Будлиантай Бурхан", emoji: "⚡" },
  В: { title: "Вектор Цохих Вариант Мастер", emoji: "📐" },
  Г: { title: "Гайхалтай Галзуу Гадуур Явагч", emoji: "🔥" },
  Д: { title: "Дизайны Дэлхийн Дайчин", emoji: "⚔️" },
  Е: { title: "Ертөнцийн Эрхэм Эрч Хүчт", emoji: "💫" },
  З: { title: "Зохиолчийн Зоригтой Замаар Явагч", emoji: "🗺️" },
  Н: { title: "Нойрмог Нууцлаг Нислэгийн Баатар", emoji: "🌙" },
  О: { title: "Огторгуйн Онцгой Оюуны Эзэн", emoji: "🚀" },
  С: { title: "Скетч Шатаасан Сэтгэлт Самурай", emoji: "🗡️" },
  Т: { title: "Тэнгэрлэг Тулаанч Тасдагч", emoji: "👑" },
  Х: { title: "Хар тамхины Хурдан Хачин Хүн", emoji: "💀" },
  Э: { title: "Эрин Зуунуудын Эрхэмт Эзэн", emoji: "♾️" },
  A: { title: "Aesthetic Assassin of the Artboard", emoji: "🎨" },
  B: { title: "Broken-Kerning Bone Crusher", emoji: "💥" },
  D: { title: "Deadline Dodging Dark Mage", emoji: "🧙" },
  J: { title: "Justified-Text Juggling Joker", emoji: "🃏" },
  K: { title: "Kerning-Obsessed Keyboard Knight", emoji: "⌨️" },
  M: { title: "Moodboard Manifesting Mastermind", emoji: "🧠" },
  N: { title: "Neon-Addicted Night Nomad", emoji: "🌃" },
  S: { title: "Sans-Serif Slinging Sorcerer", emoji: "🔮" },
  T: { title: "Turbopack Taming Thunder Lord", emoji: "⚡" },
  Z: { title: "Zero-Layer Zooming Zealot", emoji: "🔍" },
};

// Grade-specific suffixes
const GRADE_SUFFIXES: Record<string, string> = {
  "10": "• 10-р ангийн аянтан",
  "11": "• 11-р ангийн дундын захирагч",
  "12": "• 12-р ангийн суурь тавигч",
  "Р": "• Рашаан ойн хэсэгт орших тэмцэгч",
};

// XP milestone funky prefixes
const XP_PREFIXES: { min: number; max: number; prefix: string }[] = [
  { min: 0, max: 30, prefix: "Ажил эхлэх дурсамжгүй" },
  { min: 30, max: 80, prefix: "Дизайн гэж юу вэ гэдэг мэдэх дөхсөн" },
  { min: 80, max: 150, prefix: "Ctrl+Z-ийн гар уртассан" },
  { min: 150, max: 250, prefix: "Layer нэрлэх мартсан" },
  { min: 250, max: 380, prefix: "Figma гацлаа гэж хашхирсан" },
  { min: 380, max: 500, prefix: "Gradient хэт ихтэй гэж шүүмжлэгдсэн" },
  { min: 500, max: 650, prefix: "Pixel perfect гэдгийг мэдэгч болсон" },
  { min: 650, max: 800, prefix: "Render дуусахыг хүлээж унтсан" },
  { min: 800, max: 1000, prefix: "3D-д орон зайн баримжаа алдсан" },
  { min: 1000, max: 1300, prefix: "AI-д ажлаа тушааж сандарсан" },
  { min: 1300, max: 99999, prefix: "Дизайны хаант улсын домогт захирагч" },
];

/**
 * Hash a string to a stable integer (deterministic)
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Pick deterministically from array using email hash
 */
function pick<T>(arr: T[], hash: number, offset = 0): T {
  return arr[(hash + offset) % arr.length];
}

/**
 * Generate a unique, crazy, personalized RPG title for a student
 */
export function generatePersonalizedTitle(user: UserTitleProfile): { title: string; emoji: string; subtitle: string } {
  const xp = Math.round(user.experience || 0);
  const emailKey = user.email || "";
  const nameKey = user.nickname || user.name || emailKey.split("@")[0] || "";
  const hash = hashString(emailKey);
  const nameHash = hashString(nameKey);

  // Check special combos first (in order, take first match)
  for (const combo of SPECIAL_COMBOS) {
    if (combo.match(user)) {
      const xpPrefix = pick(XP_PREFIXES.filter(p => xp >= p.min && xp < p.max), hash, 0);
      const subtitle = xpPrefix?.prefix || "";
      const gradeSuffix = user.grade ? (GRADE_SUFFIXES[user.grade] || "") : "";
      return {
        title: combo.title,
        emoji: combo.emoji,
        subtitle: subtitle + (gradeSuffix ? ` ${gradeSuffix}` : ""),
      };
    }
  }

  // Try name-initial based title
  const firstChar = nameKey[0]?.toUpperCase() || "A";
  const initialTitle = INITIAL_TITLES[firstChar];

  // XP-based tier
  const tier = xp >= 1000 ? "master" : xp >= 450 ? "advanced" : xp >= 150 ? "mid" : "beginner";
  const adjPool = ADJECTIVES_BY_XP[tier];

  // Deterministically pick adjective and noun
  const adj = pick(adjPool, hash, 0);
  const nounClass = pick(["A", "B", "C", "D", "E"] as const, nameHash, 1);
  const noun = pick(NOUN_CLASSES[nounClass], hash, 2);

  // XP prefix/subtitle
  const xpPrefixEntry = XP_PREFIXES.find(p => xp >= p.min && xp < p.max);
  const subtitle = xpPrefixEntry?.prefix || "XP аялагч";
  const gradeSuffix = user.grade ? (GRADE_SUFFIXES[user.grade] || "") : "";

  if (initialTitle && hash % 3 === 0) {
    // 1/3 chance: use initial-based title
    return {
      title: initialTitle.title,
      emoji: initialTitle.emoji,
      subtitle: subtitle + (gradeSuffix ? ` ${gradeSuffix}` : ""),
    };
  }

  // Generate composed title
  const emojis = ["🎨", "⚡", "🔥", "🌟", "💀", "🗡️", "🧙", "🚀", "🌙", "💫", "🏹", "⚔️", "👑", "🌌", "🎭", "🧠"];
  const emoji = pick(emojis, hash, 7);

  return {
    title: `${adj} ${noun}`,
    emoji,
    subtitle: subtitle + (gradeSuffix ? ` ${gradeSuffix}` : ""),
  };
}

/**
 * Short display title (emoji + title only)
 */
export function getPersonalizedTitleShort(user: UserTitleProfile): string {
  const { emoji, title } = generatePersonalizedTitle(user);
  return `${emoji} ${title}`;
}
