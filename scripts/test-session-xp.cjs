// Run: node --test scripts/test-session-xp.cjs
// Isolated tests of actual modules with mocked storage, HTTP and React hooks.
// No credentials, real network requests or database writes are used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise(setImmediate); };
const account = { email: 'review@example.test', name: 'Review Student', role: 'student' };

function load(filename, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => {
    if (!(name in mocks)) throw new Error(`Unmocked dependency forbidden: ${name}`);
    return mocks[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

function xpStore({ experience = 20, conflicts = 0, writeError = false, missing = false } = {}) {
  const row = { ...account, experience };
  const calls = { reads: 0, writes: [], invalidated: [], errors: [] };
  const cache = new Map([['user_db:review@example.test', { ...account, experience: 999 }]]);
  const cacheApi = {
    getCached: key => cache.get(key) || null,
    setCached: (key, value) => cache.set(key, value),
    invalidateServerCache(prefix) {
      calls.invalidated.push(prefix);
      for (const key of cache.keys()) if (key.includes(prefix)) cache.delete(key);
    },
  };
  const supabase = { from(table) {
    assert.equal(table, 'users');
    let update, emailFilter, expectedXP, zeroOrNull = false, signal;
    const query = {
      select() { return this; },
      update(value) { update = value; return this; },
      ilike(column, value) { assert.equal(column, 'email'); emailFilter = value; return this; },
      limit(value) { assert.equal(value, 1); return this; },
      eq(column, value) {
        if (column === 'email') emailFilter = value;
        else if (column === 'experience') expectedXP = value;
        else throw new Error(`Unexpected predicate: ${column}`);
        return this;
      },
      or(value) { assert.equal(value, 'experience.eq.0,experience.is.null'); zeroOrNull = true; return this; },
      abortSignal(value) { signal = value; return this; },
      async maybeSingle() {
        assert.ok(update, 'CAS terminal operation must be a write');
        assert.ok(signal instanceof AbortSignal, 'each CAS write has a deadline');
        calls.writes.push({ update: { ...update }, emailFilter, expectedXP, zeroOrNull });
        if (writeError) return { data: null, error: { message: 'Write unavailable' } };
        if (calls.writes.length <= conflicts) row.experience = (row.experience || 0) + 100;
        const matches = emailFilter === row.email && (zeroOrNull ? row.experience === 0 || row.experience === null : row.experience === expectedXP);
        if (!matches) return { data: null, error: null };
        Object.assign(row, update); return { data: { ...row }, error: null };
      },
      then(resolve, reject) {
        assert.equal(update, undefined, 'reads never mutate the store');
        calls.reads++;
        return Promise.resolve({ data: missing || emailFilter !== row.email ? [] : [{ ...row }], error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  const users = load('lib/users.ts', { './supabase': { supabase }, bcryptjs: {}, './serverCache': cacheApi }, {
    console: { error: (...args) => calls.errors.push(args) },
    fetch() { throw new Error('Real network forbidden'); },
  });
  return { users, row, calls, cache };
}

test('XP awards bypass stale cache and refresh user/leaderboard cache after a successful CAS', async () => {
  const h = xpStore();
  const user = await h.users.addExperience(account.email, 7);
  assert.equal(user.experience, 27);
  assert.equal(h.row.experience, 27);
  assert.equal(h.calls.reads, 1);
  assert.equal(h.calls.writes[0].expectedXP, 20);
  assert.equal(h.cache.get(`user_db:${account.email}`).experience, 27);
  assert.ok(h.calls.invalidated.includes(`user_info:${account.email}`));
  assert.ok(h.calls.invalidated.includes('leaderboard'));
});

test('two simultaneous XP awards preserve both increments by rereading after a CAS conflict', async () => {
  const h = xpStore();
  const results = await Promise.all([h.users.addExperience(account.email, 5), h.users.addExperience(account.email, 7)]);
  assert.ok(results.every(Boolean));
  assert.equal(h.row.experience, 32);
  assert.equal(h.calls.reads, 3);
  assert.equal(h.calls.writes.length, 3);
  assert.deepEqual(h.calls.writes.map(call => call.expectedXP), [20, 20, 25]);
  assert.equal(h.cache.get(`user_db:${account.email}`).experience, 32);
});

test('XP retries obtain fresh values and stop after exactly three conflicts', async () => {
  const retry = xpStore({ conflicts: 2 });
  assert.equal((await retry.users.addExperience(account.email, 7)).experience, 227);
  assert.deepEqual(retry.calls.writes.map(call => call.expectedXP), [20, 120, 220]);
  const exhausted = xpStore({ conflicts: Infinity });
  assert.equal(await exhausted.users.addExperience(account.email, 7), null);
  assert.equal(exhausted.calls.reads, 3);
  assert.equal(exhausted.calls.writes.length, 3);
  assert.equal(exhausted.row.experience, 320, 'only simulated competing awards were persisted');
  assert.equal(exhausted.calls.invalidated.length, 0, 'no success is reported after exhaustion');
});

test('XP supports null/zero totals, clamps deductions, and rejects invalid points before querying', async () => {
  for (const experience of [null, 0]) {
    const h = xpStore({ experience });
    assert.equal((await h.users.addExperience(account.email, 5)).experience, 5);
    assert.equal(h.calls.writes[0].zeroOrNull, true);
  }
  const deduction = xpStore();
  assert.equal((await deduction.users.addExperience(account.email, -50)).experience, 0);
  const invalid = xpStore();
  for (const points of [NaN, Infinity, -Infinity]) assert.equal(await invalid.users.addExperience(account.email, points), null);
  assert.equal(invalid.calls.reads, 0);
  assert.equal(invalid.calls.writes.length, 0);
});

test('XP write errors and missing users fail without retrying an uncertain write', async () => {
  const unavailable = xpStore({ writeError: true });
  assert.equal(await unavailable.users.addExperience(account.email, 5), null);
  assert.equal(unavailable.calls.writes.length, 1);
  assert.equal(unavailable.row.experience, 20);
  const missing = xpStore({ missing: true });
  assert.equal(await missing.users.addExperience(account.email, 5), null);
  assert.equal(missing.calls.reads, 1);
  assert.equal(missing.calls.writes.length, 0);
});

test('XP normalized input also invalidates the normalized cache key', async () => {
  const h = xpStore();
  assert.equal((await h.users.addExperience(' Review@Example.Test ', 5)).experience, 25);
  assert.equal((await h.users.getUser(account.email)).experience, 25, 'subsequent reads must not see the pre-award value');
});

function sessionHarness(fetchMock, localSession = account) {
  let cursor = 0, clearCount = 0;
  const slots = [], effects = [], calls = [], storage = new Map();
  if (localSession) storage.set('mindverse_session_cache', JSON.stringify(localSession));
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    ...React,
    useState(initial) {
      const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) {
      const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(job, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || !same(previous.deps, deps)) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: job() }; });
    },
  };
  const window = { location: { href: '/profile' } };
  const context = load('components/auth/SessionContext.tsx', {
    react, 'react/jsx-runtime': jsx, '../../lib/fetchCache': { clearCache() { clearCount++; } },
  }, {
    fetch: (url, options) => { calls.push({ url, ...options }); return Promise.resolve(fetchMock(url, options)); },
    window,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  });
  return {
    calls, storage, window,
    render() { cursor = 0; const tree = context.SessionProvider({ children: null }); effects.splice(0).forEach(job => job()); return tree; },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); },
    get clearCount() { return clearCount; },
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props?.children)) { const match = find(child, predicate); if (match) return match; }
  return null;
}

test('session starts with hydration-safe state and deduplicates simultaneous refreshes', async t => {
  const read = deferred();
  const h = sessionHarness(() => read.promise); t.after(() => h.dispose());
  const initial = h.render().props.value;
  assert.equal(initial.session, null); assert.equal(initial.loading, true);
  const a = initial.refresh(), b = initial.refresh();
  assert.equal(h.calls.length, 1);
  read.resolve(response({ session: account })); await Promise.all([a, b]);
  assert.deepEqual(h.render().props.value.session, account);
  assert.equal(h.render().props.value.loading, false);
});

for (const failure of ['http', 'network']) test(`failed ${failure} logout preserves session and permits explicit retry`, async t => {
  const logout = deferred(); let writes = 0;
  const h = sessionHarness(url => url === '/api/auth/me' ? response({ session: account }) : ++writes === 1 ? logout.promise : response({ ok: true }));
  t.after(() => h.dispose()); h.render(); await flush();
  const api = h.render().props.value;
  const pending = api.logout(); await api.logout();
  assert.equal(writes, 1, 'duplicate activation is guarded synchronously');
  logout.resolve(failure === 'http' ? response({ ok: false }, 503) : Promise.reject(new TypeError('offline')));
  await pending;
  let tree = h.render();
  assert.deepEqual(tree.props.value.session, account);
  assert.equal(h.window.location.href, '/profile');
  assert.equal(JSON.parse(h.storage.get('mindverse_session_cache')).email, account.email);
  assert.ok(find(tree, node => node.props?.role === 'alert'));
  await tree.props.value.logout(); tree = h.render();
  assert.equal(writes, 2); assert.equal(tree.props.value.session, null);
  assert.equal(h.storage.has('mindverse_session_cache'), false);
  assert.equal(h.window.location.href, '/login');
  assert.ok(h.clearCount >= 1);
});

for (const stage of ['headers', 'body']) test(`logout blocks a stale auth response delayed at ${stage}`, async t => {
  const stale = deferred(); let reads = 0;
  const h = sessionHarness(url => {
    if (url === '/api/auth/logout') return response({ ok: true });
    if (++reads === 1) return response({ session: account });
    return stage === 'headers' ? stale.promise : { ok: true, json: () => stale.promise };
  });
  t.after(() => h.dispose()); h.render(); await flush();
  const api = h.render().props.value, refreshing = api.refresh();
  await flush(); await api.logout();
  assert.equal(h.calls.findLast(call => call.url === '/api/auth/me').signal.aborted, true);
  stale.resolve(stage === 'headers' ? response({ session: account }) : { session: account });
  assert.equal(await refreshing, null);
  assert.equal(h.render().props.value.session, null);
  assert.equal(h.storage.has('mindverse_session_cache'), false);
});

test('a refresh started while logout is pending cannot restore the account after logout succeeds', async t => {
  const logout = deferred(), lateRead = deferred(); let reads = 0;
  const h = sessionHarness(url => url === '/api/auth/logout' ? logout.promise : ++reads === 1 ? response({ session: account }) : lateRead.promise);
  t.after(() => h.dispose()); h.render(); await flush();
  const api = h.render().props.value;
  const leaving = api.logout(), refreshing = api.refresh();
  logout.resolve(response({ ok: true })); await leaving;
  lateRead.resolve(response({ session: account })); await refreshing;
  assert.equal(h.render().props.value.session, null);
  assert.equal(h.storage.has('mindverse_session_cache'), false);
});
