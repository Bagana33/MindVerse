// Run: node --test scripts/test-grade-nine.cjs
// Actual backend modules with synthetic rows and mocked dependencies only.
// No environment variables, network, database writes, or real accounts are used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(filename, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', code)(name => {
    if (!(name in mocks)) throw new Error(`Unmocked dependency forbidden: ${name}`);
    return mocks[name];
  }, module, module.exports, () => { throw new Error('Network forbidden in isolated tests'); });
  return module.exports;
}
const NextResponse = {
  json(value, init) {
    const response = Response.json(value, init);
    response.cookies = { set() {} };
    return response;
  },
};
const student = { email: 'ninth@example.test', name: 'Ninth Grade', role: 'student', grade: '9', experience: 90 };
const session = {
  getSessionFromCookies: async () => student,
  encodeSession: () => 'synthetic-token', COOKIE_NAME: 'review', SESSION_COOKIE_OPTIONS: {},
};

function leaderboardStore() {
  const rows = [student, { ...student, email: 'tenth@example.test', grade: '10', experience: 100 },
    { ...student, email: 'twelfth@example.test', grade: '12', experience: 120 },
    { ...student, email: 'outside@example.test', grade: '8', experience: 800 },
    { ...student, email: 'teacher@example.test', role: 'teacher', experience: 900 }];
  let queryCount = 0;
  const supabase = { from(table) {
    assert.equal(table, 'users'); queryCount++;
    const filters = []; let limit = Infinity;
    return {
      select() { return this; },
      eq(key, value) { filters.push(row => row[key] === value); return this; },
      in(key, values) { filters.push(row => values.includes(row[key])); return this; },
      order(key, options) { assert.equal(key, 'experience'); assert.equal(options.ascending, false); return this; },
      limit(value) { limit = value; return this; },
      abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this; },
      then(resolve, reject) {
        return Promise.resolve({ data: rows.filter(row => filters.every(filter => filter(row)))
          .sort((a, b) => b.experience - a.experience).slice(0, limit), error: null }).then(resolve, reject);
      },
    };
  } };
  const users = load('lib/users.ts', { './supabase': { supabase }, bcryptjs: {}, './serverCache': {} });
  return { users, get queryCount() { return queryCount; } };
}

test('full and lightweight leaderboard reads include grade 9 while preserving role and grade boundaries', async () => {
  const { users } = leaderboardStore();
  const expected = ['twelfth@example.test', 'tenth@example.test', student.email];
  assert.deepEqual((await users.getLeaderboard()).map(user => user.email), expected);
  assert.deepEqual((await users.getLeaderboardLight()).map(user => user.email), expected);
  assert.deepEqual((await users.getLeaderboardLight('9')).map(user => user.email), [student.email]);
  assert.deepEqual((await users.getLeaderboardLight('10')).map(user => user.email), ['tenth@example.test']);
});

test('grade 9 API filter has its own cache entry and never falls back to the all-grade leaderboard', async () => {
  const store = leaderboardStore(), cache = new Map();
  const route = load('app/api/leaderboard/route.ts', {
    'next/server': { NextResponse }, '../../../lib/users': store.users,
    '../../../lib/avatars': { getPublicAvatarUrl: () => undefined },
    '../../../lib/serverCache': { async getOrLoadCached(key, loader) {
      if (!cache.has(key)) cache.set(key, await loader());
      return cache.get(key);
    } },
  });
  const request = grade => new Request(`https://example.test/api/leaderboard${grade ? `?grade=${grade}` : ''}`);
  assert.equal((await (await route.GET(request())).json()).leaderboard.length, 3);
  for (let i = 0; i < 2; i++) {
    const response = await route.GET(request('9'));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).leaderboard.map(user => user.grade), ['9']);
  }
  assert.deepEqual([...cache.keys()], ['leaderboard:all', 'leaderboard:9']);
  assert.equal(store.queryCount, 2);
});

test('profile changes accept and normalize grade 9 but retain rejection of unsupported grades', async () => {
  const writes = [];
  const route = load('app/api/user/update/route.ts', {
    'next/server': { NextResponse }, '../../../../lib/session': session,
    '../../../../lib/users': { async updateUser(email, changes) { writes.push({ email, changes }); return { ...student, ...changes }; } },
    '../../../../lib/avatars': { getPublicAvatarUrl: () => undefined },
    '../../../../lib/serverCache': { invalidateServerCache() {} },
  });
  const request = grade => new Request('https://example.test/api/user/update', { method: 'POST', body: JSON.stringify({ grade }) });
  for (const grade of ['9', ' 9 ', 9, '10', '11', '12']) {
    const response = await route.POST(request(grade));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(json.user.grade, String(grade).trim());
    assert.equal(writes.at(-1).changes.grade, String(grade).trim());
    assert.equal(writes.at(-1).email, student.email);
  }
  const count = writes.length;
  for (const grade of ['8', '13', '9th', '']) assert.equal((await route.POST(request(grade))).status, 400);
  assert.equal(writes.length, count, 'invalid grades must not reach storage');
});

test('student signup carries grade 9 through account creation without granting teacher access', async () => {
  const created = [];
  const route = load('app/api/auth/login/route.ts', {
    'next/server': { NextResponse }, '../../../../lib/session': session, bcryptjs: {},
    '../../../../lib/rate-limit': { getClientKey: () => 'isolated', rateLimit: () => ({ ok: true }) },
    '../../../../lib/users': {
      getUser: async () => null,
      async createUser(email, password, name, role, grade) { created.push({ email, role, grade }); return { ...student, email, name, role, grade }; },
    },
  });
  const request = role => new Request('https://example.test/api/auth/login', { method: 'POST', body: JSON.stringify({
    email: student.email, password: 'synthetic-password', name: student.name, mode: 'signup', role, grade: '9',
  }) });
  assert.equal((await route.POST(request('student'))).status, 200);
  assert.deepEqual(created, [{ email: student.email, role: 'student', grade: '9' }]);
  assert.equal((await route.POST(request('teacher'))).status, 403);
  assert.equal(created.length, 1);
});

test('grade 9 students see their targeted lessons and shared lessons only', async () => {
  const lessons = [{ id: 'ninth', targetGrades: ['9'] }, { id: 'tenth', targetGrades: ['10'] }, { id: 'shared', targetGrades: [] }];
  const query = { select() { return this; }, ilike() { return this; }, limit() { return this; }, abortSignal() { return this; },
    then(resolve, reject) { return Promise.resolve({ data: [{ grade: '9' }], error: null }).then(resolve, reject); } };
  const route = load('app/api/lessons/route.ts', {
    'next/server': { NextResponse }, '../../../lib/session': session,
    '../../../lib/lessons': { getAllLessons: async () => lessons },
    '../../../lib/users': {}, '../../../lib/notifications': {},
    '../../../lib/supabase': { supabase: { from: () => query } },
    '../../../lib/serverCache': { getOrLoadCached: (_key, loader) => loader() },
  });
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).lessons.map(lesson => lesson.id), ['ninth', 'shared']);
});

test('grade 9 gets the same descriptive RPG suffix support as other student grades', () => {
  const { generatePersonalizedTitle } = load('lib/rpgTitleGenerator.ts');
  assert.match(generatePersonalizedTitle(student).subtitle, /9-р ангийн/);
});
