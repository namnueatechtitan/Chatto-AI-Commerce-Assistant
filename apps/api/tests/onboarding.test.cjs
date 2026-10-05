const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NestFactory } = require("@nestjs/core");
const { Module, ValidationPipe } = require("@nestjs/common");
const { AuthSessionService, hashToken } = require("../dist/auth/auth-session.service");
const { AuthController } = require("../dist/auth/auth.controller");
const { MerchantsService } = require("../dist/modules/merchants.module");
const { StoreInformationService } = require("../dist/modules/store-information/store-information.service");
const { OnboardingService } = require("../dist/modules/onboarding/onboarding.service");
const { OnboardingController } = require("../dist/modules/onboarding/onboarding.controller");
const { buildOnboardingProgress } = require("../dist/modules/onboarding/onboarding-status");

const store = { id: "0aa80d25-a3c7-4d84-8f58-f12741b47061", shopName: "Test shop", slug: "test", status: "TRIAL", businessCategory: "flowers", operatingHours: "09:30–18:00" };
const otherStore = { ...store, id: "fdfb94e3-354b-47f5-b7d7-c8e00e257af1" };
const user = { id: "55f55778-6df2-4530-a5a3-5c691b4de45e", name: "Authenticated LINE Name", email: null, status: "ACTIVE", globalRole: "merchant_user" };
const token = "s".repeat(43);

test("all six progress values are rounded from confirmed prerequisites", () => {
  for (let count = 2; count <= 6; count++) {
    const readiness = Object.fromEntries(["store", "line", "context", "activation"].map((key, i) => [key, i < count - 2]));
    const status = buildOnboardingProgress(readiness);
    assert.equal(status.steps.length, 6);
    assert.equal(status.completedSteps, count);
    assert.equal(status.progress, [33, 50, 67, 83, 100][count - 2]);
    assert.equal(status.steps.filter((step) => step.state === "current").length, count === 6 ? 0 : 1);
    assert.equal(status.complete, count === 6);
  }
  const locked = buildOnboardingProgress({ store: true, line: false, context: true, activation: true });
  assert.deepEqual(locked.steps.map((step) => step.state), ["completed", "completed", "completed", "current", "pending", "pending"]);
});

test("status queries only an accessible store and requires knowledge plus configuration", async () => {
  const queries = [];
  let product = null;
  let documents = [];
  let settings = { botName: "Chatto", language: "th" };
  const prisma = {
    $queryRawUnsafe: async () => [{ id: "canonical-line-platform" }],
    channel: { findFirst: async (query) => { queries.push(query); return { id: "channel" }; } },
    aiSetting: { findUnique: async (query) => { queries.push(query); return settings; } },
    product: { findFirst: async (query) => { queries.push(query); return product; } },
    knowledgeBaseDocument: { findMany: async (query) => { queries.push(query); return documents; } },
  };
  const service = new OnboardingService(prisma, { findForUser: async (id) => {
    assert.equal(id, user.id);
    return [{ merchant: store, role: { name: "Owner" } }];
  } });
  const empty = await service.status(user.id, store.id);
  assert.equal(empty.progress, 67);
  documents = [{ content: "  " }];
  assert.equal((await service.status(user.id, store.id)).progress, 67);
  documents = [{ content: "Shop FAQ" }];
  const ready = await service.status(user.id, store.id);
  assert.equal(ready.progress, 83);
  assert.equal(ready.steps[5].state, "current");
  assert.equal(ready.complete, false);
  assert.equal(ready.capabilities.activation, false);
  assert.equal(ready.role, "Owner");
  settings = null;
  product = { id: "product" };
  assert.equal((await service.status(user.id, store.id)).progress, 67);
  settings = { botName: "Chatto", language: "th" };
  assert.equal((await service.status(user.id, store.id)).progress, 83);
  for (const query of queries) assert.equal(query.where.merchantId, store.id);
  const channelQuery = queries[0];
  assert.equal(channelQuery.where.status, "CONNECTED");
  assert.equal(channelQuery.where.isConnected, true);
  assert.equal(channelQuery.where.platformId, "canonical-line-platform");
  assert.deepEqual(channelQuery.where.credentialRevision, { gt: 0 });
  assert.deepEqual(channelQuery.select, { id: true });
  const count = queries.length;
  await assert.rejects(service.status(user.id, otherStore.id), (error) => error.getStatus() === 404);
  assert.equal(queries.length, count, "inaccessible stores are rejected before readiness queries");
});

test("a new user remains at 33%, reads never create records, and suspended stores cannot advance", async () => {
  const prisma = new Proxy({}, { get() { throw new Error("Unexpected database query or mutation"); } });
  const service = new OnboardingService(prisma, { findForUser: async () => [] });
  assert.equal((await service.status(user.id)).progress, 33);
  assert.equal((await service.status(user.id)).progress, 33);
  const suspended = new OnboardingService(prisma, { findForUser: async () => [{ merchant: { ...store, status: "SUSPENDED" }, role: { name: "Owner" } }] });
  assert.equal((await suspended.status(user.id)).progress, 33);
});

test("first-store creation reuses membership on retry and serializes concurrent requests", async () => {
  let membership = null;
  let creates = 0;
  let previous = Promise.resolve();
  const tx = {
    $executeRaw: async () => 1,
    merchantUser: { findFirst: async () => membership },
    role: { findFirst: async () => ({ id: "owner-role" }) },
    merchant: { create: async (query) => {
      creates++;
      assert.equal(query.data.merchantUsers.create.userId, user.id);
      membership = { merchant: store };
      return store;
    } },
  };
  const service = new MerchantsService({ $transaction: (callback) => {
    const request = previous.then(() => callback(tx));
    previous = request.catch(() => {});
    return request;
  } });
  const results = await Promise.all([service.createForOnboarding(user.id, "Test shop"), service.createForOnboarding(user.id, "Test shop")]);
  assert.equal(creates, 1);
  assert.equal(results[0].id, results[1].id);
  assert.equal((await service.createForOnboarding(user.id, "Retry")).id, store.id);
  assert.equal(creates, 1);
});

test("HTTP endpoint validates sessions and store IDs without exposing other merchants or secrets", async () => {
  let expired = false;
  const sessions = new AuthSessionService({ authSession: { findUnique: async ({ where }) => where.tokenHash === hashToken(token)
    ? { expiresAt: new Date(Date.now() + (expired ? -1000 : 60000)), user } : null } });
  const onboarding = new OnboardingService({}, { findForUser: async () => [] });
  class TestModule {}
  Module({ controllers: [OnboardingController], providers: [
    { provide: AuthSessionService, useValue: sessions },
    { provide: OnboardingService, useValue: onboarding },
    { provide: StoreInformationService, useValue: { create: async () => ({ merchant: store, faqs: [], canEdit: true }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, "127.0.0.1");
  const origin = await app.getUrl();
  const request = (path = "/onboarding/status", init = {}) => fetch(`${origin}${path}`, { headers: { Cookie: `chatto_session=${token}` }, ...init });
  try {
    assert.equal((await fetch(`${origin}/onboarding/status`)).status, 401);
    assert.equal((await request("/onboarding/status?merchantId=invalid")).status, 400);
    assert.equal((await request(`/onboarding/status?merchantId=${otherStore.id}`)).status, 404);
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.equal(data.user.name, user.name);
    assert.equal(data.progress, 33);
    assert.equal(data.merchant, null);
    assert.ok(!JSON.stringify(data).includes(token));
    assert.ok(!JSON.stringify(data).includes("Encrypted"));
    expired = true;
    assert.equal((await request()).status, 401);
    expired = false;
    const invalidOrigin = await request("/onboarding/store", { method: "POST", headers: { Cookie: `chatto_session=${token}`, Origin: "https://foreign.example", "Content-Type": "application/json" }, body: JSON.stringify({ shopName: "Test", businessCategory: "flowers", operatingHours: "09:00–18:00", requestId: crypto.randomUUID() }) });
    assert.equal(invalidOrigin.status, 403);
  } finally { await app.close(); }
});

test("Google and LINE callbacks set a session then route to onboarding; cancellations still return to login", async () => {
  const sessions = { create: async (id) => { assert.equal(id, user.id); return token; } };
  const provider = { complete: async () => user };
  const controller = new AuthController(sessions, provider, provider);
  for (const method of ["googleCallback", "lineCallback"]) {
    const cookies = [];
    let destination;
    const response = { setHeader() {}, clearCookie() {}, cookie(name, value, options) { cookies.push({ name, value, options }); }, redirect(url) { destination = url; } };
    await controller[method]({}, { headers: {} }, response);
    assert.ok(destination.endsWith("/onboarding"));
    assert.equal(cookies[0].name, "chatto_session");
    assert.equal(cookies[0].options.httpOnly, true);
  }
  const rejected = { complete: async () => { throw new Error("Cancelled"); } };
  const cancellation = new AuthController(sessions, rejected, rejected);
  for (const [method, reason] of [["googleCallback", "google_cancelled"], ["lineCallback", "line_cancelled"]]) {
    let destination;
    await cancellation[method]({ error: "access_denied" }, { headers: {} }, { setHeader() {}, clearCookie() {}, redirect(url) { destination = url; } });
    assert.ok(destination.endsWith(`/login?error=${reason}`));
  }
});
