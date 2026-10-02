// Opt-in PostgreSQL integration test. Every fixture is rolled back at the end.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { ConfigModule } = require("@nestjs/config");
const { PrismaClient } = require("@prisma/client");
const { AuthSessionService, hashToken } = require("../dist/auth/auth-session.service");
const { MerchantsService } = require("../dist/modules/merchants.module");
const { OnboardingService } = require("../dist/modules/onboarding/onboarding.service");

ConfigModule.forRoot({ envFilePath: ["../../.env", ".env"] });

test("PostgreSQL records determine progress, store isolation, first-store retries, and status after a new session", async () => {
  const prisma = new PrismaClient();
  const rollback = new Error("Rollback onboarding test fixtures");
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const database = new Proxy(tx, { get(target, key) {
        if (key === "$transaction") return (callback) => callback(target);
        return Reflect.get(target, key);
      } });
      const sessions = new AuthSessionService(database);
      const merchants = new MerchantsService(database);
      const onboarding = new OnboardingService(database, merchants);
      const user = await tx.user.create({ data: { id: randomUUID(), name: "Onboarding integration test", globalRole: "merchant_user" } });
      const outsider = await tx.user.create({ data: { id: randomUUID(), name: "Onboarding access test", globalRole: "merchant_user" } });
      assert.equal((await onboarding.status(user.id)).progress, 33);

      const store = await merchants.createForOnboarding(user.id, "Onboarding integration test shop");
      const retry = await merchants.createForOnboarding(user.id, "A repeated request");
      assert.equal(retry.id, store.id);
      assert.equal(await tx.merchantUser.count({ where: { userId: user.id } }), 1);
      assert.equal((await onboarding.status(user.id, store.id)).progress, 33, "legacy minimal stores must supply required information");
      await tx.merchant.update({ where: { id: store.id }, data: { businessCategory: "flowers", operatingHours: "09:00–18:00" } });
      assert.equal((await onboarding.status(user.id, store.id)).progress, 50);
      await assert.rejects(onboarding.status(outsider.id, store.id), (error) => error.getStatus() === 404);

      const platform = await tx.platform.findUnique({ where: { code: "line" } }) ?? await tx.platform.create({ data: { code: "line", name: "LINE", status: "active" } });
      const channel = await tx.channel.create({ data: {
        merchantId: store.id, platformId: platform.id, channelName: "Integration test", externalChannelId: randomUUID(),
        status: "CONNECTED", isConnected: true,
      } });
      assert.equal((await onboarding.status(user.id, store.id)).progress, 50, "flags without credentials do not complete LINE setup");
      await tx.channel.update({ where: { id: channel.id }, data: { accessTokenEncrypted: "test-only-placeholder", channelSecretEncrypted: "test-only-placeholder" } });
      assert.equal((await onboarding.status(user.id, store.id)).progress, 67);
      await tx.aiSetting.create({ data: { merchantId: store.id, botName: "Test Chatto", language: "th" } });
      const document = await tx.knowledgeBaseDocument.create({ data: { merchantId: store.id, type: "faq", title: "Test FAQ", content: "  " } });
      assert.equal((await onboarding.status(user.id, store.id)).progress, 67);
      await tx.knowledgeBaseDocument.update({ where: { id: document.id }, data: { content: "Store FAQ for integration testing" } });
      assert.equal((await onboarding.status(user.id, store.id)).progress, 83);
      await tx.merchant.update({ where: { id: store.id }, data: { status: "ACTIVE" } });
      assert.equal((await onboarding.status(user.id, store.id)).complete, false, "merchant ACTIVE is not AI activation");

      const token = randomBytes(32).toString("base64url");
      await tx.authSession.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60000) } });
      const profile = await sessions.profile(token);
      assert.equal(profile.user.name, user.name);
      assert.equal((await onboarding.status(profile.user.id, store.id)).progress, 83);
      await sessions.revoke(token);
      await assert.rejects(sessions.profile(token), (error) => error.getStatus() === 401);
      const nextToken = randomBytes(32).toString("base64url");
      await tx.authSession.create({ data: { userId: user.id, tokenHash: hashToken(nextToken), expiresAt: new Date(Date.now() + 60000) } });
      const nextProfile = await sessions.profile(nextToken);
      assert.equal((await onboarding.status(nextProfile.user.id, store.id)).progress, 83);
      await tx.channel.update({ where: { id: channel.id }, data: { status: "INVALID_TOKEN" } });
      assert.equal((await onboarding.status(user.id, store.id)).progress, 50, "a disconnected prerequisite locks later steps again");
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
  } finally { await prisma.$disconnect(); }
});
