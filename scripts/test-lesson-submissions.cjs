// Isolated lesson regression tests. All storage, notification, and user mutations are in-memory mocks.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const ROOT = path.join(__dirname, "..");
function load(file, mocks) {
  const code = ts.transpileModule(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) => {
      const key = id.startsWith(".") ? path.basename(id) : id;
      if (!(key in mocks)) throw new Error(`Unexpected dependency: ${key}`);
      return mocks[key];
    },
    module,
    module.exports,
  );
  return module.exports;
}
const row = {
  id: "sub-test",
  lesson_id: "lesson-test",
  student_email: "student@example.org",
  student_name: "Student",
  file_url: "https://cdn.example.org/old.png",
  file_urls: ["https://cdn.example.org/old.png"],
  submitted_at: "2026-01-01T00:00:00Z",
  score: 86,
  feedback: "Teacher reviewed",
  reward_xp: 120,
  graded_at: "2026-01-02T00:00:00Z",
};
function memoryDB(initial = [], readError = null) {
  let rows = initial.map((value) => ({ ...value }));
  const writes = [];
  const api = {
    from(table) {
      assert.equal(table, "lesson_submissions");
      const predicates = [];
      let update;
      let insert;
      const query = {
        select() {
          return query;
        },
        abortSignal() {
          return query;
        },
        eq(key, value) {
          predicates.push((item) => item[key] === value);
          return query;
        },
        is(key, value) {
          predicates.push((item) => (item[key] ?? null) === value);
          return query;
        },
        update(value) {
          update = value;
          return query;
        },
        insert(value) {
          insert = value;
          return query;
        },
        async maybeSingle() {
          if (!update && !insert && readError)
            return { data: null, error: readError };
          if (insert) {
            writes.push({ insert });
            const value = {
              ...insert[0],
              submitted_at: "2026-01-03T00:00:00Z",
              reward_xp: null,
            };
            rows.push(value);
            return { data: { ...value }, error: null };
          }
          const found = rows.find((value) =>
            predicates.every((predicate) => predicate(value)),
          );
          if (!found) return { data: null, error: null };
          if (update) {
            writes.push({ update });
            Object.assign(found, update);
          }
          return { data: { ...found }, error: null };
        },
        single() {
          return query.maybeSingle();
        },
      };
      return query;
    },
  };
  return { api, writes, rows: () => rows };
}

test("quiz-only submission preserves attachments, teacher grade, and previously earned XP without a write", async () => {
  const db = memoryDB([row]);
  const lessons = load("lib/lessons.ts", { supabase: { supabase: db.api } });
  const saved = await lessons.submitToLesson(
    row.lesson_id,
    row.student_email,
    row.student_name,
  );
  assert.deepEqual(saved.fileUrls, row.file_urls);
  assert.equal(saved.score, 86);
  assert.equal(saved.feedback, row.feedback);
  assert.equal(saved.rewardXP, 120);
  assert.equal(db.writes.length, 0);
});

test("repeating an identical file is idempotent; replacing a file keeps earned XP and requests a fresh grade", async () => {
  const db = memoryDB([row]);
  const lessons = load("lib/lessons.ts", { supabase: { supabase: db.api } });
  await lessons.submitToLesson(
    row.lesson_id,
    row.student_email,
    row.student_name,
    row.file_urls,
  );
  assert.equal(db.writes.length, 0);
  const saved = await lessons.submitToLesson(
    row.lesson_id,
    row.student_email,
    row.student_name,
    ["https://cdn.example.org/new.png"],
  );
  assert.deepEqual(saved.fileUrls, ["https://cdn.example.org/new.png"]);
  assert.equal(saved.rewardXP, 120);
  assert.equal(saved.score, null);
  assert.equal(saved.gradedAt, null);
  assert.equal(Object.hasOwn(db.writes[0].update, "reward_xp"), false);
});

test("submission read failures abort without inserting or overwriting work", async () => {
  const db = memoryDB([], { message: "Temporary read failure" });
  const lessons = load("lib/lessons.ts", { supabase: { supabase: db.api } });
  await assert.rejects(
    lessons.submitToLesson(row.lesson_id, row.student_email, row.student_name),
  );
  assert.equal(db.writes.length, 0);
});

test("conditional reward claim permits only one concurrent XP increase", async () => {
  const db = memoryDB([{ ...row, reward_xp: 0 }]);
  const lessons = load("lib/lessons.ts", { supabase: { supabase: db.api } });
  const expected = { rewardXP: 0, submittedAt: row.submitted_at };
  const results = await Promise.all([
    lessons.gradeSubmission(row.lesson_id, row.id, 100, 100, "First", expected),
    lessons.gradeSubmission(
      row.lesson_id,
      row.id,
      100,
      100,
      "Duplicate",
      expected,
    ),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(db.writes.length, 1);
  assert.equal(db.rows()[0].reward_xp, 100);
});

const baselineLesson = {
  id: "lesson-test",
  title: "Lesson",
  published: true,
  targetGrades: [],
  questions: [
    { options: ["a", "b"], correctAnswer: 0 },
    { options: ["a", "b"], correctAnswer: 1 },
  ],
};
function fixture(options = {}) {
  let submission = {
    id: row.id,
    lessonId: row.lesson_id,
    studentEmail: row.student_email,
    studentName: row.student_name,
    submittedAt: row.submitted_at,
    ...options.submission,
  };
  let submitCalls = 0;
  let gradeCalls = 0;
  const experience = [];
  const notifications = [];
  const mocks = {
    "next/server": {
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    session: {
      getSessionFromCookies: async () => ({
        email: row.student_email,
        role: options.role || "student",
        name: "Student",
      }),
    },
    users: {
      getUser: async () => ({ grade: options.grade || "10" }),
      addExperience: async (email, points) => {
        experience.push(points);
        return options.xpFailure ? null : { email, experience: points };
      },
    },
    notifications: {
      addNotification: async (...args) => {
        notifications.push(args);
      },
    },
    supabase: {
      supabase: {
        from: () => {
          const query = {
            select: () => query,
            eq: () => query,
            abortSignal: () => query,
            maybeSingle: async () => ({ data: null }),
          };
          return query;
        },
      },
    },
    lessons: {
      getLesson: async () =>
        options.missing
          ? null
          : { ...baselineLesson, ...options.lesson, submissions: [submission] },
      submitToLesson: async (...args) => {
        submitCalls++;
        if (args[3]) submission = { ...submission, fileUrls: args[3] };
        return { ...submission };
      },
      gradeSubmission: async (
        lessonId,
        id,
        score,
        rewardXP,
        feedback,
        expected,
      ) => {
        gradeCalls++;
        assert.equal(expected.rewardXP, submission.rewardXP ?? null);
        assert.equal(expected.submittedAt, submission.submittedAt);
        if (options.conflict) return null;
        submission = {
          ...submission,
          rewardXP,
          ...(expected.preserveGrade ? {} : { score, feedback }),
        };
        return { ...submission };
      },
    },
  };
  const file = options.role === "teacher" ? "grade" : "submit";
  const route = load(`app/api/lessons/[id]/${file}/route.ts`, mocks);
  return {
    async post(body) {
      return route.POST(
        new Request("https://test.invalid/submit", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: baselineLesson.id }) },
      );
    },
    counts: () => ({ submitCalls, gradeCalls }),
    experience,
    notifications,
    current: () => submission,
  };
}

test("missing, unpublished, wrong-grade and invalid/empty submissions never write or award XP", async () => {
  for (const [options, body, status] of [
    [{}, {}, 400],
    [{}, { fileUrls: [] }, 400],
    [{}, { answers: [] }, 400],
    [{}, { answers: [0] }, 400],
    [{}, { answers: [0, 2] }, 400],
    [{}, { answers: ["0", 1] }, 400],
    [{}, { fileUrls: ["javascript:alert(1)"] }, 400],
    [{ missing: true }, { answers: [0, 1] }, 404],
    [{ lesson: { published: false } }, { answers: [0, 1] }, 403],
    [{ lesson: { targetGrades: ["12"] } }, { answers: [0, 1] }, 403],
  ]) {
    const f = fixture(options);
    assert.equal((await f.post(body)).status, status);
    assert.equal(f.counts().submitCalls, 0);
    assert.equal(f.counts().gradeCalls, 0);
    assert.deepEqual(f.experience, []);
  }
});

test("quiz scoring is actual, rewards only improvement, and repeats cannot farm XP", async () => {
  const f = fixture();
  const first = await (await f.post({ answers: [0, 0] })).json();
  assert.equal(first.score, 50);
  assert.equal(first.rewardXP, 50);
  const repeated = await (await f.post({ answers: [0, 0] })).json();
  assert.equal(repeated.rewardXP, 0);
  const improved = await (await f.post({ answers: [0, 1] })).json();
  assert.equal(improved.score, 100);
  assert.equal(improved.rewardXP, 50);
  const lower = await (await f.post({ answers: [1, 0] })).json();
  assert.equal(lower.score, 0);
  assert.equal(lower.rewardXP, 0);
  await f.post({ answers: [0, 1] });
  assert.deepEqual(f.experience, [50, 50]);
  assert.equal(f.current().rewardXP, 100);
});

test("file acceptance is pending teacher review without fabricated score, XP or AI dependency", async () => {
  const f = fixture();
  const response = await f.post({
    fileUrls: ["https://cdn.example.org/new.png"],
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.score, undefined);
  assert.equal(body.rewardXP, undefined);
  assert.equal(f.counts().gradeCalls, 0);
  assert.deepEqual(f.experience, []);
  assert.match(body.message, /Багшийн үнэлгээг/);
});

test("quiz attempts retain existing file teacher assessment while returning actual quiz result", async () => {
  const f = fixture({
    submission: {
      fileUrls: row.file_urls,
      score: 86,
      feedback: row.feedback,
      rewardXP: 120,
    },
  });
  const body = await (await f.post({ answers: [0, 1] })).json();
  assert.equal(body.score, 100);
  assert.equal(body.submission.score, 86);
  assert.equal(body.submission.feedback, row.feedback);
  assert.deepEqual(body.submission.fileUrls, row.file_urls);
  assert.equal(body.rewardXP, 0);
  assert.deepEqual(f.experience, []);
});

test("concurrent claim conflict never awards XP and failed XP delivery releases the claim for retry", async () => {
  const conflict = fixture({ conflict: true });
  assert.equal((await conflict.post({ answers: [0, 1] })).status, 409);
  assert.deepEqual(conflict.experience, []);
  const failed = fixture({ xpFailure: true });
  assert.equal((await failed.post({ answers: [0, 1] })).status, 503);
  assert.equal(failed.current().rewardXP, 0);
  assert.equal(failed.counts().gradeCalls, 2);
  assert.equal(failed.notifications.length, 0);
});

test("lowering then restoring a teacher reward never re-awards earned XP", async () => {
  const f = fixture({ role: "teacher", submission: { rewardXP: 120 } });
  for (const rewardXP of [50, 120]) {
    const response = await f.post({
      submissionId: row.id,
      score: 85,
      rewardXP,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).rewardXP, 0);
  }
  assert.equal(f.current().rewardXP, 120);
  assert.deepEqual(f.experience, []);
});
