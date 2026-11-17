(() => {
  const STORAGE_URL_KEY = 'leyra_cloud_url';
  const STORAGE_TOKEN_KEY = 'leyra_cloud_token';
  const PENDING_KEY = 'leyra_pending_sync';
  const SYNC_KEYS = [
    'clients', 'orders', 'inventory', 'inventoryCategories', 'objects',
    'quotes', 'quoteServices', 'quoteKits', 'quoteBranding'
  ];
  let socket;
  let initialized = false;
  let pendingWrites = new Map();
  let writeChain = Promise.resolve();
  let syncInProgress;
  let activeBaseUrl = '';
  let statusElement;

  function getBaseUrl() {
    const savedUrl = (localStorage.getItem(STORAGE_URL_KEY) || '').trim();
    if (savedUrl) return savedUrl.replace(/\/+$/, '');
    if (['http:', 'https:'].includes(window.location.protocol)) return window.location.origin;
    return '';
  }

  function getToken() {
    return localStorage.getItem(STORAGE_TOKEN_KEY) || '';
  }

  function setStatus(message, connected = false) {
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.classList.toggle('text-emerald-400', connected);
      statusElement.classList.toggle('text-amber-400', !connected);
    }
  }

  function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${getBaseUrl()}${path}`, { ...options, headers });
  }

  function applyCloudData(data) {
    for (const [key, value] of Object.entries(data)) {
      if (!SYNC_KEYS.includes(key)) continue;
      if (pendingWrites.has(key)) continue;
      localStorage.setItem(`securtech_${key}`, JSON.stringify(value));
      window.applyCloudState(key, value);
    }
  }

  function restorePendingWrites() {
    const saved = localStorage.getItem(PENDING_KEY);
    if (!saved) return;
    const data = JSON.parse(saved);
    if (!data || typeof data !== 'object') {
      throw new Error('La cola local de sincronización está dañada.');
    }
    if (Array.isArray(data)) {
      for (const key of data) {
        if (!SYNC_KEYS.includes(key)) continue;
        const stored = localStorage.getItem(`securtech_${key}`);
        if (stored === null) {
          throw new Error(`No se encontraron datos locales para sincronizar: ${key}.`);
        }
        const value = pendingWrites.has(key) ? pendingWrites.get(key) : JSON.parse(stored);
        pendingWrites.set(key, value);
        localStorage.setItem(`securtech_${key}`, JSON.stringify(value));
        window.applyCloudState(key, value);
      }
    } else {
      for (const [key, queuedValue] of Object.entries(data)) {
        if (!SYNC_KEYS.includes(key)) continue;
        const stored = localStorage.getItem(`securtech_${key}`);
        const value = pendingWrites.has(key)
          ? pendingWrites.get(key)
          : stored === null ? queuedValue : JSON.parse(stored);
        pendingWrites.set(key, value);
        if (stored === null) localStorage.setItem(`securtech_${key}`, JSON.stringify(value));
        window.applyCloudState(key, value);
      }
      storePendingWrites();
    }
  }

  function storePendingWrites() {
    localStorage.setItem(PENDING_KEY, JSON.stringify([...pendingWrites.keys()]));
  }

  async function loadCloudData() {
    const response = await request('/api/data');
    if (!response.ok) {
      if (response.status === 401) localStorage.removeItem(STORAGE_TOKEN_KEY);
      throw new Error(response.status === 401 ? 'Tu sesión venció. Volvé a iniciar sesión.' : 'No se pudieron cargar los datos sincronizados.');
    }
    const result = await response.json();
    if (Object.keys(result.data).length === 0) {
      const localData = window.getAppSyncData();
      if (!localData || Object.keys(localData).length === 0) {
        throw new Error('No hay datos locales disponibles para inicializar la base.');
      }
      const bootstrapResponse = await request('/api/data/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ data: localData })
      });
      if (bootstrapResponse.status === 409) return loadCloudData();
      if (!bootstrapResponse.ok) throw new Error('No se pudieron copiar los datos locales al servidor.');
      const bootstrap = await bootstrapResponse.json();
      applyCloudData(bootstrap.data);
      restorePendingWrites();
      return;
    }
    applyCloudData(result.data);
    restorePendingWrites();
  }

  function connectSocket() {
    if (socket) socket.disconnect();
    if (typeof window.io !== 'function') {
      setStatus('Sin conexión en tiempo real; los datos quedan guardados localmente');
      return;
    }
    socket = window.io(activeBaseUrl, {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
      reconnection: true
    });
    socket.on('connect', () => {
      synchronizeCloudState();
    });
    socket.on('disconnect', () => setStatus('Reconectando…'));
    socket.on('connect_error', error => {
      console.error('Error de conexión en tiempo real:', error);
      setStatus('Sin conexión; se reintentará automáticamente');
    });
    socket.on('cloud:data:update', ({ key, value }) => {
      if (!SYNC_KEYS.includes(key)) return;
      if (pendingWrites.has(key)) return;
      localStorage.setItem(`securtech_${key}`, JSON.stringify(value));
      window.applyCloudState(key, value);
    });
  }

  async function persistKey(key, value) {
    if (!SYNC_KEYS.includes(key)) return;
    try {
      const localValue = JSON.parse(JSON.stringify(value));
      localStorage.setItem(`securtech_${key}`, JSON.stringify(localValue));
      pendingWrites.set(key, localValue);
      storePendingWrites();
      if (!initialized || !getToken() || !getBaseUrl()) {
        setStatus('Guardado localmente; pendiente de sincronización');
        return;
      }
      await flushPendingWrites();
    } catch (error) {
      console.error('No se pudo guardar la cola de sincronización:', error);
      setStatus('No se pudo guardar la cola local');
      window.showToast?.('Error al preparar la sincronización. Revisá el espacio disponible.', false);
    }
  }

  async function flushPendingWrites() {
    if (!initialized || !getToken() || !getBaseUrl()) return;
    writeChain = writeChain.then(async () => {
      while (pendingWrites.size) {
        const [key, value] = pendingWrites.entries().next().value;
        const response = await request(`/api/data/${encodeURIComponent(key)}`, {
          method: 'PUT',
          body: JSON.stringify({ value })
        });
        if (!response.ok) {
          if (response.status === 401) localStorage.removeItem(STORAGE_TOKEN_KEY);
          throw new Error('No se pudo guardar la información en la nube.');
        }
        if (pendingWrites.get(key) === value) pendingWrites.delete(key);
        storePendingWrites();
      }
      setStatus('Sincronización en tiempo real activa', true);
    }).catch(error => {
      console.error('Error al sincronizar datos:', error);
      setStatus('Pendiente de conexión; los datos locales están guardados');
    });
    return writeChain;
  }

  function synchronizeCloudState() {
    if (syncInProgress) return syncInProgress;
    syncInProgress = (async () => {
      try {
        await loadCloudData();
        await flushPendingWrites();
        setStatus('Sincronización en tiempo real activa', true);
      } catch (error) {
        console.error('No se pudo actualizar el estado de la nube:', error);
        setStatus('Sin conexión; los cambios están guardados localmente');
      } finally {
        syncInProgress = null;
      }
    })();
    return syncInProgress;
  }

  async function loginAndSync(baseUrl, password) {
    localStorage.setItem(STORAGE_URL_KEY, baseUrl.replace(/\/+$/, ''));
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'No se pudo iniciar sesión.');
    }
    const result = await response.json();
    localStorage.setItem(STORAGE_TOKEN_KEY, result.token);
    await loadCloudData();
    activeBaseUrl = getBaseUrl();
    initialized = true;
    connectSocket();
    setStatus('Conectando al servidor…');
  }

  function createSyncUi() {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'mx-4 my-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-left text-xs text-slate-300 hover:bg-slate-800 no-print';
    const savedDollarRate = Number(localStorage.getItem('securtech_dollarRate'));
    const savedDollarSource = localStorage.getItem('securtech_dollarRateSource');
    const hasSavedBankRate = Number.isFinite(savedDollarRate) && savedDollarRate > 0 && savedDollarSource === 'bna';
    control.innerHTML = '<span class="flex items-center gap-2"><i class="fa-solid fa-cloud"></i><span>Sincronización</span></span><span id="cloud-sync-status" class="mt-1 block text-[10px] text-amber-400">Guardado en este dispositivo</span>';
    statusElement = control.querySelector('#cloud-sync-status');
    control.addEventListener('click', () => showSetupModal());

    const dollarRateBox = document.createElement('div');
    dollarRateBox.className = 'mx-4 mt-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 no-print';
    dollarRateBox.innerHTML = `
      <span class="block text-[10px] uppercase tracking-wider text-slate-400">Dólar hoy · Banco Nación</span>
      <strong id="cloud-dollar-rate" class="mt-1 block text-sm text-white">${hasSavedBankRate ? `$ ${savedDollarRate.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS` : 'Consultando…'}</strong>
      <span id="cloud-dollar-rate-status" class="mt-1 block text-[10px] text-slate-500">Cotización de venta</span>`;
    const sidebar = document.getElementById('sidebar');
    sidebar?.append(dollarRateBox);
    sidebar?.append(control);
    window.initializeDollarRate?.();

    const overlay = document.createElement('div');
    overlay.id = 'cloud-sync-modal';
    overlay.className = 'fixed inset-0 z-[60] hidden items-center justify-center bg-black/70 p-4 no-print';
    overlay.innerHTML = `
      <form class="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div>
          <h2 class="text-lg font-bold text-white">Sincronizar Leyra Seguridad</h2>
          <p class="mt-1 text-xs text-slate-400">Los cambios se guardan en este dispositivo y se sincronizan con Render cuando hay conexión.</p>
        </div>
        <div>
          <label for="cloud-api-url" class="mb-1 block text-xs font-medium text-slate-300">URL HTTPS del servidor</label>
          <input id="cloud-api-url" type="url" required placeholder="https://leyra-seguridad-api.onrender.com" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
        </div>
        <div>
          <label for="cloud-password" class="mb-1 block text-xs font-medium text-slate-300">Contraseña de acceso compartida</label>
          <input id="cloud-password" type="password" minlength="12" required autocomplete="current-password" class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
        </div>
        <p id="cloud-sync-error" class="hidden text-sm text-rose-400" role="alert"></p>
        <div class="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
          <button type="button" data-action="logout" class="hidden rounded-xl bg-rose-950 px-3 py-2 text-sm text-rose-300 hover:bg-rose-900">Cerrar sesión en este dispositivo</button>
          <button type="button" data-action="offline" class="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">Seguir sin conexión</button>
          <button type="button" data-action="cancel" class="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">Cancelar</button>
          <button type="submit" class="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">Conectar</button>
        </div>
      </form>`;
    document.body.append(overlay);
    const form = overlay.querySelector('form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const error = overlay.querySelector('#cloud-sync-error');
      submit.disabled = true;
      error.classList.add('hidden');
      try {
        const baseUrl = overlay.querySelector('#cloud-api-url').value.trim();
        if (!baseUrl.startsWith('https://') && !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) {
          throw new Error('Usá una URL HTTPS para proteger el acceso a tus datos.');
        }
        await loginAndSync(baseUrl, overlay.querySelector('#cloud-password').value);
        overlay.classList.add('hidden');
        window.initializeAppPage();
      } catch (connectionError) {
        console.error('No se pudo conectar al servidor de Leyra Seguridad:', connectionError);
        error.textContent = connectionError.message;
        error.classList.remove('hidden');
      } finally {
        submit.disabled = false;
      }
    });
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.querySelector('[data-action="logout"]').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      socket?.disconnect();
      socket = null;
      initialized = false;
      overlay.classList.add('hidden');
      setStatus('Sesión cerrada; solo en este dispositivo');
    });
    overlay.querySelector('[data-action="offline"]').addEventListener('click', () => {
      overlay.classList.add('hidden');
      window.initializeAppPage();
    });
    overlay.querySelector('#cloud-api-url').value = getBaseUrl();
    return overlay;
  }

  function showSetupModal() {
    const modal = document.getElementById('cloud-sync-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.querySelector('#cloud-password').value = '';
    modal.querySelector('[data-action="logout"]').classList.toggle('hidden', !getToken());
  }

  async function initialize() {
    createSyncUi();
    restorePendingWrites();
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setStatus(pendingWrites.size ? 'Guardado localmente; pendiente de sincronización' : 'Solo en este dispositivo');
      return false;
    }
    if (!getToken()) {
      showSetupModal();
      return true;
    }
    try {
      activeBaseUrl = baseUrl;
      await loadCloudData();
      initialized = true;
      connectSocket();
      setStatus('Conectando al servidor…');
      return false;
    } catch (error) {
      console.error('No se pudo restaurar la sesión en la nube:', error);
      if (getToken()) {
        initialized = true;
        activeBaseUrl = baseUrl;
        connectSocket();
        if (error instanceof TypeError || !navigator.onLine) {
          setStatus('Sin conexión; los cambios están guardados localmente');
          return false;
        }
      }
      showSetupModal();
      return true;
    }
  }

  window.addEventListener('offline', () => {
    setStatus('Sin conexión; los cambios están guardados localmente');
  });
  window.addEventListener('online', () => {
    if (initialized && getToken() && getBaseUrl()) return synchronizeCloudState();
  });

  window.CloudSync = { initialize, persistKey };
})();
