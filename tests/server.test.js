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

  const emptyBootstrap = await fetch(`${baseUrl}/api/data/bootstrap`, {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {} })
  });
  assert.equal(emptyBootstrap.status, 400);

  const initialData = {
    clients: [{ id: 'client-1', name: 'Cliente de prueba' }],
    orders: [],
    inventory: [],
    inventoryCategories: [],
    objects: [],
    quotes: [],
    quoteServices: [],
    quoteKits: [],
    quoteBranding: { businessName: 'Leyra Seguridad' }
  };
  const bootstrap = await fetch(`${baseUrl}/api/data/bootstrap`, {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: initialData })
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

  const quoteKits = [{ id: 'kit-test', name: 'Kit de prueba', items: [] }];
  const kitUpdateEvent = new Promise(resolve => socket.once('cloud:data:update', resolve));
  const kitUpdate = await fetch(`${baseUrl}/api/data/quoteKits`, {
    method: 'PUT',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: quoteKits })
  });
  assert.equal(kitUpdate.status, 200);
  assert.deepEqual(await kitUpdateEvent, { key: 'quoteKits', value: quoteKits });

  const unknownKey = await fetch(`${baseUrl}/api/data/arbitrary`, {
    method: 'PUT',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'no permitido' })
  });
  assert.equal(unknownKey.status, 400);

  const data = await fetch(`${baseUrl}/api/data`, { headers: authorization });
  const savedData = (await data.json()).data;
  assert.deepEqual(savedData.clients, [{ id: 'client-2', name: 'Actualizado' }]);
  assert.deepEqual(savedData.quoteKits, quoteKits);
  assert.deepEqual(Object.keys(savedData).sort(), Object.keys(initialData).sort());
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

test('private desktop update assets are proxied from the latest GitHub release', async t => {
  const requests = [];
  const release = {
    assets: [
      { id: 1, name: 'latest.yml', url: 'https://api.github.com/assets/1' },
      { id: 2, name: 'Leyra Seguridad Setup 1.0.1.exe', url: 'https://api.github.com/assets/2' }
    ]
  };
  const fetchImplementation = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/releases/latest')) return Response.json(release);
    if (url.endsWith('/assets/1')) {
      return new Response('version: 1.0.1\n', { headers: { 'content-type': 'text/yaml' } });
    }
    if (url.endsWith('/assets/2')) {
      return new Response('installer-data', {
        status: 206,
        headers: {
          'accept-ranges': 'bytes',
          'content-length': '14',
          'content-range': 'bytes 0-13/100'
        }
      });
    }
    throw new Error(`Unexpected update request: ${url}`);
  };
  const { app } = createApp({
    db: new MemoryDatabase(),
    appPassword: 'un-password-largo-de-prueba',
    jwtSecret: 'test-secret-with-more-than-thirty-two-bytes',
    updateRepository: 'ale-a74/App-Leyra',
    updateToken: 'test-github-token',
    fetchImplementation
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const metadata = await fetch(`${baseUrl}/updates/latest.yml`);
  assert.equal(metadata.status, 200);
  assert.equal(await metadata.text(), 'version: 1.0.1\n');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-github-token');

  const installer = await fetch(`${baseUrl}/updates/Leyra%20Seguridad%20Setup%201.0.1.exe`, {
    headers: { Range: 'bytes=0-12' }
  });
  assert.equal(installer.status, 206);
  assert.equal(installer.headers.get('content-range'), 'bytes 0-13/100');
  assert.equal(await installer.text(), 'installer-data');
  assert.equal(requests[2].options.headers.Range, 'bytes=0-12');

  const unknownAsset = await fetch(`${baseUrl}/updates/not-a-release-file.exe`);
  assert.equal(unknownAsset.status, 404);
  assert.equal(requests.length, 3);
});
