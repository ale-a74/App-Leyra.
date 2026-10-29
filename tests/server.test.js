const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { attachRealtime, createApp, signInToken, validateConfig } = require('../server');
const { io: createSocketClient } = require('socket.io-client');

class MemoryDatabase {
  constructor() {
    this.values = new Map();
  }

  async query(sql, params = []) {
    if (sql.startsWith('SELECT 1')) return { rows: [{ '?column?': 1 }] };
    if (sql.startsWith('SELECT key, value FROM app_state')) {
      return { rows: [...this.values].map(([key, value]) => ({ key, value })) };
    }
    if (sql.startsWith('SELECT COUNT(*)')) return { rows: [{ count: this.values.size }] };
    if (sql.startsWith('INSERT INTO app_state')) {
      this.values.set(params[0], JSON.parse(params[1]));
      return { rows: [] };
    }
    return { rows: [] };
  }

  async connect() {
    return {
      query: (sql, params) => this.query(sql, params),
      release() {}
    };
  }
}

test('authenticated API initializes, reads, and updates shared data', async t => {
  const db = new MemoryDatabase();
  const appPassword = 'un-password-largo-de-prueba';
  const jwtSecret = 'test-secret-with-more-than-thirty-two-bytes';
  let io;
  const { app, corsOptions } = createApp({
    db,
    appPassword,
    jwtSecret,
    getIo: () => io
  });
  const server = http.createServer(app);
  io = attachRealtime(server, { jwtSecret, corsOptions });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => io.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);

  const fileOriginPreflight = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'null',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  assert.equal(fileOriginPreflight.status, 204);
  assert.equal(fileOriginPreflight.headers.get('access-control-allow-origin'), 'null');

  const homepage = await fetch(baseUrl);
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /Leyra Seguridad/);

  const frontendScript = await fetch(`${baseUrl}/js/cloud-sync.js`);
  assert.equal(frontendScript.status, 200);
  assert.match(await frontendScript.text(), /cloud:data:update/);

  const denied = await fetch(`${baseUrl}/api/data`);
  assert.equal(denied.status, 401);

  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password' })
  });
  assert.equal(badLogin.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: appPassword })
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const authorization = { Authorization: `Bearer ${token}` };

  const bootstrap = await fetch(`${baseUrl}/api/data/bootstrap`, {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { clients: [{ id: 'client-1', name: 'Cliente de prueba' }] } })
  });
  assert.equal(bootstrap.status, 201);

  const repeatedBootstrap = await fetch(`${baseUrl}/api/data/bootstrap`, {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { clients: [] } })
  });
  assert.equal(repeatedBootstrap.status, 409);

  const socket = createSocketClient(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 3000
  });
  t.after(() => socket.close());
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  const updateEvent = new Promise(resolve => socket.once('cloud:data:update', resolve));
  const update = await fetch(`${baseUrl}/api/data/clients`, {
    method: 'PUT',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: [{ id: 'client-2', name: 'Actualizado' }] })
  });
  assert.equal(update.status, 200);
  assert.deepEqual(await updateEvent, {
    key: 'clients',
    value: [{ id: 'client-2', name: 'Actualizado' }]
  });

  const unknownKey = await fetch(`${baseUrl}/api/data/arbitrary`, {
    method: 'PUT',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'no permitido' })
  });
  assert.equal(unknownKey.status, 400);

  const data = await fetch(`${baseUrl}/api/data`, { headers: authorization });
  assert.deepEqual((await data.json()).data.clients, [{ id: 'client-2', name: 'Actualizado' }]);
});

test('authentication secrets are required and sign-in is constant-length', () => {
  assert.throws(() => validateConfig({}), /Faltan variables/);
  assert.throws(() => validateConfig({
    DATABASE_URL: 'postgresql://localhost/app',
    APP_PASSWORD: 'short',
    JWT_SECRET: 'a'.repeat(32)
  }), /APP_PASSWORD/);
  assert.equal(signInToken('invalid', 'expected-password', 'a'.repeat(32)), null);
});
