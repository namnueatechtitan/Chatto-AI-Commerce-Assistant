// In-memory fixtures only. Never constructs PrismaClient or opens a database connection.
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { Module } = require('@nestjs/common');
const { AuthSessionService, hashToken } = require('../../dist/auth/auth-session.service');
const { AuthController } = require('../../dist/auth/auth.controller');
const { GoogleAuthService } = require('../../dist/auth/google-auth.service');
const { LineAuthService } = require('../../dist/auth/line-auth.service');
const { MerchantsService, MerchantsController } = require('../../dist/modules/merchants.module');
const { ConversationsService } = require('../../dist/modules/conversations/conversations.service');
const { ConversationsController } = require('../../dist/modules/conversations/conversations.controller');

function matches(record, where) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = record?.[key];
    if (expected && typeof expected === 'object') {
      if ('equals' in expected) return expected.mode === 'insensitive'
        ? String(actual).toLowerCase() === expected.equals.toLowerCase() : actual === expected.equals;
      return matches(actual, expected.is ?? expected);
    }
    return actual === expected;
  });
}

function project(record, select) {
  return Object.fromEntries(Object.entries(select).filter(([, value]) => value).map(([key, value]) => [
    key, value === true ? record[key] : project(record[key], value.select),
  ]));
}

function createFixture() {
  const merchant = (name) => ({ id: randomUUID(), shopName: name, slug: name, status: 'TRIAL', businessCategory: 'flowers', operatingHours: '09:00–18:00' });
  const merchants = { a: merchant('Merchant A'), b: merchant('Merchant B'), empty: merchant('Empty merchant') };
  const user = (name, status = 'ACTIVE') => ({ id: randomUUID(), name, email: null, globalRole: 'merchant_user', status });
  const users = { a: user('User A'), b: user('User B'), multi: user('Multi merchant user'), inactive: user('Inactive user', 'INACTIVE'), expired: user('Expired session user') };
  const tokens = Object.fromEntries(Object.keys(users).map((name, i) => [name, String.fromCharCode(97 + i).repeat(43)]));
  const sessions = new Map(Object.entries(users).map(([name, value]) => [hashToken(tokens[name]), {
    user: value, expiresAt: new Date(Date.now() + (name === 'expired' ? -60000 : 3600000)),
  }]));
  const member = (user, merchant, role = 'Owner') => ({ userId: user.id, merchantId: merchant.id, user, merchant, role: { name: role, status: 'active' }, status: 'ACTIVE' });
  const memberships = [member(users.a, merchants.a), member(users.b, merchants.b), member(users.multi, merchants.a, 'Staff'), member(users.multi, merchants.b), member(users.multi, merchants.empty)];
  const message = (merchant, index, overrides = {}) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    merchantId: merchant.id, senderType: 'CUSTOMER', messageType: 'TEXT',
    content: `${merchant.shopName} message ${index}`, createdAt: new Date(1700000000000 + index * 1000),
    metadata: { internal: 'must not be returned' }, senderId: randomUUID(),
    conversation: { id: randomUUID(), merchantId: merchant.id,
      customer: { merchantId: merchant.id, displayName: `${merchant.shopName} customer`, externalUserId: 'fixture-customer', profilePictureUrl: null, email: 'private@example.test' },
      channel: { merchantId: merchant.id, platform: { code: 'LINE' }, channelSecretEncrypted: 'must not be returned' },
    }, ...overrides,
  });
  const messages = [
    ...Array.from({ length: 25 }, (_, i) => message(merchants.a, i + 1)),
    message(merchants.b, 40), message(merchants.b, 41),
    message(merchants.b, 90, { merchantId: merchants.a.id }),
    message(merchants.a, 91, { conversation: { ...message(merchants.a, 91).conversation, customer: message(merchants.b, 91).conversation.customer } }),
    message(merchants.a, 92, { conversation: { ...message(merchants.a, 92).conversation, channel: message(merchants.b, 92).conversation.channel } }),
    message(merchants.a, 93, { senderType: 'AI' }),
    message(merchants.a, 94, { messageType: 'IMAGE' }),
  ];
  const queries = [];
  const fixture = { merchants, users, tokens, sessions, memberships, messages, queries, delay: 0, logoutDelay: 0, requests: [], mutations: [] };
  const prisma = {
    authSession: {
      findUnique: async ({ where }) => sessions.get(where.tokenHash) ?? null,
      deleteMany: async ({ where }) => {
        if (fixture.logoutDelay) await new Promise((resolve) => setTimeout(resolve, fixture.logoutDelay));
        return { count: Number(sessions.delete(where.tokenHash)) };
      },
    },
    merchantUser: {
      findUnique: async ({ where, select }) => {
        const found = memberships.find((record) => matches(record, where.merchantId_userId));
        return found ? project(found, select) : null;
      },
      findMany: async ({ where, select }) => memberships.filter((record) => matches(record, where)).map((record) => project(record, select)),
    },
    message: { findMany: async (query) => {
      queries.push(query);
      if (fixture.delay) await new Promise((resolve) => setTimeout(resolve, fixture.delay));
      return messages.filter((record) => matches(record, query.where)).sort((a, b) => {
        for (const order of query.orderBy) {
          const [field, direction] = Object.entries(order)[0];
          const comparison = a[field] instanceof Date ? a[field] - b[field] : String(a[field]).localeCompare(String(b[field]));
          if (comparison) return direction === 'desc' ? -comparison : comparison;
        }
        return 0;
      }).slice(0, query.take).map((record) => project(record, query.select));
    } },
  };
  fixture.auth = new AuthSessionService(prisma);
  fixture.merchantService = new MerchantsService(prisma);
  fixture.conversationService = new ConversationsService(prisma, fixture.merchantService);
  return fixture;
}

async function createFixtureApp(fixture) {
  class TestModule {}
  Module({ controllers: [ConversationsController, AuthController, MerchantsController], providers: [
    { provide: ConversationsService, useValue: fixture.conversationService },
    { provide: AuthSessionService, useValue: fixture.auth },
    { provide: MerchantsService, useValue: fixture.merchantService },
    { provide: GoogleAuthService, useValue: {} }, { provide: LineAuthService, useValue: {} },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.use((request, _response, next) => {
    fixture.requests.push(request.url);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) fixture.mutations.push({ method: request.method, url: request.url });
    next();
  });
  return app;
}

module.exports = { createFixture, createFixtureApp };
