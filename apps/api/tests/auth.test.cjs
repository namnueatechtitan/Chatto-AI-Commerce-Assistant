const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
require("reflect-metadata");
const { GoogleAuthService } = require("../dist/auth/google-auth.service");
const { AuthSessionService, hashToken } = require("../dist/auth/auth-session.service");
const { AuthController } = require("../dist/auth/auth.controller");
const { cookieOptions, requireWebOrigin, readCookie } = require("../dist/auth/auth-http");

beforeEach(() => {
  process.env.NODE_ENV = "test";
  process.env.WEB_URL = "http://localhost:3000";
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";
});

// In-memory DB double and fake Google transport: no credentials/network needed.
function fixture() {
  let attempt;
  let existing = null;
  let emailOwner = null;
  let identity;
  let exchanges = 0;
  const users = [];
  const prisma = {
    googleOAuthAttempt: {
      create: async ({ data }) => { attempt = data; },
      findFirst: async ({ where }) => attempt && attempt.stateHash === where.stateHash &&
        attempt.browserHash === where.browserHash && attempt.expiresAt > where.expiresAt.gt ? attempt : null,
      deleteMany: async ({ where }) => {
        const matches = attempt && (where.stateHash ? attempt.stateHash === where.stateHash &&
          attempt.browserHash === where.browserHash && attempt.expiresAt > where.expiresAt.gt
          : attempt.expiresAt <= where.expiresAt.lte);
        if (matches) { attempt = undefined; return { count: 1 }; }
        return { count: 0 };
      },
    },
    user: {
      findUnique: async () => existing,
      findFirst: async () => emailOwner,
      create: async ({ data }) => { users.push(data); return { id: "new-user", status: "ACTIVE", ...data }; },
    },
  };
  const service = new GoogleAuthService(prisma);
  return {
    service, users,
    get attempt() { return attempt; },
    get exchanges() { return exchanges; },
    set existing(value) { existing = value; },
    set emailOwner(value) { emailOwner = value; },
    async start(overrides = {}) {
      const flow = await service.start();
      const state = new URL(flow.url).searchParams.get("state");
      identity = { sub: "google-subject", email: "USER@example.com", email_verified: true, name: "User", nonce: attempt.nonce, ...overrides };
      // TypeScript private is compiled to a normal method; replace only transport.
      service.client = () => ({
        getToken: async ({ codeVerifier }) => {
          exchanges++;
          assert.equal(codeVerifier.length, 43);
          return { tokens: { id_token: "test-id-token" } };
        },
        verifyIdToken: async ({ audience }) => {
          assert.equal(audience, "test-client");
          return { getPayload: () => identity };
        },
      });
      return { ...flow, state };
    },
  };
}

test("authorization request has PKCE, nonce and browser-bound hashed state", async () => {
  const f = fixture();
  const flow = await f.start();
  const params = new URL(flow.url).searchParams;
  assert.equal(params.get("code_challenge_method"), "S256");
  assert.equal(params.get("code_challenge"), createHash("sha256").update(f.attempt.verifier).digest("base64url"));
  assert.equal(params.get("nonce"), f.attempt.nonce);
  assert.equal(f.attempt.stateHash, hashToken(flow.state));
  assert.equal(f.attempt.browserHash, hashToken(flow.browserToken));
  assert.equal(params.get("redirect_uri"), process.env.GOOGLE_REDIRECT_URI);
});

test("missing config fails before storing a flow", async () => {
  const f = fixture();
  process.env.GOOGLE_CLIENT_SECRET = "";
  await assert.rejects(f.service.start(), { status: 503 });
  assert.equal(f.attempt, undefined);
});

test("valid callback creates a Google-only account; replay is rejected", async () => {
  const f = fixture();
  const flow = await f.start();
  const user = await f.service.complete(flow.state, flow.browserToken, "code");
  assert.equal(user.googleId, "google-subject");
  assert.equal(user.email, "user@example.com");
  assert.equal(user.passwordHash, undefined);
  await assert.rejects(f.service.complete(flow.state, flow.browserToken, "code"), { status: 401 });
  assert.equal(f.exchanges, 1);
  assert.equal(f.users.length, 1);
});

for (const kind of ["missing-state", "wrong-state", "wrong-browser", "expired"]) {
  test(`rejects ${kind} without exchanging a code`, async () => {
    const f = fixture();
    const flow = await f.start();
    if (kind === "expired") f.attempt.expiresAt = new Date(0);
    const state = kind === "missing-state" ? undefined : kind === "wrong-state" ? "x".repeat(43) : flow.state;
    const browser = kind === "wrong-browser" ? "x".repeat(43) : flow.browserToken;
    await assert.rejects(f.service.complete(state, browser, "code"), { status: 401 });
    assert.equal(f.exchanges, 0);
  });
}

for (const overrides of [{ nonce: "wrong" }, { email_verified: false }, { sub: "" }]) {
  test(`rejects invalid identity ${JSON.stringify(overrides)}`, async () => {
    const f = fixture();
    const flow = await f.start(overrides);
    await assert.rejects(f.service.complete(flow.state, flow.browserToken, "code"), { status: 401 });
    assert.equal(f.users.length, 0);
  });
}

test("cancelled consent consumes state without creating a user", async () => {
  const f = fixture();
  const flow = await f.start();
  await assert.rejects(f.service.complete(flow.state, flow.browserToken, undefined, "access_denied"), { status: 401 });
  assert.equal(f.attempt, undefined);
  assert.equal(f.exchanges, 0);
});

test("matching email does not auto-link a password account", async () => {
  const f = fixture();
  const flow = await f.start();
  f.emailOwner = { id: "password-user" };
  await assert.rejects(f.service.complete(flow.state, flow.browserToken, "code"), { status: 409 });
  assert.equal(f.users.length, 0);
});

test("existing Google user is reused; suspended user is rejected", async () => {
  for (const status of ["ACTIVE", "SUSPENDED"]) {
    const f = fixture();
    const flow = await f.start();
    f.existing = { id: "existing-user", status };
    const login = f.service.complete(flow.state, flow.browserToken, "code");
    if (status === "ACTIVE") assert.equal((await login).id, "existing-user");
    else await assert.rejects(login, { status: 401 });
    assert.equal(f.users.length, 0);
  }
});

test("session creation stores only hash and rotates previous token", async () => {
  let saved, removed;
  const sessions = new AuthSessionService({
    authSession: {
      create: ({ data }) => { saved = data; return Promise.resolve(data); },
      deleteMany: ({ where }) => { removed = where; return Promise.resolve({ count: 1 }); },
    },
    $transaction: (operations) => Promise.all(operations),
  });
  const token = await sessions.create("user-id", "previous-token");
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(saved.tokenHash, hashToken(token));
  assert.equal(saved.token, undefined);
  assert.equal(removed.OR[1].tokenHash, hashToken("previous-token"));
});

test("profile rejects missing, expired and inactive sessions; logout revokes", async () => {
  let row = null;
  let revoked;
  const sessions = new AuthSessionService({ authSession: {
    findUnique: async () => row,
    deleteMany: async ({ where }) => { revoked = where; row = null; },
  } });
  await assert.rejects(sessions.profile(), { status: 401 });
  await assert.rejects(sessions.profile("token"), { status: 401 });
  row = { expiresAt: new Date(0), user: { status: "ACTIVE" } };
  await assert.rejects(sessions.profile("token"), { status: 401 });
  row = { expiresAt: new Date(Date.now() + 10000), user: { status: "SUSPENDED" } };
  await assert.rejects(sessions.profile("token"), { status: 401 });
  row.user.status = "ACTIVE";
  assert.equal((await sessions.profile("token")).user.status, "ACTIVE");
  await sessions.revoke("token");
  assert.equal(revoked.tokenHash, hashToken("token"));
  await assert.rejects(sessions.profile("token"), { status: 401 });
});

test("auth controller exposes no password login or registration routes", () => {
  const routes = Object.getOwnPropertyNames(AuthController.prototype)
    .filter(name => name !== "constructor")
    .map(name => Reflect.getMetadata("path", AuthController.prototype[name]));
  assert.ok(routes.includes("google"));
  assert.ok(routes.includes("google/callback"));
  assert.ok(!routes.includes("login"));
  assert.ok(!routes.includes("register"));
});

test("CSRF origin checks and secure cookie configuration", () => {
  assert.throws(() => requireWebOrigin({ headers: {} }), { status: 403 });
  assert.throws(() => requireWebOrigin({ headers: { origin: "https://other.example" } }), { status: 403 });
  requireWebOrigin({ headers: { origin: "http://localhost:3000" } });
  assert.equal(cookieOptions().httpOnly, true);
  assert.equal(cookieOptions().sameSite, "lax");
  assert.equal(cookieOptions().secure, false);
  process.env.WEB_URL = "https://chatto.example";
  assert.equal(cookieOptions().secure, true);
  assert.equal(readCookie({ headers: { cookie: "chatto_session=malformed" } }, "chatto_session"), undefined);
});
