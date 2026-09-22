const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

// Run the real pure module, with imports blocked so the tests cannot use a network or database.
const source = fs.readFileSync(path.join(__dirname, "../lib/posterBriefs.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", compiled)(
  (name) => { throw new Error(`Offline brief generator must not import ${name}`); },
  loaded,
  loaded.exports,
);
const {
  BRIEF_CATEGORIES, BRIEF_LEVELS, BRIEF_FORMATS, POSTER_TEMPLATE_COUNT,
  generatePosterBrief, formatBriefText, isPosterBrief,
} = loaded.exports;
const options = { category: "school", level: "beginner", format: "a3" };
const make = (overrides = {}, random = 0) => generatePosterBrief({ ...options, ...overrides }, undefined, () => random);
const clone = (value) => JSON.parse(JSON.stringify(value));

test("24 distinct curated briefs cover six categories equally and retain meaningful poster copy", () => {
  assert.equal(POSTER_TEMPLATE_COUNT, 24);
  assert.deepEqual(BRIEF_CATEGORIES.map((item) => item.id), ["school", "culture", "environment", "sport", "music", "technology"]);
  const ids = new Set();
  const headlines = new Set();
  for (const category of BRIEF_CATEGORIES) {
    const categoryIds = new Set();
    for (const random of [0, 0.25, 0.5, 0.75, 0.999999]) {
      const brief = make({ category: category.id }, random);
      assert.deepEqual(brief.category, category);
      assert.equal(isPosterBrief(brief), true);
      categoryIds.add(brief.templateId);
      ids.add(brief.templateId);
      headlines.add(brief.headline);
      for (const key of ["title", "client", "audience", "goal", "headline", "body", "callToAction", "conceptStarter"]) {
        assert.match(brief[key], /[А-Яа-яӨөҮү]/u, `${brief.templateId}.${key} must contain Mongolian text`);
      }
      assert.equal(brief.palette.length, 3);
      assert.equal(new Set(brief.palette.map((color) => color.hex)).size, 3);
      assert.ok(brief.requirements.length >= 5, "Includes theme-specific and common requirements");
    }
    assert.equal(categoryIds.size, 4, `${category.id} must offer four different briefs`);
  }
  assert.equal(ids.size, 24);
  assert.equal(headlines.size, 24);
});

test("all-category mode reaches every template and returns the actual category", () => {
  const ids = new Set();
  for (let index = 0; index < POSTER_TEMPLATE_COUNT; index += 1) {
    const brief = make({ category: "all" }, (index + 0.5) / POSTER_TEMPLATE_COUNT);
    ids.add(brief.templateId);
    assert.notEqual(brief.category.id, "all");
    assert.ok(BRIEF_CATEGORIES.some((category) => category.id === brief.category.id));
  }
  assert.equal(ids.size, POSTER_TEMPLATE_COUNT);
});

test("same-category and all-category draws never immediately repeat, including boundary randomness", () => {
  for (const category of [...BRIEF_CATEGORIES.map((item) => item.id), "all"]) {
    let previous;
    for (const random of [0, 0, 0.999999, 0.999999, 0.5, 0.5, 0]) {
      const next = generatePosterBrief({ ...options, category }, previous, () => random);
      assert.notEqual(next.templateId, previous);
      previous = next.templateId;
    }
  }
  const previousSchool = make().templateId;
  const switched = generatePosterBrief({ ...options, category: "music" }, previousSchool, () => 0);
  assert.equal(switched.category.id, "music");
  assert.equal(switched.templateId, make({ category: "music" }).templateId);
});

test("every level and format has consistent dimensions, positive steps, and an exact time budget", () => {
  for (const category of BRIEF_CATEGORIES) {
    for (const level of BRIEF_LEVELS) {
      for (const format of BRIEF_FORMATS) {
        const brief = make({ category: category.id, level: level.id, format: format.id });
        assert.deepEqual(brief.level, level);
        assert.deepEqual(brief.format, format);
        assert.equal(brief.steps.reduce((sum, step) => sum + step.minutes, 0), level.minutes);
        assert.ok(brief.steps.every((step) => Number.isInteger(step.minutes) && step.minutes > 0));
        assert.ok(brief.requirements.some((line) => line.includes(format.dimensions)));
        assert.ok(brief.steps.some((step) => step.description.includes(format.dimensions)));
        assert.equal(isPosterBrief(clone(brief)), true);
      }
    }
  }
  assert.deepEqual(BRIEF_LEVELS.map((item) => item.minutes), [30, 45, 60]);
  assert.deepEqual(BRIEF_FORMATS.map((item) => item.dimensions), ["210 × 297 мм", "297 × 420 мм", "1080 × 1080 px", "1080 × 1920 px"]);
});

test("level changes the actual task complexity while preserving the selected poster's message", () => {
  const beginner = make({ level: "beginner" });
  const standard = make({ level: "standard" });
  const advanced = make({ level: "advanced" });
  assert.equal(beginner.templateId, advanced.templateId);
  assert.equal(beginner.headline, advanced.headline);
  assert.match(beginner.challenge, /Нэг гол дүрс/);
  assert.match(standard.challenge, /Хоёр өөр ноорог/);
  assert.match(advanced.challenge, /Гурван өөр ноорог/);
  assert.notDeepEqual(beginner.steps.map((item) => item.description), standard.steps.map((item) => item.description));
  assert.ok(advanced.checklist.length > beginner.checklist.length);
});

test("snapshot ids deduplicate the same template, level, and format without depending on clock time", () => {
  const first = make();
  assert.deepEqual(first, make());
  assert.equal(first.id, `${first.templateId}:beginner:a3`);
  assert.notEqual(first.id, make({ level: "standard" }).id);
  assert.notEqual(first.id, make({ format: "story" }).id);
  assert.notEqual(first.id, make({}, 0.5).id);
  assert.equal(first.createdAt, undefined);
});

test("returned snapshots are independent so edits cannot corrupt future generations or metadata", () => {
  const before = make();
  const changed = make();
  changed.category.label = "changed";
  changed.level.minutes = 1;
  changed.format.dimensions = "1 × 1";
  changed.palette[0].hex = "#000000";
  changed.requirements[0] = "changed";
  changed.steps[0].minutes = 1;
  changed.checklist.pop();
  assert.deepEqual(make(), before);
});

test("generation rejects invalid choices and invalid random values before making an invalid brief", () => {
  for (const invalid of [null, undefined, [], {}, "school", { ...options, category: "unknown" }, { ...options, level: "expert" }, { ...options, format: "a2" }]) {
    assert.throws(() => generatePosterBrief(invalid, undefined, () => 0));
  }
  for (const invalid of [-1, 1, Infinity, -Infinity, NaN, "0.5", null, undefined]) {
    assert.throws(() => generatePosterBrief(options, undefined, () => invalid), RangeError);
  }
  assert.throws(() => generatePosterBrief(options, undefined, 0.5), TypeError);
  assert.throws(() => generatePosterBrief(options, 42, () => 0), TypeError);
  let calls = 0;
  generatePosterBrief(options, "nonexistent-template", () => { calls += 1; return 0; });
  assert.equal(calls, 1, "A generation performs one bounded random choice, not a retry loop");
});

test("plain-text export is a complete standalone Mongolian assignment with format and task steps", () => {
  const brief = make({ category: "technology", level: "advanced", format: "story" });
  const text = formatBriefText(brief);
  for (const value of [brief.title, brief.client, brief.audience, brief.goal, brief.headline, brief.body, brief.callToAction, brief.conceptStarter, brief.challenge, brief.category.label, brief.level.label, brief.format.dimensions, brief.format.delivery]) {
    assert.ok(text.includes(value), `Export omitted ${value}`);
  }
  for (const color of brief.palette) assert.ok(text.includes(`${color.name} — ${color.hex}`));
  for (const value of [...brief.requirements, ...brief.checklist]) assert.ok(text.includes(value));
  for (const step of brief.steps) {
    assert.ok(text.includes(`${step.title} · ${step.minutes} минут`));
    assert.ok(text.includes(step.description));
  }
  assert.match(text, /Сургалтын зориулалттай зохиомол захиалга/);
  assert.doesNotMatch(text, /undefined|\[object Object\]|<script|https?:\/\//);
});

test("storage validation accepts roundtrips and optional valid ISO creation dates", () => {
  const brief = clone(make());
  assert.equal(isPosterBrief(brief), true);
  brief.createdAt = "2026-09-22T04:05:06.000Z";
  assert.equal(isPosterBrief(clone(brief)), true);
  for (const invalid of ["yesterday", "2026-02-30T00:00:00.000Z", "2026-09-22", 123, null]) {
    assert.equal(isPosterBrief({ ...brief, createdAt: invalid }), false);
  }
});

test("storage validation rejects unknown templates and inconsistent category, level, format, or ids", () => {
  const mutations = [
    (value) => { value.templateId = "invented"; },
    (value) => { value.id = "random-time-id"; },
    (value) => { value.category = { ...BRIEF_CATEGORIES[1] }; },
    (value) => { value.category.id = "all"; },
    (value) => { value.level.minutes = 999; },
    (value) => { value.level.id = "unknown"; },
    (value) => { value.format.dimensions = "999 × 999 px"; },
    (value) => { value.format.delivery = "Different instructions"; },
    (value) => { value.format.id = "unknown"; },
    (value) => { value.steps[0].minutes += 1; },
    (value) => { value.steps[0].minutes = -1; },
    (value) => { value.steps[0].minutes = "4"; },
    (value) => { value.steps[0].minutes = 4.5; },
  ];
  for (const mutate of mutations) {
    const brief = clone(make());
    mutate(brief);
    assert.equal(isPosterBrief(brief), false, mutate.toString());
  }
});

test("storage validation safely rejects incomplete or malformed lists, text, palettes, and arbitrary objects", () => {
  for (const value of [null, undefined, false, 42, "{}", [], {}, new Date()]) {
    assert.equal(isPosterBrief(value), false);
  }
  const mutations = [
    (value) => { delete value.callToAction; },
    (value) => { value.title = "   "; },
    (value) => { value.body = "x".repeat(1201); },
    (value) => { value.palette = [value.palette[0]]; },
    (value) => { value.palette[0].hex = "red"; },
    (value) => { value.palette[0].hex = "#fff; background: url(x)"; },
    (value) => { value.palette[0].name = null; },
    (value) => { value.palette[0].extra = () => {}; },
    (value) => { value.palette = Array(3); },
    (value) => { value.requirements = ["one", null]; },
    (value) => { value.requirements = Array(3); },
    (value) => { value.checklist = "not an array"; },
    (value) => { value.steps = [value.steps[0]]; },
    (value) => { value.steps = [{ ...value.steps[0], minutes: 30 }, , ]; value.steps.length = 3; },
    (value) => { value.steps[0].description = {}; },
    (value) => { value.extra = value; },
  ];
  for (const mutate of mutations) {
    const brief = clone(make());
    mutate(brief);
    assert.equal(isPosterBrief(brief), false, mutate.toString());
  }
  const getter = { get templateId() { throw new Error("Untrusted getter"); } };
  assert.doesNotThrow(() => isPosterBrief(getter));
  assert.equal(isPosterBrief(getter), false);
});
