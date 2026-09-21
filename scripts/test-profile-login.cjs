// Run: node scripts/test-profile-login.cjs (or node --test scripts/test-profile-login.cjs).
// Executes real component handlers with a small hook harness and mocked network.
// No database, credentials, browser, or external network is used.
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
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key),
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
let redirects = [];
global.window = {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  location: { replace: (url) => redirects.push(url) },
};
const flush = () => new Promise((resolve) => setImmediate(resolve));
(async () => {
  {
    const h = harness("components/posts/PostImage.tsx");
    function imageProps(sizes) {
      const wrapper = h.render(() =>
        h.exports.PostImage({
          src: "https://example.test/art.png",
          alt: "Artwork",
          sizes,
        }),
      );
      const content = wrapper.props.children;
      return find(
        h.render(() => content.type(content.props)),
        (node) => node.type === "img",
      ).props;
    }
    assert.equal(
      imageProps("300px").sizes,
      "300px",
      "grid size reaches the responsive image",
    );
    assert.equal(
      imageProps().sizes,
      "(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) 700px, 760px",
      "feed default remains unchanged",
    );
    assert.equal(imageProps().loading, "lazy");
    h.dispose();
  }
  {
    const h = harness(
      "components/profile/ProfileView.tsx",
      {},
      "\nexport { usePendingRequest as testRequest };",
    );
    let api = h.render(h.exports.testRequest),
      calls = 0,
      resolve;
    const first = api.run(() => {
      calls++;
      return new Promise((done) => (resolve = done));
    });
    await api.run(() => {
      calls++;
      return Promise.resolve("duplicate");
    });
    assert.equal(calls, 1, "duplicate mutation guarded synchronously");
    resolve("saved");
    assert.equal(await first, "saved");
    api = h.render(h.exports.testRequest);
    assert.equal(api.pending, false);
    const pending = api.run(() => new Promise(() => {}));
    h.dispose();
    assert.equal(await pending, undefined);
    assert.equal(
      h.updatesAfterUnmount,
      0,
      "aborted old account cannot update mounted state",
    );
  }
  {
    let deadline;
    window.setTimeout = (job) => {
      deadline = job;
      return 1;
    };
    window.clearTimeout = () => {};
    const h = harness(
      "components/profile/ProfileView.tsx",
      {},
      "\nexport { usePendingRequest as testRequest };",
    );
    const api = h.render(h.exports.testRequest);
    const pending = api.run(() => new Promise(() => {}));
    deadline();
    assert.equal(await pending, undefined);
    const next = h.render(h.exports.testRequest);
    assert.equal(next.pending, false);
    assert.match(next.error, /Хариу удаж/);
    h.dispose();
    window.setTimeout = setTimeout;
    window.clearTimeout = clearTimeout;
  }
  {
    const h = harness("components/auth/LoginForm.tsx");
    let tree = h.render(h.exports.LoginForm);
    find(
      tree,
      (node) => node.type === "button" && node.props.children === "Бүртгүүлэх",
    ).props.onClick();
    tree = h.render(h.exports.LoginForm);
    for (const [id, value] of [
      ["auth-email", " Test@Example.com "],
      ["auth-name", "Test User"],
      ["auth-password", "secret1"],
    ]) {
      find(tree, (node) => node.props?.id === id).props.onChange({
        target: { value },
      });
      tree = h.render(h.exports.LoginForm);
    }
    let payload,
      calls = 0,
      finish;
    global.fetch = async (url, options) => {
      calls++;
      payload = JSON.parse(options.body);
      return new Promise(
        (resolve) =>
          (finish = () =>
            resolve(
              new Response(JSON.stringify({ ok: true }), {
                headers: { "content-type": "application/json" },
              }),
            )),
      );
    };
    const submit = find(tree, (node) => node.type === "form").props.onSubmit;
    const pending = submit({ preventDefault() {} });
    await submit({ preventDefault() {} });
    assert.equal(calls, 1);
    assert.equal(payload.role, "student");
    assert.equal(payload.email, "test@example.com");
    finish();
    await pending;
    assert.deepEqual(redirects, ["/"]);
    tree = h.render(h.exports.LoginForm);
    assert.equal(
      find(
        tree,
        (node) => node.type === "button" && node.props.type === "submit",
      ).props.disabled,
      true,
      "navigation remains locked after successful login",
    );
    h.dispose();
  }
  {
    redirects = [];
    const h = harness("components/auth/LoginForm.tsx");
    let tree = h.render(h.exports.LoginForm);
    for (const [id, value] of [
      ["auth-email", "test@example.com"],
      ["auth-password", "keep-draft"],
    ]) {
      find(tree, (node) => node.props?.id === id).props.onChange({
        target: { value },
      });
      tree = h.render(h.exports.LoginForm);
    }
    global.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: "Wrong credentials" }), {
        status: 401,
      });
    await find(tree, (node) => node.type === "form").props.onSubmit({
      preventDefault() {},
    });
    tree = h.render(h.exports.LoginForm);
    assert.equal(
      find(tree, (node) => node.props?.id === "auth-password").props.value,
      "keep-draft",
    );
    assert.equal(
      find(tree, (node) => node.props?.role === "alert").props.children,
      "Wrong credentials",
    );
    assert.equal(redirects.length, 0);
    h.dispose();
  }
  {
    const original = {
      id: "post-1",
      title: "Original",
      description: "Original description",
      imageUrl: "https://example.test/art.png",
      authorEmail: "test@example.com",
      createdAt: "2026-09-15T00:00:00Z",
      reactions: [{ id: "like" }],
    };
    let currentPosts = [original],
      calls = [];
    const h = harness(
      "components/profile/ProfileView.tsx",
      { "../../lib/fetchCache": { invalidateCache() {} } },
      "\nexport { PostGrid as testGrid };",
    );
    const render = () =>
      h.render(() =>
        h.exports.testGrid({
          posts: currentPosts,
          isOwnProfile: true,
          onPostsChange: (update) => {
            currentPosts = update(currentPosts);
          },
        }),
      );
    let tree = render();
    find(
      tree,
      (node) => node.type === "button" && node.props.children === "Засах",
    ).props.onClick();
    tree = render();
    find(tree, (node) => node.props?.id === "post-edit-title").props.onChange({
      target: { value: "Updated art" },
    });
    tree = render();
    global.fetch = async (url, options) => {
      calls.push(options.method || "GET");
      return options.method === "PATCH"
        ? new Response(JSON.stringify({ ok: false, error: "uncertain save" }), {
            status: 503,
          })
        : new Response(
            JSON.stringify({
              ok: true,
              posts: [{ ...original, title: "Updated art" }],
            }),
          );
    };
    await find(
      tree,
      (node) => node.type === "form" && node.props.id === "post-edit-form",
    ).props.onSubmit({ preventDefault() {} });
    assert.deepEqual(
      calls,
      ["PATCH", "GET"],
      "uncertain edits verify instead of deleting originals",
    );
    assert.equal(currentPosts[0].id, original.id);
    assert.equal(currentPosts[0].title, "Updated art");
    assert.deepEqual(currentPosts[0].reactions, original.reactions);
    h.dispose();
  }
  {
    let body;
    const user = {
      email: "test@example.com",
      name: "Test User",
      role: "student",
      grade: "10",
      experience: 25,
      avatarUrl: "/api/avatars?email=test%40example.com&v=original",
    };
    const h = harness(
      "components/profile/ProfileView.tsx",
      {
        "../auth/useSession": {
          useSession: () => ({
            session: user,
            loading: false,
            refresh: async () => user,
          }),
        },
        "next/navigation": { useSearchParams: () => new URLSearchParams() },
        "../../lib/fetchCache": { invalidateCache() {} },
      },
      "\nexport { ProfileContent as testProfile };",
    );
    global.fetch = async (url, options) => {
      if (options.method === "POST") {
        body = JSON.parse(options.body);
        return new Response(JSON.stringify({ success: true, user }));
      }
      return new Response(
        JSON.stringify(
          url.startsWith("/api/user?")
            ? { ok: true, user }
            : { ok: true, posts: [] },
        ),
      );
    };
    let tree = h.render(h.exports.testProfile);
    await flush();
    await flush();
    tree = h.render(h.exports.testProfile);
    find(
      tree,
      (node) =>
        node.type === "button" && node.props.children === "Профайл засах",
    ).props.onClick();
    tree = h.render(h.exports.testProfile);
    await find(
      tree,
      (node) => node.type === "form" && node.props.id === "profile-edit-form",
    ).props.onSubmit({ preventDefault() {} });
    assert.equal(
      "avatarUrl" in body,
      false,
      "unchanged public avatar URL cannot overwrite stored image",
    );
    h.dispose();
  }
  console.log(
    "PASS: responsive image sizes, synchronous duplicate guards, bounded timeout, unmount cancellation, student-only signup, normalized payload, navigation lock, preserved failed-login drafts, uncertain PATCH verification, unchanged-avatar preservation.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
