/** Offline practice briefs. Every client and event below is fictional. */
export const BRIEF_CATEGORIES = [
  { id: "school", label: "Сургуулийн амьдрал" },
  { id: "culture", label: "Соёл, өв уламжлал" },
  { id: "environment", label: "Байгаль, орчин" },
  { id: "sport", label: "Спорт, хөдөлгөөн" },
  { id: "music", label: "Хөгжим, дуу авиа" },
  { id: "technology", label: "Технологи, бүтээл" },
] as const;

export const BRIEF_LEVELS = [
  { id: "beginner", label: "Эхлэгч", minutes: 30, description: "Нэг гол дүрс, тод гарчигтай постер бүтээе." },
  { id: "standard", label: "Дунд", minutes: 45, description: "Хоёр ноорог харьцуулж, мэдээллийн дарааллаа шийдье." },
  { id: "advanced", label: "Ахисан", minutes: 60, description: "Өвөрмөц дүрслэл туршиж, сонголтоо тайлбарлая." },
] as const;

export const BRIEF_FORMATS = [
  { id: "a4", label: "A4 постер", dimensions: "210 × 297 мм", delivery: "Босоо байрлалтай PDF. Хэвлэх бол 100% хэмжээгээр шалга." },
  { id: "a3", label: "A3 постер", dimensions: "297 × 420 мм", delivery: "Босоо байрлалтай PDF. Жижигрүүлж харахад ч гарчиг тод байх ёстой." },
  { id: "square", label: "Дөрвөлжин пост", dimensions: "1080 × 1080 px", delivery: "Дөрвөлжин PNG. Утасны дэлгэцийн хэмжээнд уншигдахыг шалга." },
  { id: "story", label: "Босоо сторид", dimensions: "1080 × 1920 px", delivery: "Босоо PNG. Гол мэдээллээ дээд, доод захаас 250 px зайтай байрлуул." },
] as const;

export type BriefCategory = (typeof BRIEF_CATEGORIES)[number];
export type BriefLevel = (typeof BRIEF_LEVELS)[number];
export type BriefFormat = (typeof BRIEF_FORMATS)[number];
export type BriefOptions = { category: string; level: string; format: string };
export type BriefColor = { name: string; hex: string };
export type BriefStep = { title: string; minutes: number; description: string };

export type PosterBrief = {
  id: string;
  templateId: string;
  category: BriefCategory;
  level: BriefLevel;
  format: BriefFormat;
  title: string;
  client: string;
  audience: string;
  goal: string;
  headline: string;
  body: string;
  callToAction: string;
  conceptStarter: string;
  palette: BriefColor[];
  requirements: string[];
  challenge: string;
  steps: BriefStep[];
  checklist: string[];
  createdAt?: string;
};

type PosterTemplate = Pick<PosterBrief,
  "title" | "client" | "audience" | "goal" | "headline" | "body" |
  "callToAction" | "conceptStarter" | "palette" | "requirements"
> & { id: string; category: BriefCategory["id"] };

const TEMPLATES: readonly PosterTemplate[] = [
  {
    id: "school-book-exchange", category: "school", title: "Номын шинэ эзэн",
    client: "«Номын жим» сурагчдын клуб",
    audience: "Уншсан номоо найзтайгаа солилцохыг хүссэн 9–12-р ангийн сурагчид",
    goal: "Сурагчийг сайн хадгалсан нэг номоо солилцоонд авчрахад уриалах.",
    headline: "Уншсан номдоо шинэ найз олъё",
    body: "Өөрийн дуртай номоо солилцож, дараагийн түүхээ нээ. Номондоо нэг өгүүлбэрийн сэтгэгдэл хавсаргаарай.",
    callToAction: "Нэг номоо сонгоод ирээрэй",
    conceptStarter: "Дэлгээтэй номын хоёр талд өөр өөр уншигчийн ертөнц үргэлжилж байгаагаар дүрсэл.",
    palette: [{ name: "Бэхэн хөх", hex: "#172554" }, { name: "Цаасан шаргал", hex: "#FFF7DF" }, { name: "Нарны шар", hex: "#FBBF24" }],
    requirements: ["Ном солилцох санааг ганц гол дүрсээр ойлгуул.", "«Нэг ном» гэсэн үйлдлийг уриалгад тодруул.", "Номын бодит хавтас, зохиогчийн бүтээлийг хуулалгүй өөрөө зур."],
  },
  {
    id: "school-club-fair", category: "school", title: "Өөрийн клубээ ол",
    client: "«Сонирхлын уулзвар» сурагчдын зөвлөл",
    audience: "Ямар клубт орохоо хараахан шийдээгүй сурагчид",
    goal: "Олон сонирхол туршиж болохыг харуулж, клубийн танилцуулгад оролцох хүсэл төрүүлэх.",
    headline: "Чиний сонирхол хаана хүргэх вэ?",
    body: "Зураг, шинжлэх ухаан, жүжиг, ном — шинэ зүйл турших нэг алхмаа сонго. Туршлага шаардахгүй.",
    callToAction: "Нэг клубтэй танилцаарай",
    conceptStarter: "Нэг уулзвараас дөрвөн өөр сонирхлын зам салаалж байгаагаар дүрсэл.",
    palette: [{ name: "Шөнийн нил", hex: "#2E1065" }, { name: "Цайвар нил", hex: "#F5F3FF" }, { name: "Гэгээн улбар", hex: "#FB923C" }],
    requirements: ["Дөрвөн сонирхлыг ижил төрлийн энгийн тэмдгээр дүрсэл.", "«Туршлага шаардахгүй» гэдгийг уншихад амар байрлуул."],
  },
  {
    id: "school-first-exhibit", category: "school", title: "Анхны бүтээлийн үзэсгэлэн",
    client: "«Эхлэл» сургуулийн урлан",
    audience: "Бүтээлээ бусдад үзүүлэхээс санаа зовж буй сурагчид",
    goal: "Төгс байх албагүйг ойлгуулж, өөрийн нэг бүтээлийг дэлгэхэд урам өгөх.",
    headline: "Анхны бүтээл ч үнэ цэнтэй",
    body: "Ноорог, зураг, эвлүүлэг бүр чиний нэг санааг өгүүлнэ. Бүтээлийнхээ нэр, богино тайлбарыг бэлдээрэй.",
    callToAction: "Нэг бүтээлээ дэлгэе",
    conceptStarter: "Жижиг ноорог том жаазны дотор итгэлтэй харагдах санаагаар тогло.",
    palette: [{ name: "Хар бэх", hex: "#1C1917" }, { name: "Дулаан цагаан", hex: "#FFFBEB" }, { name: "Шүрэн улаан", hex: "#FB7185" }],
    requirements: ["Өөрийн зурсан ноорог эсвэл цаасны дүрсийг гол элемент болго.", "Бусад сурагчийн бүтээлийг үнэлэх, харьцуулах үг бүү ашигла."],
  },
  {
    id: "school-study-corner", category: "school", title: "Тайван унших булан",
    client: "«Чимээгүй булан» номын сангийн баг",
    audience: "Завсарлагаар унших, зурж тэмдэглэх тайван орчин хайсан сурагчид",
    goal: "Хамтын унших орон зайг бусдад тухтай ашиглах нэг дадлыг сануулах.",
    headline: "Нэг булан. Олон шинэ санаа.",
    body: "Номоо дэлгээд, санаагаа тэмдэглэ. Яриагаа намсгаж, дараагийн уншигчид цэвэр ширээ үлдээгээрэй.",
    callToAction: "Тайван булангаа хамтдаа хайрлая",
    conceptStarter: "Ширээний чөлөөт зайг томоор үлдээж, нэг номоос санааны дүрс ургуул.",
    palette: [{ name: "Ойн ногоон", hex: "#14532D" }, { name: "Сүүн цагаан", hex: "#F7FEE7" }, { name: "Навчны ногоон", hex: "#A3E635" }],
    requirements: ["Хоосон зайг ашиглан тайван мэдрэмж төрүүл.", "Нам ярих, цэвэр үлдээх гэсэн хоёр дадлыг жижиг тэмдгээр нэм."],
  },
  {
    id: "culture-tale-picture", category: "culture", title: "Үлгэрийг өөрийнхөөрөө зур",
    client: "«Үгийн зураг» дүрслэлийн дугуйлан",
    audience: "Өгүүллэг, үлгэрийн дүр зохиох сонирхолтой сурагчид",
    goal: "Сурагчийг өөрийн зохиосон богино үлгэрийн нэг хэсгийг зургаар өгүүлэхэд уриалах.",
    headline: "Нэг үлгэр. Чиний дүрслэл.",
    body: "Гурван өгүүлбэртэй үлгэр зохиогоод, хамгийн сонирхолтой мөчийг нь зур. Баатар чинь хэн ч байж болно.",
    callToAction: "Үлгэрийнхээ нэг мөчийг зур",
    conceptStarter: "Нээлттэй цонхны цаана үлгэрийн ертөнц харагдаж байгаагаар төсөөл.",
    palette: [{ name: "Гүн нил", hex: "#3B0764" }, { name: "Тоорын цайвар", hex: "#FFF1E6" }, { name: "Зөөлөн ягаан", hex: "#F9A8D4" }],
    requirements: ["Өөрийн зохиосон нэг баатар эсвэл орчныг дүрсэл.", "Бэлэн кино, тоглоомын дүр ашиглахгүй."],
  },
  {
    id: "culture-letter-lab", category: "culture", title: "Үсгийн хэлбэрийн урлан",
    client: "«Үсэг ба дүрс» урлангийн баг",
    audience: "Үсэг, бичвэрийг зургаар илэрхийлэх сонирхолтой сурагчид",
    goal: "Монгол кирилл үсгийн хэлбэрийг ажиглаж, үсгээр санаа илэрхийлэхэд уриалах.",
    headline: "Нэг үсэг — олон дүрс",
    body: "Нэрийнхээ эхний үсгийг сонго. Шугам, зай, давталтаар түүнд шинэ төрх өгөөд туршаарай.",
    callToAction: "Өөрийн үсгийг шинээр хар",
    conceptStarter: "Том үсгийн доторх сул зайг жижиг ертөнцийн хаалга болгон ашигла.",
    palette: [{ name: "Гүн хүрэн", hex: "#451A03" }, { name: "Цаасны өнгө", hex: "#FFFBEB" }, { name: "Хув шар", hex: "#F59E0B" }],
    requirements: ["Монгол кирилл үсгийг гол дүрс болгон өөрөө байгуул.", "Чимэглэсэн ч тухайн үсэг танигдахаар үлдээ.", "Үсгийн зохиомж болон үндсэн бичвэрийг ялга."],
  },
  {
    id: "culture-object-story", category: "culture", title: "Эд зүйлсийн дурсамж",
    client: "«Дурсамжийн хайрцаг» сурагчдын төсөл",
    audience: "Гэр бүлийнхээ энгийн дурсамжийг уран бүтээлээр өгүүлэх сурагчид",
    goal: "Хувийн мэдээлэл дэлгэхгүйгээр нэг эд зүйлийн түүхийг бүтээл болгоход уриалах.",
    headline: "Энгийн зүйлд түүх бий",
    body: "Аяга, дэвтэр, тоглоом — нэг зүйлийг сонгоод түүнтэй холбоотой дурсамжаа зур. Зохиомол түүх ч байж болно.",
    callToAction: "Нэг зүйлээр түүхээ өгүүл",
    conceptStarter: "Нэг эд зүйлийн сүүдэр дурсамжийн дүрс болж хувирах санааг турш.",
    palette: [{ name: "Нүүрсэн саарал", hex: "#292524" }, { name: "Элсэн цайвар", hex: "#FEF3C7" }, { name: "Зэсийн улбар", hex: "#EA580C" }],
    requirements: ["Эд зүйлийн дүрсийг хамгийн том элемент болго.", "Бодит гэр бүлийн зураг, нэр, хаяг оруулах шаардлагагүй."],
  },
  {
    id: "culture-pattern-workshop", category: "culture", title: "Хээгээр хэмнэл бүтээе",
    client: "«Хэлхээ» хээ угалзын урлан",
    audience: "Геометр дүрс, давталтаар зураг бүтээх дуртай сурагчид",
    goal: "Өөрийн зохиосон энгийн хээг давтаж, орчин үеийн постерт хэрэглэхэд уриалах.",
    headline: "Жижиг дүрсээс том хэмнэл",
    body: "Нэг дүрс зохио. Эргүүлж, давтаж, хоорондын зайг нь өөрчил. Өөрийн хээний хэмнэлийг олоорой.",
    callToAction: "Өөрийн хээг бүтээ",
    conceptStarter: "Нэг жижиг дүрс постерын захаас төв рүү өсөж, гарчгийг хүрээлж байгаагаар төсөөл.",
    palette: [{ name: "Гүн цэнхэр", hex: "#1E3A8A" }, { name: "Цасан цагаан", hex: "#F8FAFC" }, { name: "Оюу ногоон", hex: "#2DD4BF" }],
    requirements: ["Нэг суурь дүрсийг дор хаяж гурван удаа давт.", "Хээний завсар гарчигт зориулсан цэвэр зай үлдээ.", "Бодит уламжлалт тэмдгийн утгыг таамаглан тайлбарлахгүй."],
  },
  {
    id: "environment-refill", category: "environment", title: "Дахин ашиглах сав",
    client: "«Дахин дүүргэ» ногоон клуб",
    audience: "Сургуульдаа усны сав авч явдаг эсвэл авч явахыг хүссэн сурагчид",
    goal: "Өөрийн цэвэр савыг авч явах, дахин ашиглах дадлыг сануулах.",
    headline: "Саваа марталгүй аваарай",
    body: "Нэг савыг олон өдөр ашиглаж болно. Цэвэрлэж бэлдээд, цүнхэндээ хийхээ санаарай.",
    callToAction: "Саваа бэлд. Дахин ашигла.",
    conceptStarter: "Нэг савны дүрсийг давталтын сумтай нэгтгэж, энгийн тэмдэг бүтээ.",
    palette: [{ name: "Гүн оюу", hex: "#134E4A" }, { name: "Усны цайвар", hex: "#F0FDFA" }, { name: "Тэнгэрийн цэнхэр", hex: "#38BDF8" }],
    requirements: ["Сав болон дахин ашиглах санааг хамтад нь харуул.", "Тоон хэмнэлт, баталгаагүй байгаль орчны тоо баримт нэмэхгүй."],
  },
  {
    id: "environment-paper-sort", category: "environment", title: "Цаасны дараагийн боломж",
    client: "«Цаасны аялал» ангийн төсөл",
    audience: "Ангийнхаа цаас цуглуулах буланг ашиглах сурагчид",
    goal: "Цэвэр, хуурай цаасыг тусад нь цуглуулах үйлдлийг ойлгомжтой тайлбарлах.",
    headline: "Цаасаа зөв буланд хийгээрэй",
    body: "Цэвэр, хуурай цаасыг тусад нь цуглуулъя. Хайрцгийн шошгыг эхлээд уншаарай.",
    callToAction: "Шошгыг хар. Цаасаа ялга.",
    conceptStarter: "Нэг цаасан хуудас сумны дагуу тэмдэгтэй хайрцагт очих замыг зур.",
    palette: [{ name: "Ойн гүн", hex: "#14532D" }, { name: "Навчны цайвар", hex: "#F0FDF4" }, { name: "Шар ногоон", hex: "#BEF264" }],
    requirements: ["«Цэвэр, хуурай цаас» гэсэн үгийг заавал оруул.", "Хайрцгийн зориулалтыг зөвхөн өнгөөр бус үг, дүрсээр ялга."],
  },
  {
    id: "environment-repair", category: "environment", title: "Дахиад хэрэглэж болох уу?",
    client: "«Шинэ боломж» бүтээлч урлан",
    audience: "Хуучин дэвтэр, цаасан хайрцгаа дахин хэрэглэх сурагчид",
    goal: "Шинэ зүйл авахаасаа өмнө байгаа материалаа бүтээлчээр ашиглах санаа өгөх.",
    headline: "Хуучин хайрцаг. Шинэ санаа.",
    body: "Цэвэр цаасан хайрцгаа харандааны сав, жижиг хадгалах хайрцаг болгоё. Байгаа материалаасаа эхлээрэй.",
    callToAction: "Нэг хайрцагт шинэ үүрэг өг",
    conceptStarter: "Нэг хайрцгийн өмнөх ба дараах дүрсийг нэг шугамаар холбо.",
    palette: [{ name: "Бор бэх", hex: "#431407" }, { name: "Картон шаргал", hex: "#FFF7ED" }, { name: "Дулаан улбар", hex: "#FB923C" }],
    requirements: ["Хайрцгийн өөрчлөлтийг хоёр энгийн дүрсээр харуул.", "Хурц багаж, цахилгаан хэрэгсэл засах заавар нэмэхгүй."],
  },
  {
    id: "environment-last-light", category: "environment", title: "Сүүлчийн шалгалт",
    client: "«Гэрэлтэй санаа» сурагчдын баг",
    audience: "Хичээлийн өрөөнөөс хамгийн сүүлд гарч буй сурагчид",
    goal: "Өрөөг орхихдоо шаардлагагүй гэрэл асаалттай үлдсэн эсэхийг анзаарах дадал өгөх.",
    headline: "Гарахаасаа өмнө нэг хар",
    body: "Өрөөнд хүн үлдсэн эсэхийг шалга. Шаардлагагүй гэрлийг унтраахдаа сургуулийн дүрмээ дагаарай.",
    callToAction: "Гэрлээ шалгаад гаръя",
    conceptStarter: "Хаалганы завсрын гэрлийг асуултын тэмдэгтэй хослуулж санаа гарга.",
    palette: [{ name: "Шөнийн хөх", hex: "#0F172A" }, { name: "Сарны цагаан", hex: "#F8FAFC" }, { name: "Гэрлийн шар", hex: "#FDE047" }],
    requirements: ["Гарах хаалга эсвэл гэрлийн унтраалгыг танигдахуйц дүрсэл.", "Аюулгүй байдлын болон нийтийн коридорын гэрлийг унтраахыг бүү уриал."],
  },
  {
    id: "sport-team-relay", category: "sport", title: "Хамтын буухиа",
    client: "«Нэг баг» спортын клуб",
    audience: "Ур чадварын түвшин харгалзахгүйгээр багаар тоглох сурагчид",
    goal: "Хурднаас илүү хамтын ажиллагааг чухалчилсан буухианд оролцох хүсэл төрүүлэх.",
    headline: "Барианд хамтдаа хүрье",
    body: "Багийнхаа хүн бүрийг дэмж. Өөрт тохирох хурдаар оролцож, ээлжээ найздаа дамжуулаарай.",
    callToAction: "Багаа бүрдүүл. Бие биеэ дэмж.",
    conceptStarter: "Дамжуулж буй буухианы савхыг хүмүүсийг холбох нэг тасралтгүй шугам болго.",
    palette: [{ name: "Гүн хөх", hex: "#172554" }, { name: "Тэнгэрийн цайвар", hex: "#EFF6FF" }, { name: "Идэвхтэй улбар", hex: "#F97316" }],
    requirements: ["Ганц ялагч бус багийн хамтын хөдөлгөөнийг харуул.", "«Өөрт тохирох хурдаар» гэдэг санааг бичвэрт хадгал."],
  },
  {
    id: "sport-chess-first", category: "sport", title: "Шатрын анхны нүүдэл",
    client: "«Дараагийн нүүдэл» шатрын клуб",
    audience: "Шатрыг анх сурах эсвэл найзтайгаа тоглох сурагчид",
    goal: "Анхлан суралцагчдад нээлттэй, тайван шатрын уулзалтыг танилцуулах.",
    headline: "Эхний нүүдлээ хамт хийе",
    body: "Дүрмээ хамт сурч, ээлжлэн нүүдэл хийнэ. Өмнө нь тоглож байгаагүй ч оролцож болно.",
    callToAction: "Шатартай танилцаарай",
    conceptStarter: "Нэг хүүгийн өмнөх нээлттэй замаар боломж, эхлэлийг дүрсэл.",
    palette: [{ name: "Нүүрсэн хар", hex: "#18181B" }, { name: "Дулаан цагаан", hex: "#FAFAF9" }, { name: "Зөөлөн нил", hex: "#C4B5FD" }],
    requirements: ["Шатрын хөлгийн хэсэг болон нэг дүрсийг ашигла.", "Тэмцээний түрүү, шагналын оронд сурах боломжийг онцол."],
  },
  {
    id: "sport-walk-together", category: "sport", title: "Алхаж ярилцъя",
    client: "«Хамт алхъя» сурагчдын клуб",
    audience: "Завсарлагаар найзтайгаа тайван алхах сонирхолтой сурагчид",
    goal: "Хүртээмжтэй, тайван хамтын хөдөлгөөнд оролцох нэг урилга бүтээх.",
    headline: "Алхам бүрд шинэ яриа",
    body: "Зөвшөөрөгдсөн замаар найзтайгаа тайван алхъя. Өөрт тухтай хурдаа сонгоод, бусдын зайг хүндэтгэе.",
    callToAction: "Найзаа уриад хамт алхъя",
    conceptStarter: "Хөлийн мөрийг ярианы бөмбөлөгтэй хослуулж, нэг зөөлөн зам үүсгэ.",
    palette: [{ name: "Гүн ногоон", hex: "#064E3B" }, { name: "Гааны цайвар", hex: "#ECFDF5" }, { name: "Зөөлөн шар", hex: "#FCD34D" }],
    requirements: ["Хугацаа, хурдны өрсөлдөөнгүй тайван хөдөлгөөнийг дүрсэл.", "Эрүүл мэндийн үр дүн, жин хасах амлалт нэмэхгүй."],
  },
  {
    id: "sport-fair-play", category: "sport", title: "Талбайн хүндлэл",
    client: "«Зөв тоглолт» сургуулийн спортын баг",
    audience: "Сургуулийн багийн тоглоомд оролцож, үзэж буй сурагчид",
    goal: "Тоглолтын үед өрсөлдөгчөө хүндэтгэх нэг тодорхой үйлдлийг сануулах.",
    headline: "Сайн тоглолт хүндлэлээс эхэлнэ",
    body: "Дүрмээ дага. Бусдын оролдлогыг үнэл. Тоглолтын дараа бие биедээ талархаарай.",
    callToAction: "Тогло. Дэмж. Таларх.",
    conceptStarter: "Хоёр багийн өөр өнгийн гар нэг бөмбөгийг хүрээлэн дэмжиж байгаагаар дүрсэл.",
    palette: [{ name: "Бэхэн нил", hex: "#312E81" }, { name: "Цэлмэг цагаан", hex: "#F8FAFC" }, { name: "Оюу цэнхэр", hex: "#22D3EE" }],
    requirements: ["Хоёр талд ижил хэмжээ, ижил харааны ач холбогдол өг.", "«Тогло. Дэмж. Таларх.» гэсэн гурван үйлдлийг ялгаж байрлуул."],
  },
  {
    id: "music-desk-rhythm", category: "music", title: "Энгийн хэмнэлийн урлан",
    client: "«Тог тог» хөгжмийн дугуйлан",
    audience: "Хөгжмийн зэмсэг тоглодоггүй ч хэмнэл турших хүсэлтэй сурагчид",
    goal: "Энгийн алга ташилтаар хамтын хэмнэл бүтээх урланд уриалах.",
    headline: "Хэмнэл чиний алган дээр",
    body: "Алга ташилт, завсарлага, давталт. Гурван энгийн санаагаар хамтын хэмнэл бүтээе.",
    callToAction: "Нэг хэмнэлээ авчраарай",
    conceptStarter: "Алга ташилтын чимээг том, жижиг тойрог болон сул зайгаар дүрсэл.",
    palette: [{ name: "Гүн хүрэн", hex: "#450A0A" }, { name: "Дулаан цайвар", hex: "#FFF7ED" }, { name: "Хэмнэлийн улбар", hex: "#FB923C" }],
    requirements: ["Давталт болон завсарлагыг дүрсний зайгаар харуул.", "Бэлэн дууны үг, нот хуулалгүй өөрийн хэмнэлийг дүрсэл."],
  },
  {
    id: "music-own-stage", category: "music", title: "Өөрийн дуу хоолой",
    client: "«Жижиг тайз» сурагчдын урлан",
    audience: "Өөрийн зохиосон дуу, шүлэг, аялгууг хуваалцах сурагчид",
    goal: "Анхны өөрийн бүтээлээ тайван, дэмжсэн орчинд хуваалцах хүсэл төрүүлэх.",
    headline: "Жижиг тайз. Чиний бүтээл.",
    body: "Өөрийн шүлэг, дуу эсвэл аялгууны нэг хэсгээ бэлд. Анх удаа оролцож байгаа бол бүр ч тавтай морил.",
    callToAction: "Өөрийн бүтээлээ сонсгоё",
    conceptStarter: "Жижиг микрофоны сүүдэр олон өөр дүрс болж хувирах байдлаар дуу хоолойн ялгааг харуул.",
    palette: [{ name: "Шөнийн нил", hex: "#2E1065" }, { name: "Ягаан цайвар", hex: "#FDF2F8" }, { name: "Тайзны ягаан", hex: "#F472B6" }],
    requirements: ["Бодит дуучин, хамтлагийн нэр, дүр төрх ашиглахгүй.", "Өөрийн бүтээл болон анх оролцох боломжийг тодотго."],
  },
  {
    id: "music-listening-map", category: "music", title: "Орчны дууны зураг",
    client: "«Сонсох зураг» бүтээлч баг",
    audience: "Орчноо ажиглаж, сонссоноо зургаар тэмдэглэх сурагчид",
    goal: "Өдөр тутмын дуу авиаг анзаарч, хэлбэр ба шугамаар дүрслэхэд уриалах.",
    headline: "Сонссоноо зурж үзье",
    body: "Навчны сэрчигнээн, харандааны чимээ, борооны тогшилт. Нэг дууг сонгоод ямар дүрстэйг төсөөл.",
    callToAction: "Нэг чимээг дүрс болго",
    conceptStarter: "Гурван төрлийн шугамаар зөөлөн, тасалдсан, давтагдсан дууг ялгаж зур.",
    palette: [{ name: "Хөх саарал", hex: "#1E293B" }, { name: "Манангийн цайвар", hex: "#F1F5F9" }, { name: "Цайвар цэнхэр", hex: "#7DD3FC" }],
    requirements: ["Ядаж хоёр төрлийн шугам эсвэл хэлбэрээр авианы ялгааг үзүүл.", "Бусдын яриаг бичих, хувийн дуу бичлэг цуглуулахыг шаардахгүй."],
  },
  {
    id: "music-choir-invite", category: "music", title: "Хамтын аялгуу",
    client: "«Нэг аялгуу» сурагчдын найрал",
    audience: "Багаар дуулахыг туршиж үзэх сурагчид",
    goal: "Өөр өөр дуу хоолой хамтдаа бүтээл болдгийг харуулж, танилцах уулзалтад уриалах.",
    headline: "Дуу хоолой бүрт орон зай бий",
    body: "Өөр өөр хоолой нэг аялгуунд нэгдэнэ. Сонсож, давтаж, хамтдаа суралцъя.",
    callToAction: "Хамтын аялгуунд нэгдээрэй",
    conceptStarter: "Өөр хэмжээтэй долгионууд нэг өргөн тууз болж нийлэх зохиомж турш.",
    palette: [{ name: "Гүн ягаан", hex: "#500724" }, { name: "Сарнайн цайвар", hex: "#FFF1F2" }, { name: "Алтан шар", hex: "#FBBF24" }],
    requirements: ["Дор хаяж гурван өөр хэлбэрийг нэг зохиомжид нэгтгэ.", "Бэлэн дууны үг, алдартай аяны нот ашиглахгүй."],
  },
  {
    id: "technology-robot-maze", category: "technology", title: "Роботын замыг бодъё",
    client: "«Алхамт» технологийн клуб",
    audience: "Дараалал, логик сэтгэлгээг тоглоомоор турших сурагчид",
    goal: "Энгийн суман заавраар цаасан роботыг төөрдөг замаар чиглүүлэх сорилд уриалах.",
    headline: "Нэг сум. Дараагийн алхам.",
    body: "Урагшил, эргэ, дахин турш. Цаасан роботдоо хүрэх замыг нь зааж өгье. Төхөөрөмж шаардахгүй.",
    callToAction: "Роботынхоо замыг төлөвлө",
    conceptStarter: "Өөрийн зохиосон робот болон гурван сумтай богино замыг гол дүрс болго.",
    palette: [{ name: "Шөнийн хөх", hex: "#0F172A" }, { name: "Мөсөн цайвар", hex: "#ECFEFF" }, { name: "Цахилгаан оюу", hex: "#22D3EE" }],
    requirements: ["Бодит бүтээгдэхүүний дүр бус өөрийн энгийн роботыг зохио.", "Сумны чиглэлүүд эхлэлээс төгсгөл рүү ойлгомжтой дараалалтай байг."],
  },
  {
    id: "technology-pixel-story", category: "technology", title: "Жижиг нүдний том санаа",
    client: "«Нүдэн зураг» дижитал урлан",
    audience: "Дижитал зураг анхлан турших сурагчид",
    goal: "Цөөн дөрвөлжин нүдээр танигдахуйц өөрийн дүр бүтээхэд уриалах.",
    headline: "Цөөн нүдээр ихийг өгүүл",
    body: "Энгийн дөрвөлжин тор сонгоод өөрийн жижиг дүрийг бүтээ. Цаас, харандаагаар ч туршиж болно.",
    callToAction: "Өөрийн нүдэн дүрийг зур",
    conceptStarter: "Нэг дөрвөлжин нүд томорч, энгийн дүрийн хэсэг болж байгаагаар харуул.",
    palette: [{ name: "Бэхэн хөх", hex: "#172554" }, { name: "Хүйтэн цагаан", hex: "#F8FAFC" }, { name: "Шохойн ногоон", hex: "#A3E635" }],
    requirements: ["Гол дүрсээ дөрвөлжин тор дээр байгуул.", "Танил тоглоомын баатар, лого хуулалгүй өөрийн дүр зохио."],
  },
  {
    id: "technology-code-pattern", category: "technology", title: "Давталтын бүтээл",
    client: "«Дүрсийн код» бүтээлч дугуйлан",
    audience: "Код бичиж үзээгүй ч дүрс, дараалал сонирхдог сурагчид",
    goal: "Нэг дүрмийг давтан хэрэглэж зураг бүтээх санааг хялбар ойлгуулах.",
    headline: "Нэг дүрэм. Олон шинэ дүрс.",
    body: "Дүрсээ зур, бага зэрэг эргүүл, дахин давт. Энгийн дараалал ямар зураг бүтээхийг туршаарай.",
    callToAction: "Дүрмээ сонгоод давтаж үз",
    conceptStarter: "Ижил дүрс алхам бүрд бага зэрэг эргэж, бүхэлдээ том хэлбэр үүсгэх зохиомж хий.",
    palette: [{ name: "Гүн нил", hex: "#3B0764" }, { name: "Сүүн нил", hex: "#FAF5FF" }, { name: "Гэгээн оюу", hex: "#5EEAD4" }],
    requirements: ["«Зур → эргүүл → давт» гэсэн гурван алхмыг харуул.", "Дүрсний өөрчлөлт бүх алхамд нэг дүрэмтэй байг."],
  },
  {
    id: "technology-private-key", category: "technology", title: "Нууц үг бол хувийн түлхүүр",
    client: "«Ухаалаг хэрэглээ» сурагчдын баг",
    audience: "Сургуулийн цахим хэрэгсэл ашигладаг сурагчид",
    goal: "Нууц үгээ бусадтай хуваалцахгүй байх нэг ойлгомжтой санамж бүтээх.",
    headline: "Нууц үгээ өөртөө хадгал",
    body: "Нууц үгээ чат, постер, хамтын файлд бичихгүй. Тусламж хэрэгтэй бол багш эсвэл итгэдэг том хүнээс асуугаарай.",
    callToAction: "Хувийн түлхүүрээ бүү хуваалц",
    conceptStarter: "Түлхүүрийн дүрсийг далдалсан цэгүүдтэй холбож, хувийн орон зайн санаа гарга.",
    palette: [{ name: "Хөх бэх", hex: "#1E3A8A" }, { name: "Цэлмэг цайвар", hex: "#EFF6FF" }, { name: "Дохионы шар", hex: "#FACC15" }],
    requirements: ["Жинхэнэ нууц үг, хэрэглэгчийн нэр, QR код огт оруулахгүй.", "Айлгах дүрслэлээс илүү ойлгомжтой санамж хэрэглэ."],
  },
];

export const POSTER_TEMPLATE_COUNT = TEMPLATES.length;

function buildBrief(template: PosterTemplate, level: BriefLevel, format: BriefFormat): PosterBrief {
  const category = BRIEF_CATEGORIES.find(item => item.id === template.category)!;
  const isBeginner = level.id === "beginner";
  const isAdvanced = level.id === "advanced";
  const budgets = isBeginner ? [4, 6, 15, 5] : isAdvanced ? [8, 12, 30, 10] : [5, 10, 25, 5];
  const challenge = isBeginner
    ? "Нэг гол дүрс, нэг том гарчиг ашигла. Гарчиг → тайлбар → уриалга гэсэн дарааллаар уншигдахаар байрлуул."
    : isAdvanced
      ? "Гурван өөр ноорог гарга. Хоёр санааг нэг дүрсэнд нэгтгэсэн өөрийн дүрслэл бүтээж, хамгийн ойлгомжтой хувилбарыг сонго. Сонголтоо хоёр өгүүлбэрээр тайлбарла."
      : "Хоёр өөр ноорог гаргаж харьцуул. Дүрс, гарчиг, хоосон зайн харьцааг өөрчилж, санааг илүү хурдан ойлгуулах хувилбарыг сонго.";

  return {
    id: `${template.id}:${level.id}:${format.id}`,
    templateId: template.id,
    category: { ...category }, level: { ...level }, format: { ...format },
    title: template.title, client: template.client, audience: template.audience,
    goal: template.goal, headline: template.headline, body: template.body,
    callToAction: template.callToAction, conceptStarter: template.conceptStarter,
    palette: template.palette.map(color => ({ ...color })),
    requirements: [
      ...template.requirements,
      "Өгсөн гарчиг, тайлбар, уриалгыг ашигла. Зохиомол огноо, хаяг, холбоос нэмэх шаардлагагүй.",
      isBeginner ? "Нэг гол дүрс, ихдээ хоёр төрлийн үсгийн хэв ашигла." : "Ихдээ хоёр төрлийн үсгийн хэв ашиглаж, мэдээллийн гурван түвшинг ялга.",
      `${format.dimensions} хэмжээтэй ажлын талбар сонго. ${format.delivery}`,
    ],
    challenge,
    steps: [
      { title: "Даалгавраа ойлго", minutes: budgets[0], description: "Хэнд зориулж, ямар үйлдэлд уриалж байгааг унш. Гол санаагаа нэг өгүүлбэрээр тэмдэглэ." },
      { title: isBeginner ? "Ноорог зур" : "Нооргуудаа харьцуул", minutes: budgets[1], description: isBeginner ? "Цаасан дээр гарчиг, гол дүрс, уриалгын байрлалыг жижигхэн зур." : isAdvanced ? "Гурван өөр зохиомж зур. Гол санаа нь хамгийн хурдан танигдах нооргийг сонго." : "Хоёр өөр зохиомж зур. Гарчиг, дүрсний хэмжээг сольж харьцуулан нэгийг сонго." },
      { title: "Постероо бүтээ", minutes: budgets[2], description: `Сонгосон нооргоо ${format.dimensions} талбарт боловсруул. Өнгөний санал болон өөрийн зурсан дүрсээ ашиглаж, бичвэрт цэвэр зай үлдээ.` },
      { title: "Шалгаад гарга", minutes: budgets[3], description: isAdvanced ? "Жижигрүүлж болон саарал өнгөөр хараад мэдээллийн дарааллыг шалга. Алдаагаа засаж, сонголтоо хоёр өгүүлбэрээр тайлбарлаад файлаар гарга." : "Жижигрүүлж хараад гарчиг, уриалга уншигдах эсэхийг шалга. Үг үсгийн алдаагаа засаж, заасан төрлийн файлаар гарга." },
    ],
    checklist: [
      "Юуны тухай, хэнд зориулсныг эхний харцаар ойлгож байна уу?",
      "Гарчиг хамгийн түрүүнд, уриалга дараа нь амархан олдож байна уу?",
      "Бичвэр арын өнгөнөөсөө тод ялгарч, жижигрүүлсэн үед уншигдаж байна уу?",
      "Монгол үсэг, зөв бичих дүрэм, үг хоорондын зайгаа шалгасан уу?",
      `Файлын хэмжээ ${format.dimensions} мөн үү? Зөв төрлийн файлаар гаргасан уу?`,
      ...(isAdvanced ? ["Өөрийн дүрслэл санаатайгаа холбоотой юу? Сонголтоо хоёр өгүүлбэрээр тайлбарласан уу?"] : []),
    ],
  };
}

/** Selects once, without I/O. "all" draws from all categories. */
export function generatePosterBrief(
  options: BriefOptions,
  previousTemplateId?: string,
  rng: () => number = Math.random,
): PosterBrief {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Постерын ангилал, түвшин, хэмжээг сонгоно уу.");
  }
  if (options.category !== "all" && !BRIEF_CATEGORIES.some(item => item.id === options.category)) {
    throw new RangeError("Постерын ангилал танигдсангүй.");
  }
  const level = BRIEF_LEVELS.find(item => item.id === options.level);
  const format = BRIEF_FORMATS.find(item => item.id === options.format);
  if (!level || !format) throw new RangeError("Постерын түвшин эсвэл хэмжээ танигдсангүй.");
  if (previousTemplateId !== undefined && typeof previousTemplateId !== "string") {
    throw new TypeError("Өмнөх даалгаврын дугаар буруу байна.");
  }
  if (typeof rng !== "function") throw new TypeError("Сонголтын функц буруу байна.");

  const candidates = TEMPLATES.filter(template =>
    (options.category === "all" || template.category === options.category) && template.id !== previousTemplateId,
  );
  const random = rng();
  if (!Number.isFinite(random) || random < 0 || random >= 1) {
    throw new RangeError("Сонголтын утга 0-ээс 1-ийн хооронд байх ёстой.");
  }
  return buildBrief(candidates[Math.floor(random * candidates.length)], level, format);
}

/** Complete plain text for copying or downloading; no HTML or external links. */
export function formatBriefText(brief: PosterBrief): string {
  return [
    `ПОСТЕРЫН ДААЛГАВАР — ${brief.title}`,
    "Сургалтын зориулалттай зохиомол захиалга.",
    `Ангилал: ${brief.category.label}`,
    `Түвшин: ${brief.level.label} · ${brief.level.minutes} минут`,
    `Хэмжээ: ${brief.format.label} · ${brief.format.dimensions}`,
    `Гарах файл: ${brief.format.delivery}`,
    "", `Захиалагч: ${brief.client}`, `Хэнд: ${brief.audience}`, `Зорилго: ${brief.goal}`,
    "", "ПОСТЕРТ ОРУУЛАХ БИЧВЭР", `Гарчиг: ${brief.headline}`, `Тайлбар: ${brief.body}`, `Уриалга: ${brief.callToAction}`,
    "", `Эхлэх санаа: ${brief.conceptStarter}`, `Сорилт: ${brief.challenge}`,
    "", "ӨНГӨНИЙ САНАЛ", ...brief.palette.map(color => `• ${color.name} — ${color.hex}`),
    "", "ШААРДЛАГА", ...brief.requirements.map((requirement, index) => `${index + 1}. ${requirement}`),
    "", "АЖЛЫН ДАРААЛАЛ", ...brief.steps.map((step, index) => `${index + 1}. ${step.title} · ${step.minutes} минут\n   ${step.description}`),
    "", "ДУУСААД ШАЛГАХ", ...brief.checklist.map(item => `☐ ${item}`),
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown, maxLength = 1200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function matchesMetadata(value: unknown, expected: object): boolean {
  if (!isRecord(value)) return false;
  const entries = Object.entries(expected);
  return Object.keys(value).length === entries.length && entries.every(([key, item]) => value[key] === item);
}

/** Validates saved JSON before rendering it. Old incompatible snapshots are ignored. */
export function isPosterBrief(value: unknown): value is PosterBrief {
  try {
    if (!isRecord(value) || !isText(value.templateId, 100)) return false;
    const allowedKeys = ["id", "templateId", "category", "level", "format", "title", "client", "audience", "goal", "headline", "body", "callToAction", "conceptStarter", "palette", "requirements", "challenge", "steps", "checklist", "createdAt"];
    if (Object.keys(value).some(key => !allowedKeys.includes(key))) return false;
    const template = TEMPLATES.find(item => item.id === value.templateId);
    if (!template || !isRecord(value.level) || !isRecord(value.format)) return false;
    const category = BRIEF_CATEGORIES.find(item => item.id === template.category)!;
    const levelId = value.level.id;
    const formatId = value.format.id;
    const level = BRIEF_LEVELS.find(item => item.id === levelId);
    const format = BRIEF_FORMATS.find(item => item.id === formatId);
    if (!level || !format || !matchesMetadata(value.category, category) || !matchesMetadata(value.level, level) || !matchesMetadata(value.format, format)) return false;
    if (value.id !== `${template.id}:${level.id}:${format.id}`) return false;
    const textFields = ["title", "client", "audience", "goal", "headline", "body", "callToAction", "conceptStarter", "challenge"];
    if (!textFields.every(key => isText(value[key]))) return false;
    if (!Array.isArray(value.palette) || value.palette.length !== 3 || !Array.from(value.palette).every(color =>
      isRecord(color) && Object.keys(color).length === 2 && isText(color.name, 100) && typeof color.hex === "string" && /^#[0-9a-fA-F]{6}$/.test(color.hex),
    )) return false;
    if (![value.requirements, value.checklist].every(items => Array.isArray(items) && items.length >= 2 && items.length <= 12 && Array.from(items).every(item => isText(item)))) return false;
    if (!Array.isArray(value.steps) || value.steps.length < 3 || value.steps.length > 5 || !Array.from(value.steps).every(step =>
      isRecord(step) && Object.keys(step).length === 3 && isText(step.title, 100) && isText(step.description) && typeof step.minutes === "number" && Number.isInteger(step.minutes) && step.minutes > 0,
    )) return false;
    if (value.steps.reduce((minutes, step) => minutes + step.minutes, 0) !== level.minutes) return false;
    if (value.createdAt !== undefined && (typeof value.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) || new Date(value.createdAt).toISOString() !== value.createdAt)) return false;
    return true;
  } catch {
    // Treat unexpected values (including throwing getters) as corrupt storage.
    return false;
  }
}
