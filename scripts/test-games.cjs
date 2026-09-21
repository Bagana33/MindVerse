// Run: node --test scripts/test-games.cjs
// Real page handlers, isolated hooks and fake timers. All fetches are mocked;
// no server, browser, credentials, database or external network is used.
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
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };
const student = { email: 'review@example.test', role: 'student', name: 'Review Student' };
const teacher = { ...student, role: 'teacher' };

// This intentionally tests handlers/state transitions, not React reconciliation
// or native dialog focus. Browser coverage is still required for those behaviors.
function pageHarness(filename, fetchMock, session = student, reducedMotion = false) {
  let cursor = 0, tree, unmounted = false, updatesAfterUnmount = 0, timerId = 0;
  const slots = [], jobs = [], timers = new Map(), intervals = new Map(), listeners = new Map(), calls = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => {
        if (unmounted) updatesAfterUnmount++;
        slots[i] = typeof value === 'function' ? value(slots[i]) : value;
      }];
    },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn, deps };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || !same(previous.deps, deps)) jobs.push(() => {
        previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const document = {
    visibilityState: 'visible',
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const mockComponent = () => null;
  const mocks = {
    react, 'react/jsx-runtime': jsx, 'next/link': mockComponent,
    'next/dynamic': () => mockComponent,
    '../../components/layout/DashboardLayout': { DashboardLayout: mockComponent },
    '../../components/auth/useSession': { useSession: () => ({ session, loading: false }) },
    '../../components/ui/Modal': mockComponent,
    '../../components/posts/PostImage': mockComponent,
    '../../lib/fetchCache': { invalidateCache() {} },
  };
  const addTimer = (map, job, delay) => { const id = ++timerId; map.set(id, { job, delay }); return id; };
  const crypto = { calls: 0, getRandomValues(array) { this.calls++; array[0] = 2147483648; return array; } };
  const globals = {
    fetch: (url, options = {}) => { calls.push({ url, ...options }); return Promise.resolve(fetchMock(url, options)); },
    document,
    window: { matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }) },
    navigator: { clipboard: { writeText: async () => {} } },
    crypto, AbortController, AbortSignal,
    setTimeout: (job, delay) => addTimer(timers, job, delay), clearTimeout: id => timers.delete(id),
    setInterval: (job, delay) => addTimer(intervals, job, delay), clearInterval: id => intervals.delete(id),
  };
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => {
    if (!(name in mocks)) throw new Error(`Unmocked dependency forbidden: ${name}`);
    return mocks[name];
  }, module, module.exports, ...Object.values(globals));
  return {
    calls, crypto, document, timers,
    render() { cursor = 0; tree = module.exports.default(); jobs.splice(0).forEach(job => job()); return tree; },
    async poll() { for (const { job } of [...intervals.values()]) await job(); await flush(); },
    runTimer(delay) {
      const entry = [...timers].find(([, value]) => value.delay === delay);
      assert.ok(entry, `Expected pending ${delay}ms timer`);
      timers.delete(entry[0]); entry[1].job();
    },
    dispose() { unmounted = true; slots.forEach(slot => slot?.cleanup?.()); },
    get updatesAfterUnmount() { return updatesAfterUnmount; },
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props?.children)) {
    const found = find(child, predicate); if (found) return found;
  }
  return null;
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (!tree || typeof tree !== 'object') return '';
  return React.Children.toArray(tree.props?.children).map(text).join(' ');
}
const button = (tree, label) => {
  const node = find(tree, el => el.type === 'button' && text(el) === label);
  assert.ok(node, `Missing button: ${label}`); return node;
};
const modal = tree => find(tree, el => typeof el.props?.open === 'boolean' && el.props?.footer);
const submit = tree => find(tree, el => el.type === 'form').props.onSubmit({ preventDefault() {} });
function enterOption(h, value) {
  find(h.render(), el => el.props?.id === 'spinner-option').props.onChange({ target: { value } });
  return h.render();
}
const spinnerData = { ok: true, options: ['Poster', 'Animation', 'Typography'], userOptionCount: 0 };
const artwork = { id: 'art-1', imageUrl: '/review.svg', addedBy: student.email, studentName: 'Review Student', likes: 0, likedBy: [], createdAt: '2026-09-15T00:00:00Z' };
const gameData = { ok: true, images: [artwork], lessonId: 'lesson-1', gameEnded: false, rankings: [] };

test('spinner waits for initial options and guards duplicate submissions before rerender', async t => {
  const initial = deferred(), save = deferred();
  const h = pageHarness('app/spinner/page.tsx', (_url, options) => options.method ? save.promise : initial.promise);
  t.after(() => h.dispose());
  let tree = enterOption(h, 'New choice');
  assert.equal(button(tree, 'Нэмэх').props.disabled, true);
  submit(tree); // Even a queued/programmatic submit cannot bypass the loading guard.
  assert.equal(h.calls.length, 1);
  initial.resolve(response(spinnerData)); await flush();
  tree = h.render();
  assert.equal(button(tree, 'Нэмэх').props.disabled, false);
  submit(tree); submit(tree);
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
  save.resolve(response({ ...spinnerData, options: [...spinnerData.options, 'New choice'], userOptionCount: 1 }));
  await flush(); tree = h.render();
  assert.equal(button(tree, 'Хүрд эргүүлэх').props.disabled, false);
  assert.equal(find(tree, el => el.props?.id === 'spinner-option').props.value, '');
  assert.match(text(tree), /Таны оруулсан:\s+1\s*\/2/);
});

test('spinner retains failed-write error and draft after successful background refresh', async t => {
  const h = pageHarness('app/spinner/page.tsx', (_url, options) => options.method
    ? response({ ok: false, error: 'Write refused' }, 503) : response(spinnerData));
  t.after(() => h.dispose());
  h.render(); await flush(); submit(enterOption(h, 'Keep draft')); await flush();
  await h.poll(); const tree = h.render();
  assert.match(text(find(tree, el => el.props?.role === 'alert')), /Write refused/);
  assert.equal(find(tree, el => el.props?.id === 'spinner-option').props.value, 'Keep draft');
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
});

test('spinner ignores a late pre-spin response and fixes the chosen result for the entire spin', async t => {
  const lateRead = deferred(); let reads = 0;
  const h = pageHarness('app/spinner/page.tsx', () => ++reads === 1 ? response(spinnerData) : lateRead.promise);
  t.after(() => h.dispose());
  h.render(); await flush();
  const polling = h.poll();
  const spin = button(h.render(), 'Хүрд эргүүлэх').props.onClick;
  spin(); spin();
  assert.equal(h.crypto.calls, 1, 'double activation chooses only once');
  assert.equal(h.calls[1].signal.aborted, true);
  lateRead.resolve(response({ ...spinnerData, options: ['Late A', 'Late B'] })); await polling;
  await h.poll();
  assert.equal(reads, 2, 'polling is paused while the wheel is spinning');
  assert.match(text(h.render()), /Animation/);
  assert.doesNotMatch(text(h.render()), /Late A/);
  h.runTimer(4000); const tree = h.render();
  assert.match(text(find(tree, el => el.props?.['aria-live'] === 'polite')), /Сонгогдсон нь Animation/);
  assert.equal(button(tree, 'Хүрд эргүүлэх').props.disabled, false);
});

test('spinner reduced-motion result completes immediately and unmount clears pending timers', async () => {
  const h = pageHarness('app/spinner/page.tsx', () => response(spinnerData), student, true);
  h.render(); await flush(); button(h.render(), 'Хүрд эргүүлэх').props.onClick();
  h.runTimer(0);
  assert.match(text(find(h.render(), el => el.props?.['aria-live'] === 'polite')), /Animation/);
  button(h.render(), 'Хүрд эргүүлэх').props.onClick();
  h.dispose(); assert.equal(h.timers.size, 0);
  assert.equal(h.updatesAfterUnmount, 0);
});

test('game failed reset remains reviewable after automatic read and polling, without duplicate writes', async t => {
  const write = deferred();
  const h = pageHarness('app/game/page.tsx', (url, options) => {
    if (options.method) return write.promise;
    return response(url === '/api/lessons' ? { ok: true, lessons: [{ id: 'lesson-1', title: 'Review lesson', targetGrades: ['10'] }] } : gameData);
  }, teacher);
  t.after(() => h.dispose());
  h.render(); await flush(); button(h.render(), 'Дахин тохируулах').props.onClick();
  const confirm = button(modal(h.render()).props.footer, 'Баталгаажуулах').props.onClick;
  confirm(); confirm();
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
  write.resolve(response({ ok: false, error: 'Reset refused' }, 503)); await flush(); await h.poll();
  const tree = h.render();
  assert.equal(modal(tree).props.open, true);
  assert.match(text(find(tree, el => el.props?.role === 'alert')), /Reset refused/);
  assert.match(text(modal(tree)), /Reset refused/);
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
});

test('game late poll cannot overwrite a confirmed vote and duplicate activation sends once', async t => {
  const lateRead = deferred(), vote = deferred(); let reads = 0;
  const h = pageHarness('app/game/page.tsx', (_url, options) => options.method
    ? vote.promise : ++reads === 1 ? response(gameData) : lateRead.promise);
  t.after(() => h.dispose());
  h.render(); await flush(); const polling = h.poll();
  const click = button(h.render(), '♡ Санал өгөх').props.onClick;
  click(); click();
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(h.calls[1].signal.aborted, true);
  vote.resolve(response({ ok: true, images: [{ ...artwork, likes: 1, likedBy: [student.email] }] })); await flush();
  lateRead.resolve(response(gameData)); await polling;
  const tree = h.render();
  assert.equal(button(tree, '♥ Санал өгсөн').props['aria-pressed'], true);
  assert.match(text(tree), /1\s+санал/);
  assert.doesNotMatch(text(tree), /0\s+санал/);
});

test('game unmount aborts pending reads without later state updates', async () => {
  const read = deferred();
  const h = pageHarness('app/game/page.tsx', () => read.promise);
  h.render(); h.dispose(); assert.equal(h.calls[0].signal.aborted, true);
  read.resolve(response(gameData)); await flush();
  assert.equal(h.updatesAfterUnmount, 0);
  assert.equal(h.timers.size, 0);
});
