const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');

function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function createDocument() {
  const status = { classList: { toggle() {} } };
  const submit = {};
  const error = { classList: { add() {}, remove() {} } };
  const apiUrl = { value: '' };
  const password = { value: '' };
  const logout = { classList: { toggle() {} }, addEventListener() {} };
  const action = { addEventListener() {} };
  const form = {
    addEventListener() {},
    querySelector() {
      return submit;
    }
  };
  const overlay = {
    classList: { add() {}, remove() {} },
    querySelector(selector) {
      return {
        form,
        '#cloud-sync-error': error,
        '#cloud-api-url': apiUrl,
        '#cloud-password': password,
        '[data-action="logout"]': logout,
        '[data-action="cancel"]': action,
        '[data-action="offline"]': action
      }[selector];
    }
  };
  let created = 0;
  return {
    body: { append() {} },
    createElement() {
      created += 1;
      return created === 1
        ? { querySelector: () => status, addEventListener() {} }
        : overlay;
    },
    getElementById() {
      return { append() {} };
    }
  };
}

function createClient(localStorage, applied = [], fetchImplementation, ioImplementation, online = false) {
  const listeners = new Map();
  const window = {
    location: { protocol: 'file:', origin: 'null' },
    io: ioImplementation,
    addEventListener(event, listener) {
      listeners.set(event, listener);
    },
    applyCloudState(key, value) {
      applied.push({ key, value });
    }
  };
  const context = {
    window,
    localStorage,
    document: createDocument(),
    navigator: { onLine: online },
    console,
    URL,
    fetch: fetchImplementation
  };
  vm.runInNewContext(source, context, { filename: 'cloud-sync.js' });
  return { client: window.CloudSync, listeners };
}

test('offline changes survive an app restart and restore into the local state', async () => {
  const localStorage = createLocalStorage();
  const firstClient = createClient(localStorage);
  const offlineClients = [{ id: 'client-offline', name: 'Cliente guardado sin conexión' }];

  await firstClient.client.persistKey('clients', offlineClients);

  assert.deepEqual(
    JSON.parse(localStorage.getItem('leyra_pending_sync')),
    ['clients']
  );
  assert.deepEqual(
    JSON.parse(localStorage.getItem('securtech_clients')),
    offlineClients
  );

  const applied = [];
  const restartedClient = createClient(localStorage, applied);
  await restartedClient.client.initialize();

  assert.deepEqual(JSON.parse(JSON.stringify(applied)), [{ key: 'clients', value: offlineClients }]);
  assert.deepEqual(
    JSON.parse(localStorage.getItem('leyra_pending_sync')),
    ['clients']
  );
});

test('a saved cloud session opens locally when the server is unreachable', async () => {
  const offlineClients = [{ id: 'client-offline', name: 'Cliente guardado sin conexión' }];
  const localStorage = createLocalStorage({
    leyra_cloud_url: 'https://leyra-seguridad-api.onrender.com',
    leyra_cloud_token: 'saved-token',
    leyra_pending_sync: JSON.stringify(['clients']),
    securtech_clients: JSON.stringify(offlineClients)
  });
  const applied = [];
  const client = createClient(localStorage, applied, async () => {
    throw new TypeError('Failed to fetch');
  });

  assert.equal(await client.client.initialize(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(applied)), [{ key: 'clients', value: offlineClients }]);
});

test('pending offline changes upload when the device reconnects', async () => {
  const offlineClients = [{ id: 'client-offline', name: 'Cliente guardado sin conexión' }];
  const localStorage = createLocalStorage({
    leyra_cloud_url: 'https://leyra-seguridad-api.onrender.com',
    leyra_cloud_token: 'saved-token',
    leyra_pending_sync: JSON.stringify({ clients: offlineClients })
  });
  const requests = [];
  const fetchImplementation = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/api/data')) {
      return { ok: true, status: 200, json: async () => ({ data: { clients: [] } }) };
    }
    return { ok: true, status: 200 };
  };
  const ioImplementation = () => ({ on() {}, disconnect() {} });
  const client = createClient(localStorage, [], fetchImplementation, ioImplementation, true);

  await client.client.initialize();
  await client.listeners.get('online')();

  const upload = requests.find(request => request.options.method === 'PUT');
  assert.ok(upload);
  assert.deepEqual(JSON.parse(upload.options.body), { value: offlineClients });
  assert.deepEqual(JSON.parse(localStorage.getItem('leyra_pending_sync')), []);
});
