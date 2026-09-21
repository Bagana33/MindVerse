// Isolated authentication checks: synthetic credentials, no network, database, or email writes.
// Run: node --test scripts/test-auth-security.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
const SECRET = "test-only-29bb8ed876186dea4ff64ce3b6427a850617";
const CRON_SECRET = "test-only-e818bd5a5bf2613166bb9b43648217f4e515";
const PUBLIC_DEFAULT = "neoncanvas_dev_secret_change_in_prod";
const user = {
  email: "learner@example.org",
  role: "student",
  name: "Learner",
  password: "synthetic-bcrypt-hash-before-reset",
};

function harness(env = {}, overrides = {}) {
  const modules = new Map();
  const logs = [];
  let transportCalls = 0;
  const mocks = {
    "node:crypto": crypto,
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "next/server": {
      NextResponse: { json: (data, init) => Response.json(data, init) },
    },
    nodemailer: {
      createTransport: () => {
        transportCalls++;
        throw new Error("Email transport must not run in isolated tests");
      },
    },
    "lib/users.ts": {
      getUser: async () => {
        throw new Error("Unexpected account lookup");
      },
    },
    "lib/supabase.ts": {
      supabase: {
        from: () => {
          throw new Error("Unexpected database query");
        },
      },
    },
    "lib/serverCache.ts": { getCached: () => null, setCached: () => {} },
    "lib/rate-limit.ts": {
      getClientKey: () => "test",
      rateLimit: () => ({ ok: true }),
    },
    ...overrides,
  };
  function load(filename) {
    const normalized = filename.replaceAll("\\", "/");
    if (normalized in mocks) return mocks[normalized];
    if (modules.has(normalized)) return modules.get(normalized).exports;
    if (
      !/^(lib\/(signingKey|session|otp|email)\.ts|app\/api\/auth\/(me|send-reset-code|reset-password)\/route\.ts)$/.test(
        normalized,
      )
    ) {
      throw new Error(`Unexpected module access: ${normalized}`);
    }
    const output = ts.transpileModule(
      fs.readFileSync(path.join(ROOT, normalized), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText;
    const module = { exports: {} };
    modules.set(normalized, module);
    new Function("require", "module", "exports", "process", "console", output)(
      (dependency) => {
        if (dependency in mocks) return mocks[dependency];
        if (dependency.startsWith(".")) {
          const resolved = path.posix.normalize(
            path.posix.join(path.posix.dirname(normalized), dependency),
          );
          return load(resolved.endsWith(".ts") ? resolved : `${resolved}.ts`);
        }
        throw new Error(`Unexpected dependency: ${dependency}`);
      },
      module,
      module.exports,
      { env: { ...env } },
      {
        log: (...values) => logs.push(values),
        error: (...values) => logs.push(values),
        warn: (...values) => logs.push(values),
      },
    );
    return module.exports;
  }
  return { load, logs, transportCalls: () => transportCalls };
}

function sign(payload, key) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${crypto.createHmac("sha256", key).update(encoded).digest("base64url")}`;
}
function payloadOf(token) {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url"));
}
function resetRequest() {
  return new Request("https://test.invalid/api/auth/send-reset-code", {
    method: "POST",
    body: JSON.stringify({ email: user.email }),
  });
}

// Authentication fixtures never inherit the shell's real environment.
test("dedicated signing keys preserve the configured session HMAC and isolate reset purposes", () => {
  const { getSigningKey } = harness({ NC_SESSION_SECRET: SECRET }).load(
    "lib/signingKey.ts",
  );
  assert.equal(getSigningKey("session").toString(), SECRET);
  const keys = [
    "session",
    "password-reset-token",
    "password-reset-code",
    "password-reset-version",
  ].map((purpose) => getSigningKey(purpose).toString("hex"));
  assert.equal(new Set(keys).size, 4);
});

test("private fallback keys are stable, purpose-separated, and never equal to the provider secret", () => {
  for (const fixture of [
    { CRON_SECRET },
    { CLOUDINARY_API_SECRET: "test-only-b924a8eea45185ad" },
  ]) {
    const first = harness(fixture).load("lib/signingKey.ts");
    const second = harness(fixture).load("lib/signingKey.ts");
    const keys = [
      "session",
      "password-reset-token",
      "password-reset-code",
      "password-reset-version",
    ].map((purpose) => first.getSigningKey(purpose).toString("hex"));
    assert.equal(new Set(keys).size, 4);
    assert.equal(keys[0], second.getSigningKey("session").toString("hex"));
    assert.notEqual(
      first.getSigningKey("session").toString(),
      Object.values(fixture)[0],
    );
  }
});

test("missing, public, weak, and repeated signing secrets fail closed", () => {
  for (const env of [
    {},
    { NC_SESSION_SECRET: PUBLIC_DEFAULT, CRON_SECRET },
    { NC_SESSION_SECRET: "short", CRON_SECRET },
    { NC_SESSION_SECRET: "a".repeat(64) },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: SECRET },
    { CRON_SECRET: "short" },
  ]) {
    assert.throws(
      () => harness(env).load("lib/signingKey.ts").getSigningKey("session"),
      (error) => error.name === "SigningConfigurationError",
    );
  }
});

test("session roundtrip normalizes identity, signs a bounded expiry and excludes unexpected data", () => {
  const sessions = harness({ NC_SESSION_SECRET: SECRET }).load(
    "lib/session.ts",
  );
  const token = sessions.encodeSession({
    ...user,
    email: " Learner@Example.org ",
    avatarUrl: `data:image/png;base64,${"A".repeat(4000)}`,
    password: "must-not-serialize",
  });
  const payload = payloadOf(token);
  assert.equal(payload.v, 2);
  assert.equal(payload.exp - payload.iat, 30 * 24 * 60 * 60);
  assert.equal(payload.avatarUrl, undefined);
  assert.equal(payload.password, undefined);
  assert.equal(sessions.decodeSession(token).email, user.email);
  assert.equal(token, sign(payload, SECRET));
  assert.ok(token.length < 4096);
});

test("session signatures reject tampering, malformed signatures, public fallback and timeless legacy tokens", () => {
  const sessions = harness({ NC_SESSION_SECRET: SECRET }).load(
    "lib/session.ts",
  );
  const token = sessions.encodeSession(user);
  const payload = payloadOf(token);
  const changedPayload = Buffer.from(
    JSON.stringify({ ...payload, role: "teacher" }),
  ).toString("base64url");
  for (const invalid of [
    `${changedPayload}.${token.split(".")[1]}`,
    `${token}.extra`,
    `${token.split(".")[0]}.${"♥".repeat(43)}`,
    sign(payload, PUBLIC_DEFAULT),
    sign(user, SECRET),
    "x".repeat(4097),
  ]) {
    assert.equal(sessions.decodeSession(invalid), null);
  }
});

test("correctly signed sessions reject expired, future, malformed, overlong and unsupported claims", () => {
  const sessions = harness({ NC_SESSION_SECRET: SECRET }).load(
    "lib/session.ts",
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = payloadOf(sessions.encodeSession(user));
  for (const change of [
    { exp: now },
    { iat: now + 120, exp: now + 3600 },
    { exp: "tomorrow" },
    { exp: null },
    { exp: now + 31 * 86400 },
    { exp: payload.iat },
    { iat: 0.5 },
    { v: 1 },
    { role: "admin" },
    { email: {} },
  ]) {
    assert.equal(
      sessions.decodeSession(sign({ ...payload, ...change }, SECRET)),
      null,
    );
  }
});

test("reset codes use cryptographic generation and accept only the right code and identity", () => {
  const h = harness(
    { NC_SESSION_SECRET: SECRET },
    {
      "node:crypto": {
        ...crypto,
        randomInt: (minimum, maximum) => {
          assert.equal(minimum, 100000);
          assert.equal(maximum, 1000000);
          return 123456;
        },
      },
    },
  );
  const otp = h.load("lib/otp.ts");
  const result = otp.generatePasswordResetToken(
    " Learner@Example.org ",
    user.password,
  );
  assert.equal(result.code, "123456");
  assert.equal(
    otp.verifyPasswordResetToken(
      user.email,
      result.code,
      result.token,
      user.password,
    ).valid,
    true,
  );
  assert.equal(
    otp.verifyPasswordResetToken(
      user.email,
      "654321",
      result.token,
      user.password,
    ).valid,
    false,
  );
  assert.equal(
    otp.verifyPasswordResetToken(
      "someone@example.org",
      result.code,
      result.token,
      user.password,
    ).valid,
    false,
  );
  assert.equal(
    otp.verifyPasswordResetToken(
      user.email,
      "12345",
      result.token,
      user.password,
    ).valid,
    false,
  );
  assert.equal(
    otp.verifyPasswordResetToken(
      user.email,
      result.code,
      `${result.token}.extra`,
      user.password,
    ).valid,
    false,
  );
});

test("public reset payload does not expose a digest permitting the previous offline six-digit attack", () => {
  const h = harness({ NC_SESSION_SECRET: SECRET });
  const otp = h.load("lib/otp.ts");
  const result = otp.generatePasswordResetToken(user.email, user.password);
  const payload = payloadOf(result.token);
  // An attacker knows email, salt and the entire token; even the correct offline guess must not match.
  const oldAttack = crypto
    .createHash("sha256")
    .update(`${result.code}:${payload.salt}:${user.email}`)
    .digest("hex");
  const unkeyedJsonAttack = crypto
    .createHash("sha256")
    .update(JSON.stringify([result.code, payload.salt, user.email]))
    .digest("hex");
  assert.notEqual(payload.codeHash, oldAttack);
  assert.notEqual(payload.codeHash, unkeyedJsonAttack);
  assert.notEqual(
    payload.codeHash,
    crypto
      .createHmac(
        "sha256",
        h.load("lib/signingKey.ts").getSigningKey("password-reset-token"),
      )
      .update(JSON.stringify([result.code, payload.salt, user.email]))
      .digest("hex"),
  );
  assert.equal(Object.values(payload).includes(result.code), false);
  assert.equal(
    otp.verifyPasswordResetToken(
      user.email,
      result.code,
      result.token,
      user.password,
    ).valid,
    true,
  );
});

test("reset verifier rejects correctly signed malformed, expired and legacy payloads", () => {
  const h = harness({ NC_SESSION_SECRET: SECRET });
  const otp = h.load("lib/otp.ts");
  const key = h.load("lib/signingKey.ts").getSigningKey("password-reset-token");
  const result = otp.generatePasswordResetToken(user.email, user.password);
  const payload = payloadOf(result.token);
  const now = Date.now();
  for (const change of [
    { expiresAt: null },
    { expiresAt: "tomorrow" },
    { expiresAt: now - 1 },
    { issuedAt: now + 120000 },
    { expiresAt: now + 11 * 60000 },
    { issuedAt: 0.1 },
    { salt: "" },
    { salt: [] },
    { codeHash: "abc" },
    { codeHash: null },
    { v: undefined },
  ]) {
    assert.equal(
      otp.verifyPasswordResetToken(
        user.email,
        result.code,
        sign({ ...payload, ...change }, key),
        user.password,
      ).valid,
      false,
    );
  }
  assert.equal(
    otp.verifyPasswordResetToken(
      user.email,
      result.code,
      sign(payload, PUBLIC_DEFAULT),
      user.password,
    ).valid,
    false,
  );
});

test("production email with missing credentials fails before opening a transport and never logs a code", async () => {
  const h = harness({ NODE_ENV: "production" });
  const email = h.load("lib/email.ts");
  assert.equal(email.isEmailConfigured(), false);
  const result = await email.sendPasswordResetEmail(
    user.email,
    "123456",
    user.name,
  );
  assert.equal(result.success, false);
  assert.equal(result.configurationError, true);
  assert.equal(result.devMode, undefined);
  assert.equal(h.transportCalls(), 0);
  assert.equal(h.logs.length, 0);
});

test("production reset route fails closed before account lookup when signing or mail is unavailable", async () => {
  for (const env of [
    { NODE_ENV: "production" },
    { NODE_ENV: "production", NC_SESSION_SECRET: SECRET },
  ]) {
    const h = harness(env);
    const response = await h
      .load("app/api/auth/send-reset-code/route.ts")
      .POST(resetRequest());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.devCode, undefined);
    assert.equal(body.resetToken, undefined);
    assert.equal(h.transportCalls(), 0);
    assert.equal(h.logs.length, 0);
  }
});

test("production route refuses a devMode result even when the email provider claims configuration", async () => {
  const h = harness(
    { NODE_ENV: "production", NC_SESSION_SECRET: SECRET },
    {
      "lib/users.ts": { getUser: async () => user },
      "lib/email.ts": {
        isEmailConfigured: () => true,
        sendPasswordResetEmail: async () => ({ success: true, devMode: true }),
      },
    },
  );
  const response = await h
    .load("app/api/auth/send-reset-code/route.ts")
    .POST(resetRequest());
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.devCode, undefined);
  assert.equal(body.resetToken, undefined);
  assert.equal(h.logs.length, 0);
});

test("local development reset response remains usable without sending email", async () => {
  const h = harness(
    { NODE_ENV: "development", NC_SESSION_SECRET: SECRET },
    { "lib/users.ts": { getUser: async () => user } },
  );
  const response = await h
    .load("app/api/auth/send-reset-code/route.ts")
    .POST(resetRequest());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.devMode, true);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(body.devCode, /^\d{6}$/);
  assert.equal(
    h
      .load("lib/otp.ts")
      .verifyPasswordResetToken(
        user.email,
        body.devCode,
        body.resetToken,
        user.password,
      ).valid,
    true,
  );
  assert.equal(h.transportCalls(), 0);
  assert.equal(h.logs.length, 0);
});

test("anonymous auth readiness returns uncached 503 for missing signing config and 401 when ready", async () => {
  for (const [env, expected] of [
    [{}, 503],
    [{ NC_SESSION_SECRET: SECRET }, 401],
    [{ CRON_SECRET }, 401],
  ]) {
    const response = await harness(env).load("app/api/auth/me/route.ts").GET();
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Cookie");
    const body = await response.json();
    assert.equal(body.session, null);
    if (expected === 503)
      assert.equal(body.code, "AUTH_CONFIGURATION_UNAVAILABLE");
  }
});

test("password state binding rejects reuse across instances after any password change", () => {
  const first = harness({ NC_SESSION_SECRET: SECRET }).load("lib/otp.ts");
  const second = harness({ NC_SESSION_SECRET: SECRET }).load("lib/otp.ts");
  const generated = first.generatePasswordResetToken(user.email, user.password);
  const payload = payloadOf(generated.token);
  assert.equal(payload.passwordHash, undefined);
  assert.equal(Object.values(payload).includes(user.password), false);
  assert.notEqual(
    payload.passwordVersion,
    crypto.createHash("sha256").update(user.password).digest("hex"),
  );
  assert.equal(
    second.verifyPasswordResetToken(
      user.email,
      generated.code,
      generated.token,
      user.password,
    ).valid,
    true,
  );
  assert.equal(
    second.verifyPasswordResetToken(
      user.email,
      generated.code,
      generated.token,
      "synthetic-bcrypt-hash-after-reset",
    ).valid,
    false,
  );
  assert.equal(
    second.verifyPasswordResetToken(
      user.email,
      generated.code,
      generated.token,
      undefined,
    ).valid,
    false,
  );
  assert.throws(() => first.generatePasswordResetToken(user.email, undefined));
});

test("reset endpoint supplies fresh password state to verification and atomic update, then rejects replay", async () => {
  let storedPassword = user.password;
  let lookupCalls = 0;
  let resetCalls = 0;
  const h = harness(
    { NODE_ENV: "production", NC_SESSION_SECRET: SECRET },
    {
      "lib/users.ts": {
        getUser: async (email, options) => {
          assert.equal(email, user.email);
          assert.equal(options.bypassCache, true);
          lookupCalls++;
          return { ...user, password: storedPassword };
        },
        resetUserPassword: async (email, newPassword, expectedPasswordHash) => {
          assert.equal(email, user.email);
          assert.equal(newPassword, "new-local-test-value");
          assert.equal(expectedPasswordHash, storedPassword);
          resetCalls++;
          storedPassword = "synthetic-bcrypt-hash-after-reset";
        },
      },
    },
  );
  const generated = h
    .load("lib/otp.ts")
    .generatePasswordResetToken(user.email, user.password);
  const request = () =>
    new Request("https://test.invalid/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        code: generated.code,
        resetToken: generated.token,
        newPassword: "new-local-test-value",
        confirmPassword: "new-local-test-value",
      }),
    });
  const route = h.load("app/api/auth/reset-password/route.ts");
  const first = await route.POST(request());
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  const second = await route.POST(request());
  assert.equal(second.status, 400);
  assert.equal(lookupCalls, 2);
  assert.equal(resetCalls, 1);
  assert.equal(h.logs.length, 0);
});
