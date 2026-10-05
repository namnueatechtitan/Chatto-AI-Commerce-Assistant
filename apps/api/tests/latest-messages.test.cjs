const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFixture, createFixtureApp } = require('./helpers/latest-messages-fixture.cjs');

test('latest messages authenticate sessions before tenant validation without querying messages', async (t) => {
  const fixture = createFixture(), app = await createFixtureApp(fixture);
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const base = await app.getUrl(), path = '/conversations/messages/latest';
  for (const [name, token] of [['anonymous', null], ['invalid', 'z'.repeat(43)], ['malformed cookie', 'invalid'], ['expired', fixture.tokens.expired], ['inactive user', fixture.tokens.inactive]]) {
    await t.test(name, async () => {
      for (const query of ['', `?merchantId=${fixture.merchants.a.id}`]) {
        assert.equal((await fetch(base + path + query, { headers: token ? { Cookie: `chatto_session=${token}` } : {} })).status, 401);
      }
      assert.equal(fixture.queries.length, 0);
    });
  }
  for (const query of ['', '?merchantId=invalid', '?merchantId=', `?merchantId=${fixture.merchants.a.id}&merchantId=${fixture.merchants.b.id}`]) {
    assert.equal((await fetch(base + path + query, { headers: { Cookie: `chatto_session=${fixture.tokens.a}` } })).status, 400);
  }
  assert.equal(fixture.queries.length, 0);
});

test('latest messages enforce membership and tenant relations, safe output, ordering and the 20-record bound', async (t) => {
  const fixture = createFixture(), app = await createFixtureApp(fixture);
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const base = await app.getUrl();
  const request = (name, merchantId, extra = '') => fetch(`${base}/conversations/messages/latest?merchantId=${merchantId}${extra}`, { headers: { Cookie: `chatto_session=${fixture.tokens[name]}` } });
  await t.test('foreign and nonexistent merchants both return 404 before message retrieval', async () => {
    for (const id of [fixture.merchants.b.id, 'ffffffff-ffff-4fff-8fff-ffffffffffff']) {
      const response = await request('a', id, `&userId=${fixture.users.b.id}&role=Owner`);
      assert.equal(response.status, 404);
      assert.equal((await response.json()).message, 'Merchant not found');
    }
    assert.equal(fixture.queries.length, 0);
  });
  await t.test('authorized A contains only A data, excludes broken relations and returns the existing DTO', async () => {
    const response = await request('a', fixture.merchants.a.id);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const result = await response.json();
    assert.equal(result.length, 20);
    assert.equal(result[0].message, 'Merchant A message 25');
    assert.equal(result.at(-1).message, 'Merchant A message 6');
    assert.ok(result.every((item) => item.message.startsWith('Merchant A message') && item.customerName === 'Merchant A customer'));
    for (const item of result) assert.deepEqual(Object.keys(item).sort(), ['channel', 'customerName', 'id', 'message', 'timestamp', 'unread']);
    const query = fixture.queries.at(-1);
    for (const scoped of [query.where, query.where.conversation, query.where.conversation.customer, query.where.conversation.channel]) {
      assert.equal(scoped.merchantId, fixture.merchants.a.id);
    }
  });
  await t.test('multiple memberships read A and B separately, and an empty merchant remains empty', async () => {
    const a = await (await request('multi', fixture.merchants.a.id)).json();
    const b = await (await request('multi', fixture.merchants.b.id)).json();
    assert.equal(a.length, 20); assert.equal(b.length, 2);
    assert.ok(b.every((item) => item.message.startsWith('Merchant B message')));
    assert.deepEqual(await (await request('multi', fixture.merchants.empty.id)).json(), []);
  });
  await t.test('inactive and suspended memberships cannot read', async () => {
    const membership = fixture.memberships.find((item) => item.userId === fixture.users.a.id);
    for (const status of ['INACTIVE', 'SUSPENDED']) {
      membership.status = status;
      const count = fixture.queries.length;
      assert.equal((await request('a', fixture.merchants.a.id)).status, 404);
      assert.equal(fixture.queries.length, count);
    }
    membership.status = 'ACTIVE';
  });
  await t.test('equal timestamps have deterministic descending ID order', async () => {
    const b = fixture.messages.filter((item) => item.merchantId === fixture.merchants.b.id);
    b.forEach((item) => { item.createdAt = new Date(1700000000000); });
    const result = await (await request('b', fixture.merchants.b.id)).json();
    assert.deepEqual(result.map((item) => item.id), b.map((item) => item.id).sort().reverse());
  });
  await t.test('existing read policy allows active members of disabled merchants and non-Owner roles', async () => {
    const membership = fixture.memberships.find((item) => item.userId === fixture.users.multi.id && item.merchantId === fixture.merchants.a.id);
    membership.role.status = 'inactive';
    for (const status of ['INACTIVE', 'SUSPENDED']) {
      fixture.merchants.a.status = status;
      assert.equal((await request('multi', fixture.merchants.a.id)).status, 200);
    }
    // Existing read authorization does not evaluate role.status; A1 does not introduce a new role policy.
  });
});
