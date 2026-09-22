// Run: node --test scripts/test-poster-brief-ui.cjs.
// Executes the real UI with isolated browser APIs and deterministic generated briefs.
// No browser profile, network, database, or filesystem writes are made by these tests.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const React = require("react");
const { renderToString } = require("react-dom/server");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const SAVED = "mindverse:poster-brief:saved:v1";
const CURRENT = "mindverse:poster-brief:current:v1";

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
}
function evaluate(code, mocks = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "react" || name === "react/jsx-runtime") return require(name);
      throw new Error(`Unexpected import: ${name}`);
    },
    console,
    crypto: require("node:crypto").webcrypto,
    ...globals,
  });
  return module.exports;
}
const data = evaluate(compile("lib/posterBriefs.ts"));
const uiCode = compile("components/poster-brief/PosterBriefGenerator.tsx");
function makeBrief(options = { category: "school", level: "beginner", format: "a3" }, previousTemplateId) {
  const brief = JSON.parse(JSON.stringify(data.generatePosterBrief(options, previousTemplateId, () => 0)));
  assert.equal(data.isPosterBrief(brief), true, "fixture satisfies the real persistence validator");
  return brief;
}
function makeDistinctBriefs(count) {
  return Array.from({ length: count }, (_, index) => makeBrief({
    category: data.BRIEF_CATEGORIES[Math.floor(index / data.BRIEF_LEVELS.length)].id,
    level: data.BRIEF_LEVELS[index % data.BRIEF_LEVELS.length].id,
    format: "a4",
  }));
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
function text(tree) {
  if (tree?.props?.["aria-hidden"] === "true" || tree?.props?.["aria-hidden"] === true) return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  return React.Children.toArray(tree?.props?.children).map(text).join("");
}
function find(tree, predicate) {
  return nodes(tree).find(predicate);
}
function button(tree, label) {
  const node = find(tree, (item) => item.type === "button" && text(item) === label);
  assert.ok(node, `button exists: ${label}`);
  return node;
}
function currentHeading(tree) {
  return find(tree, (node) => node.type === "h2" && node.props.tabIndex === -1);
}
function savedRemovers(tree) {
  return nodes(tree).filter((node) => node.type === "button" && node.props["aria-label"]?.endsWith("санааг хадгалсан жагсаалтаас хасах"));
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness({ initial = {}, clipboard } = {}) {
  let cursor = 0, unmounted = false, updatesAfterUnmount = 0, nextTimer = 1;
  const slots = [], effects = [], timers = new Map(), focusEvents = [];
  const storage = new Map(Object.entries(initial));
  const controls = { readError: false, writeError: false };
  const calls = { reads: [], writes: [], generation: [], copies: [], blobs: [], anchors: [], revoked: [] };
  const react = {
    ...React,
    useState(initialValue) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initialValue === "function" ? initialValue() : initialValue;
      return [slots[index], (next) => {
        if (unmounted) updatesAfterUnmount++;
        slots[index] = typeof next === "function" ? next(slots[index]) : next;
      }];
    },
    useRef(initialValue) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initialValue };
      return slots[index];
    },
    useEffect(job, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps?.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: job() };
        });
      }
    },
  };
  const localStorage = {
    getItem(key) {
      calls.reads.push(key);
      if (controls.readError) throw new Error("storage denied");
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      calls.writes.push({ key, value });
      if (controls.writeError) throw new Error("storage quota");
      storage.set(key, value);
    },
  };
  const mockedData = {
    ...data,
    generatePosterBrief(options, previousTemplateId) {
      calls.generation.push({ options: { ...options }, previousTemplateId });
      return makeBrief(options, previousTemplateId);
    },
  };
  const schedule = (job, delay) => {
    const id = nextTimer++;
    timers.set(id, { job, delay });
    return id;
  };
  const module = evaluate(uiCode, { react, "../../lib/posterBriefs": mockedData }, {
    window: { localStorage, setTimeout: schedule, clearTimeout: (id) => timers.delete(id) },
    navigator: { clipboard: clipboard === null ? undefined : { writeText(value) {
      calls.copies.push(value);
      return clipboard ? clipboard(value) : Promise.resolve();
    } } },
    setTimeout: schedule,
    clearTimeout: (id) => timers.delete(id),
    Blob,
    URL: {
      createObjectURL(blob) { calls.blobs.push(blob); return "blob:brief-test"; },
      revokeObjectURL(url) { calls.revoked.push(url); },
    },
    document: {
      createElement(tag) {
        assert.equal(tag, "a");
        const anchor = { clicked: false, removed: false, click() { this.clicked = true; }, remove() { this.removed = true; } };
        calls.anchors.push(anchor);
        return anchor;
      },
      body: { appendChild() {} },
    },
  });
  function render({ commit = true } = {}) {
    cursor = 0;
    const tree = module.PosterBriefGenerator();
    if (commit) {
      for (const node of nodes(tree)) {
        const ref = node.props?.ref;
        if (ref && typeof ref === "object") ref.current = {
          focus: () => focusEvents.push({ action: "focus", node }),
          select: () => focusEvents.push({ action: "select", node }),
          scrollIntoView: () => focusEvents.push({ action: "scroll", node }),
        };
      }
      effects.splice(0).forEach((job) => job());
    }
    return tree;
  }
  return {
    render, storage, calls, controls, focusEvents, timers,
    mount() { render(); return render(); },
    fireTimers(maxDelay = Infinity) {
      for (const [id, timer] of [...timers]) if (timer.delay <= maxDelay) { timers.delete(id); timer.job(); }
    },
    dispose() {
      unmounted = true;
      slots.forEach((slot) => slot?.cleanup?.());
    },
    get updatesAfterUnmount() { return updatesAfterUnmount; },
  };
}
function generated(h) {
  let tree = h.mount();
  button(tree, "Санаа гаргах").props.onClick();
  return h.render();
}

test("server and first client render do not access storage or generate a random brief", () => {
  const server = evaluate(uiCode, { "../../lib/posterBriefs": data });
  const html = renderToString(React.createElement(server.PosterBriefGenerator));
  const h = harness({ initial: { [CURRENT]: JSON.stringify(makeBrief()) } });
  const initial = h.render({ commit: false });
  assert.equal(renderToString(initial), html, "initial markup remains hydration-compatible even with a saved draft");
  assert.equal(h.calls.reads.length, 0);
  assert.equal(h.calls.generation.length, 0);
  assert.equal(button(initial, "Санаа гаргах").props.disabled, true);
});

test("mount restores valid options and deduplicates, validates and caps saved briefs", () => {
  const briefs = makeDistinctBriefs(10);
  const draft = makeBrief({ category: data.BRIEF_CATEGORIES[1].id, level: data.BRIEF_LEVELS[1].id, format: data.BRIEF_FORMATS[1].id });
  const h = harness({ initial: {
    [SAVED]: JSON.stringify([briefs[0], null, {}, briefs[0], ...briefs.slice(1)]),
    [CURRENT]: JSON.stringify(draft),
  } });
  const tree = h.mount();
  assert.equal(savedRemovers(tree).length, 8);
  assert.equal(text(currentHeading(tree)), draft.title);
  assert.equal(find(tree, (node) => node.props?.id === "brief-level").props.value, draft.level.id);
  assert.equal(find(tree, (node) => node.props?.id === "brief-format").props.value, draft.format.id);
  assert.equal(button(tree, draft.category.label).props["aria-pressed"], true);
  assert.equal(h.calls.writes.length, 0, "restoration never overwrites existing storage");
  assert.equal(h.focusEvents.length, 0, "restoring a draft does not steal focus");
});

test("blocked or malformed storage still permits generating and downloading", () => {
  for (const blocked of [false, true]) {
    const h = harness({ initial: { [SAVED]: "{broken", [CURRENT]: "{broken" } });
    h.controls.readError = blocked;
    h.controls.writeError = blocked;
    const tree = generated(h);
    assert.ok(currentHeading(tree));
    assert.ok(find(tree, (node) => node.props?.role === "alert"));
    assert.equal(button(tree, "Өөр санаа гаргах").props.disabled, false);
    assert.ok(button(tree, "TXT татах"));
    assert.equal(savedRemovers(tree).length, 0);
  }
});

test("regeneration uses current controls, resets checklist, persists and focuses the result", () => {
  const h = harness();
  let tree = generated(h);
  const previous = JSON.parse(h.storage.get(CURRENT));
  const checkbox = find(tree, (node) => node.type === "input" && node.props.type === "checkbox");
  checkbox.props.onChange();
  tree = h.render();
  assert.equal(find(tree, (node) => node.type === "input" && node.props.type === "checkbox").props.checked, true);
  const level = data.BRIEF_LEVELS[1].id;
  find(tree, (node) => node.props?.id === "brief-level").props.onChange({ target: { value: level } });
  tree = h.render();
  button(tree, "Өөр санаа гаргах").props.onClick();
  tree = h.render();
  assert.equal(h.calls.generation.at(-1).options.level, level);
  assert.equal(h.calls.generation.at(-1).previousTemplateId, previous.templateId);
  assert.equal(JSON.parse(h.storage.get(CURRENT)).level.id, level);
  assert.ok(nodes(tree).filter((node) => node.type === "input" && node.props.type === "checkbox").every((node) => !node.props.checked));
  assert.ok(h.focusEvents.some(({ action, node }) => action === "focus" && node.type === "h2"));
});

test("save is deduplicated and failed writes retain an honest, retryable unsaved state", () => {
  const h = harness();
  let tree = generated(h);
  h.controls.writeError = true;
  button(tree, "Санаагаа хадгалах").props.onClick();
  tree = h.render();
  assert.equal(savedRemovers(tree).length, 0);
  assert.equal(h.storage.has(SAVED), false);
  assert.equal(button(tree, "Санаагаа хадгалах").props.disabled, false);
  h.controls.writeError = false;
  button(tree, "Санаагаа хадгалах").props.onClick();
  tree = h.render();
  assert.equal(button(tree, "Хадгалсан").props.disabled, true);
  button(tree, "Хадгалсан").props.onClick();
  tree = h.render();
  assert.equal(JSON.parse(h.storage.get(SAVED)).length, 1);
  assert.equal(savedRemovers(tree).length, 1);
  assert.equal(find(tree, (node) => node.props?.role === "alert"), undefined);
});

test("full saved list preserves all eight entries and explains how to free a slot", () => {
  const briefs = makeDistinctBriefs(8);
  const h = harness({ initial: { [SAVED]: JSON.stringify(briefs) } });
  let tree = generated(h);
  button(tree, "Санаагаа хадгалах").props.onClick();
  tree = h.render();
  assert.equal(savedRemovers(tree).length, 8);
  assert.equal(JSON.parse(h.storage.get(SAVED)).length, 8);
  assert.match(text(find(tree, (node) => node.props?.role === "status")), /8 санаа/);
});

test("remove failure keeps the entry; successful removal keeps the current draft available", () => {
  const draft = makeBrief();
  const h = harness({ initial: { [SAVED]: JSON.stringify([draft]), [CURRENT]: JSON.stringify(draft) } });
  let tree = h.mount();
  h.controls.writeError = true;
  savedRemovers(tree)[0].props.onClick();
  tree = h.render();
  assert.equal(savedRemovers(tree).length, 1);
  h.controls.writeError = false;
  savedRemovers(tree)[0].props.onClick();
  tree = h.render();
  assert.equal(savedRemovers(tree).length, 0);
  assert.equal(text(currentHeading(tree)), draft.title);
  assert.equal(button(tree, "Санаагаа хадгалах").props.disabled, false);
  assert.equal(JSON.parse(h.storage.get(SAVED)).length, 0);
});

test("opening a saved brief restores its settings and clears the previous checklist", () => {
  const draft = makeBrief({ category: data.BRIEF_CATEGORIES[1].id, level: data.BRIEF_LEVELS[1].id, format: data.BRIEF_FORMATS[1].id });
  const h = harness({ initial: { [SAVED]: JSON.stringify([draft]) } });
  let tree = generated(h);
  find(tree, (node) => node.type === "input" && node.props.type === "checkbox").props.onChange();
  tree = h.render();
  const savedSection = find(tree, (node) => node.props?.["aria-labelledby"] === "saved-briefs-heading");
  const open = find(savedSection, (node) => node.type === "button" && !node.props["aria-label"]);
  open.props.onClick();
  tree = h.render();
  assert.equal(text(currentHeading(tree)), draft.title);
  assert.equal(JSON.parse(h.storage.get(CURRENT)).id, draft.id);
  assert.equal(find(tree, (node) => node.props?.id === "brief-level").props.value, draft.level.id);
  assert.equal(button(tree, "Хадгалсан").props.disabled, true);
  assert.ok(nodes(tree).filter((node) => node.type === "input" && node.props.type === "checkbox").every((node) => !node.props.checked));
});

test("copy success exports the current brief and clears its pending timer", async () => {
  const h = harness();
  let tree = generated(h);
  const expected = data.formatBriefText(JSON.parse(h.storage.get(CURRENT)));
  await button(tree, "Хуулах").props.onClick();
  tree = h.render();
  assert.equal(h.calls.copies[0], expected);
  assert.match(text(find(tree, (node) => node.props?.role === "status")), /хууллаа/);
  assert.equal(button(tree, "Хуулах").props.disabled, false);
  assert.equal(h.timers.size, 0);
});

test("missing or denied clipboard offers focused, selected manual-copy text", async () => {
  for (const clipboard of [null, () => Promise.reject(new Error("denied"))]) {
    const h = harness({ clipboard });
    let tree = generated(h);
    await button(tree, "Хуулах").props.onClick();
    tree = h.render();
    const fallback = find(tree, (node) => node.props?.id === "brief-copy-text");
    assert.ok(fallback?.props.readOnly);
    assert.equal(fallback.props.value, data.formatBriefText(JSON.parse(h.storage.get(CURRENT))));
    assert.ok(h.focusEvents.some(({ action, node }) => action === "select" && node.props.id === "brief-copy-text"));
    assert.equal(button(tree, "Хуулах").props.disabled, false);
  }
});

test("unsettled clipboard falls back within three seconds instead of locking the button", async () => {
  const h = harness({ clipboard: () => new Promise(() => {}) });
  let tree = generated(h);
  const pending = button(tree, "Хуулах").props.onClick();
  tree = h.render();
  assert.equal(button(tree, "Хуулж байна…").props.disabled, true);
  assert.ok([...h.timers.values()].some((timer) => timer.delay <= 3000));
  h.fireTimers(3000);
  await pending;
  tree = h.render();
  assert.ok(find(tree, (node) => node.props?.id === "brief-copy-text"));
  assert.equal(button(tree, "Хуулах").props.disabled, false);
  assert.equal(h.timers.size, 0);
});

test("older clipboard completion cannot replace a newer brief's status or pending state", async () => {
  for (const failure of [false, true]) {
    const first = deferred(), second = deferred();
    let count = 0;
    const h = harness({ clipboard: () => (++count === 1 ? first.promise : second.promise) });
    let tree = generated(h);
    const oldCopy = button(tree, "Хуулах").props.onClick();
    tree = h.render();
    button(tree, "Өөр санаа гаргах").props.onClick();
    tree = h.render();
    const generationNotice = text(find(tree, (node) => node.props?.role === "status"));
    const newCopy = button(tree, "Хуулах").props.onClick();
    tree = h.render();
    if (failure) first.reject(new Error("old clipboard denied")); else first.resolve();
    await oldCopy;
    tree = h.render();
    assert.equal(text(find(tree, (node) => node.props?.role === "status")), generationNotice);
    assert.equal(button(tree, "Хуулж байна…").props.disabled, true);
    assert.equal(find(tree, (node) => node.props?.id === "brief-copy-text"), undefined);
    second.resolve();
    await newCopy;
    tree = h.render();
    assert.equal(button(tree, "Хуулах").props.disabled, false);
  }
});

test("clipboard completion after unmount never writes React state", async () => {
  const copy = deferred();
  const h = harness({ clipboard: () => copy.promise });
  const tree = generated(h);
  const pending = button(tree, "Хуулах").props.onClick();
  h.dispose();
  copy.reject(new Error("settled after leaving page"));
  await pending;
  assert.equal(h.updatesAfterUnmount, 0);
  assert.equal(h.timers.size, 0);
});

test("TXT download contains the displayed brief and releases its temporary object URL", async () => {
  const h = harness();
  const tree = generated(h);
  button(tree, "TXT татах").props.onClick();
  assert.equal(h.calls.anchors.length, 1);
  const anchor = h.calls.anchors[0];
  assert.ok(anchor.clicked && anchor.removed);
  assert.match(anchor.download, /^mindverse-poster-.+\.txt$/);
  assert.equal(h.calls.blobs[0].type, "text/plain;charset=utf-8");
  const bytes = new Uint8Array(await h.calls.blobs[0].arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "UTF-8 BOM preserves Mongolian text in desktop editors");
  assert.equal(await h.calls.blobs[0].text(), data.formatBriefText(JSON.parse(h.storage.get(CURRENT))));
  h.fireTimers();
  assert.deepEqual(h.calls.revoked, ["blob:brief-test"]);
});
