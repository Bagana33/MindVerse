// Create a "Fun Fact" lesson with provided questions
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function ensureAIUser() {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('email', 'ai-assistant')
    .single();

  if (!data) {
    console.log('Creating AI assistant user...');
    const { error } = await supabase
      .from('users')
      .insert([
        {
          email: 'ai-assistant',
          name: '🤖 AI Шүүмжлэгч',
          role: 'teacher',
          experience: 0,
        },
      ]);
    if (error) throw error;
  }
}

async function createFunFactLesson() {
  await ensureAIUser();

  const lessonId = makeId('lesson');
  const title = 'Fun Fact';
  const description = 'Психологи, дизайн, медиа хэрэглээтэй холбоотой сонирхолтой баримтуудыг асуулт хэлбэрээр.';

  const questions = [
    {
      question: 'Та улаантай шар өнгийг харвал тархинд яг юу болдог вэ?',
      options: ['Тайвширна', 'Өлсдөг', 'Уйтгарладаг', 'Ачаалал авдаг'],
      correctAnswer: 1,
      explanation: "🔥 Fun Fact: McDonald's улаан+шар өнгийг зориудаар хэрэглэдэг — тархи ‘HUNGRY MODE’-д ордог.",
    },
    {
      question: 'Хүн логог хараад хэдэн секундэд таньдгийг мэдэх үү?',
      options: ['1 секунд', '0.2 секунд', '5 секунд', '2 секунд'],
      correctAnswer: 1,
      explanation: '🔥 Fun Fact: Тархины таних систем Facebook Story-оос ч хурдан ажилладаг.',
    },
    {
      question: 'Сурталчилгааны постерийг хүн дундажаар хэдэн секунд хардаг вэ?',
      options: ['10 секунд', '5 секунд', '3 секунд', '1 секунд'],
      correctAnswer: 2,
      explanation: '🔥 Fun Fact: Хэрвээ постер 3 секундэд ойлгогдохгүй бол тархи “IGNORE MODE”-д орно.',
    },
    {
      question: 'Хэрэглэгч апп ойлгохгүй бол хэдэн секундэд устгадаг вэ?',
      options: ['20', '10', '5', '60'],
      correctAnswer: 1,
      explanation: '🔥 Fun Fact: Анхны туршлага 10 секундэд бүхнийг шийддэг.',
    },
    {
      question: 'Танд шоколад авах мэдрэмж төрүүлдэг гол хүчин зүйл нь?',
      options: ['Амт', 'Үнэ', 'Сав баглаа', 'Брэндийн түүх'],
      correctAnswer: 2,
      explanation: '🔥 Fun Fact: Хүн дэлгүүрт бүтээгдэхүүн сонгохдоо 5 секундэд шийддэг — бүхнийг box шийддэг.',
    },
    {
      question: 'Typography сайн таарсан ном унших ядаргааг хэдэн дахин багасгадаг вэ?',
      options: ['3', '2', '5', '10'],
      correctAnswer: 0,
      explanation: '🔥 Fun Fact: Vogue сэтгүүл үзэмжийнхээ ард тархины eye-tracking технологи хэрэглэдэг.',
    },
    {
      question: 'Pixar нэг дүрийн нүүрний хөдөлгөөнд хэдэн control point ашигладаг вэ?',
      options: ['500', '1000', '10,000+', '50'],
      correctAnswer: 2,
      explanation: '🔥 Fun Fact: Тиймээс Pixar-ын дүрүүдийн инээмсэглэл “амьд юм шиг”.',
    },
    {
      question: 'Хөдөлгөөнтэй контент статик зурганаас хэд дахин илүү анхаарал татдаг вэ?',
      options: ['2x', '3x', '5x', '10x'],
      correctAnswer: 2,
      explanation: '🔥 Fun Fact: Тиймээс TikTok видео feed дээр motion-гүй үзэгдэх магадлал маш бага.',
    },
    {
      question: 'IG пост дээр хэрэглэгч дундажаар хэдэн секунд зогсдог вэ?',
      options: ['0.5', '1.3', '3', '5'],
      correctAnswer: 1,
      explanation: '🔥 Fun Fact: Энэ 1.3 секундэд пост танд ялах уу, feed-д дарагдаад алга болох уу гэдэг шийдэгддэг.',
    },
    {
      question: 'Хүн зурагтай мэдээллийг текстээс хэд дахин илүү тогтоодог вэ?',
      options: ['2', '10', '30', '65% илүү тогтоодог'],
      correctAnswer: 3,
      explanation: undefined,
    },
  ];

  // Insert lesson
  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .insert([
      {
        id: lessonId,
        title,
        description,
        author_email: 'ai-assistant',
        author_name: '🤖 AI Шүүмжлэгч',
        published: true,
        target_grades: [],
      },
    ])
    .select()
    .single();

  if (lessonError) {
    console.error('Failed to create lesson:', lessonError);
    process.exit(1);
  }

  // Insert questions
  const qRows = questions.map((q, idx) => ({
    id: `${lessonId}-q${idx + 1}`,
    lesson_id: lessonId,
    question: q.question,
    options: q.options,
    correct_answer: q.correctAnswer,
    explanation: q.explanation || null,
    order_index: idx,
  }));

  const { error: qError } = await supabase.from('lesson_questions').insert(qRows);
  if (qError) {
    console.error('Failed to insert questions:', qError);
    process.exit(1);
  }

  console.log(`✔️ Created lesson '${title}' with ${questions.length} questions (id: ${lessonId})`);
}

createFunFactLesson().catch((e) => {
  console.error(e);
  process.exit(1);
});
