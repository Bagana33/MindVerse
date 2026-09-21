// Run: node --test scripts/test-learning-pages.cjs. All network and session values are mocked; no database or browser writes.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const ts = require(path.join(root, "node_modules/typescript"));
const React = require(path.join(root, "node_modules/react"));
function harness(filename, mocks = {}, extra = "") {
  let cursor = 0,
    effects = [],
    slots = [],
    unmounted = false,
    updatesAfterUnmount = 0;
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (next) => {
          if (unmounted) updatesAfterUnmount++;
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(job, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (
        !previous ||
        deps.some((value, i) => !Object.is(value, previous.deps[i]))
      )
        slots[index] = { deps, callback: job };
      return slots[index].callback;
    },
    useEffect(job, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (
        !previous ||
        deps?.some((value, i) => !Object.is(value, previous.deps?.[i]))
      ) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: job() };
        });
      }
    },
  };
  const source = fs.readFileSync(path.join(root, filename), "utf8") + extra;
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime")
        return require(path.join(root, "node_modules/react/jsx-runtime"));
      if (name in mocks) return mocks[name];
      return new Proxy(function Mock() {}, { get: () => function Mock() {} });
    },
    module,
    module.exports,
  );
  return {
    exports: module.exports,
    render(fn) {
      cursor = 0;
      const tree = fn();
      effects.splice(0).forEach((job) => job());
      return tree;
    },
    dispose() {
      unmounted = true;
      slots.forEach((slot) => slot?.cleanup?.());
    },
    callbacks() {
      return slots
        .filter((slot) => typeof slot?.callback === "function")
        .map((slot) => slot.callback);
    },
    get updatesAfterUnmount() {
      return updatesAfterUnmount;
    },
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return null;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props?.children)) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

const { test } = require("node:test");
const flush = () => new Promise((resolve) => setImmediate(resolve));
const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
const teacher = { email: "teacher@example.test", role: "teacher" };
const search = new URLSearchParams();
const contest = {
  id: "original",
  title: "Original contest",
  description: "Original description",
  authorEmail: teacher.email,
  authorName: "Teacher",
  startDate: "2026-09-01T00:00:00Z",
  endDate: "2026-10-01T00:00:00Z",
  status: "active",
  prize: 100,
  targetGrades: [],
  participants: [],
  submissions: [],
};
const lesson = {
  id: "original",
  title: "Original lesson",
  description: "Original description",
  authorEmail: teacher.email,
  authorName: "Teacher",
  createdAt: "2026-09-01T00:00:00Z",
  targetGrades: [],
  questions: [],
  files: [],
};
function mocks(depth = "../../", session = teacher, params = { id: "first" }) {
  return {
    [`${depth}components/auth/useSession`]: { useSession: () => ({ session }) },
    "next/navigation": {
      useSearchParams: () => search,
      useParams: () => params,
    },
    [`${depth}lib/fetchCache`]: {
      cachedFetch: (...args) => fetch(...args),
      invalidateCache() {},
    },
  };
}
function click(tree, predicate) {
  const node = find(tree, predicate);
  assert.ok(node, "expected UI control");
  node.props.onClick({ preventDefault() {} });
}

test("confirmed contest edit survives a slower pre-edit list response", async () => {
  const h = harness(
    "app/contests/page.tsx",
    mocks(),
    "\nexport { ContestsContent as Screen };",
  );
  global.fetch = async () => json({ ok: true, contests: [contest] });
  let tree = h.render(h.exports.Screen);
  await flush();
  tree = h.render(h.exports.Screen);
  click(
    tree,
    (node) => node.type === "button" && node.props.children === "Засах",
  );
  tree = h.render(h.exports.Screen);
  find(tree, (node) => node.props?.id === "contest-title").props.onChange({
    target: { value: "Saved edit" },
  });
  tree = h.render(h.exports.Screen);
  let stale;
  global.fetch = async (url, options) =>
    options?.method === "PUT"
      ? json({ ok: true, contest: { ...contest, title: "Saved edit" } })
      : new Promise((resolve) => {
          stale = resolve;
        });
  const old = h.callbacks()[0]();
  await find(tree, (node) => node.type === "form").props.onSubmit({
    preventDefault() {},
  });
  stale(json({ ok: true, contests: [contest] }));
  await old;
  tree = h.render(h.exports.Screen);
  assert.ok(
    find(
      tree,
      (node) => node.type === "h3" && node.props.children === "Saved edit",
    ),
  );
  assert.equal(
    find(
      tree,
      (node) => node.type === "h3" && node.props.children === contest.title,
    ),
    null,
  );
  h.dispose();
});

test("confirmed contest and lesson deletions survive slower earlier reads", async () => {
  for (const [kind, item, component] of [
    ["contests", contest, "ContestsContent"],
    ["lessons", lesson, "LessonsContent"],
  ]) {
    const h = harness(
      `app/${kind}/page.tsx`,
      mocks(),
      `\nexport { ${component} as Screen };`,
    );
    global.fetch = async () => json({ ok: true, [kind]: [item] });
    let tree = h.render(h.exports.Screen);
    await flush();
    tree = h.render(h.exports.Screen);
    click(
      tree,
      (node) =>
        node.type === "button" &&
        node.props["aria-label"] ===
          (kind === "contests"
            ? `${item.title} устгах`
            : `${item.title} хичээлийг устгах`),
    );
    tree = h.render(h.exports.Screen);
    let stale;
    global.fetch = async (url, options) =>
      options?.method === "DELETE"
        ? json({ ok: true })
        : new Promise((resolve) => {
            stale = resolve;
          });
    const old = h.callbacks()[0]();
    const dialog = find(
      tree,
      (node) =>
        node.props?.title ===
        (kind === "contests" ? "Уралдаан устгах" : "Хичээл устгах"),
    );
    click(
      dialog,
      (node) =>
        node.type === "button" &&
        node.props.className?.includes("!bg-rose-600"),
    );
    await flush();
    stale(json({ ok: true, [kind]: [item] }));
    await old;
    tree = h.render(h.exports.Screen);
    assert.equal(
      find(tree, (node) => node.type === "article"),
      null,
      `${kind} cannot resurrect a deleted row`,
    );
    h.dispose();
  }
});

test("prepared contest image and description do not transfer to another contest route", async () => {
  const params = { id: "first" };
  const h = harness(
    "app/contests/[id]/page.tsx",
    mocks(
      "../../../",
      { email: "student@example.test", role: "student" },
      params,
    ),
  );
  global.fetch = async (url) =>
    url === "/api/uploads/sign"
      ? json({
          ok: true,
          cloudName: "test",
          apiKey: "test",
          signature: "test",
          timestamp: 1,
          folder: "test",
        })
      : url.startsWith("https://api.cloudinary.com")
        ? json({ secure_url: "https://example.test/first-art.png" })
        : json({ ok: true, contest: { ...contest, id: params.id } });
  let tree = h.render(h.exports.default);
  await flush();
  tree = h.render(h.exports.default);
  click(
    tree,
    (node) =>
      node.type === "button" && node.props.children === "+ Бүтээл илгээх",
  );
  tree = h.render(h.exports.default);
  const field = {
    files: [new File(["image"], "art.png", { type: "image/png" })],
    value: "art.png",
  };
  await find(
    tree,
    (node) => node.props?.id === "contest-artwork",
  ).props.onChange({ target: field, currentTarget: field });
  tree = h.render(h.exports.default);
  find(
    tree,
    (node) => node.props?.id === "contest-artwork-description",
  ).props.onChange({ target: { value: "First contest draft" } });
  tree = h.render(h.exports.default);
  assert.ok(
    find(
      tree,
      (node) =>
        node.type === "img" &&
        node.props.src === "https://example.test/first-art.png",
    ),
  );
  params.id = "second";
  tree = h.render(h.exports.default);
  await flush();
  tree = h.render(h.exports.default);
  click(
    tree,
    (node) =>
      node.type === "button" && node.props.children === "+ Бүтээл илгээх",
  );
  tree = h.render(h.exports.default);
  assert.equal(
    find(tree, (node) => node.props?.id === "contest-artwork-description").props
      .value,
    "",
  );
  assert.equal(
    find(
      tree,
      (node) =>
        node.type === "img" &&
        node.props.src === "https://example.test/first-art.png",
    ),
    null,
  );
  assert.equal(
    find(tree, (node) => node.type === "button" && node.props.type === "submit")
      .props.disabled,
    true,
  );
  h.dispose();
});
