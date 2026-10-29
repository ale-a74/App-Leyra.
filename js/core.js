    // Initial Seed Data
    const initialClients = [
      { id: 'cli-1', name: 'Supermercado Central', phone: '+54 341 440-1234', email: 'gerencia@supercentral.com', type: 'Comercio', address: 'Av. Pellegrini 1850' },
      { id: 'cli-2', name: 'Dra. María Elena Rossi', phone: '+54 341 512-9876', email: 'mrossi@gmail.com', type: 'Casa Particular', address: 'Bv. Oroño 420' },
      { id: 'cli-3', name: 'Logística Litoral S.A.', phone: '+54 341 498-7700', email: 'deposito@litoral.com.ar', type: 'Empresa / Depósito', address: 'Zona Industrial Oest, Galpón 4' }
    ];

    const initialOrders = [
      {
        id: 'ORD-101',
        clientId: 'cli-1',
        clientName: 'Supermercado Central',
        type: 'Cámaras CCTV',
        address: 'Av. Pellegrini 1850',
        priority: 'Alta',
        status: 'En Proceso',
        desc: 'DVR de 16 canales no emite señal en monitor principal. Posible fallo de fuente o canal 4 en corto.',
        techNotes: 'Se verificó fuente de poder 12V 5A sobrecalentada. Se procede a reemplazo.',
        date: '2026-10-28 09:30'
      },
      {
        id: 'ORD-102',
        clientId: 'cli-2',
        clientName: 'Dra. María Elena Rossi',
        type: 'Alarma Anti-Intrusión',
        address: 'Bv. Oroño 420',
        priority: 'Media',
        status: 'Pendiente',
        desc: 'Instalación de Kit inalámbrico con 3 sensores de movimiento y sirena exterior.',
        techNotes: '',
        date: '2026-10-29 11:00'
      },
      {
        id: 'ORD-103',
        clientId: 'cli-3',
        clientName: 'Logística Litoral S.A.',
        type: 'Control de Acceso',
        address: 'Zona Industrial Oest, Galpón 4',
        priority: 'Baja',
        status: 'Completado',
        desc: 'Mantenimiento preventivo en barrera de acceso vehicular y lectoras biométricas.',
        techNotes: 'Limpieza de ópticas biométricas y lubricación de engranajes de barrera.',
        date: '2026-10-25 14:15'
      }
    ];

    const initialInventory = [
      { id: 'inv-1', name: 'Kit Cámara CCTV 1080p Bullet Hikvision', category: 'CCTV & DVR', price: 45000, stock: 12, minStock: 4 },
      { id: 'inv-2', name: 'DVR 8 Canales HD-TVI 1080p Lite', category: 'CCTV & DVR', price: 95000, stock: 5, minStock: 2 },
      { id: 'inv-3', name: 'Sensor PIR Inalámbrico Anti-mascota', category: 'Alarmas & Sensores', price: 18500, stock: 20, minStock: 5 },
      { id: 'inv-4', name: 'Fuente Conmutada 12V 5A Multi-salida', category: 'Cables & Fuentes', price: 14000, stock: 3, minStock: 4 },
      { id: 'inv-5', name: 'Bobina Cable UTP Categoria 5e Exterior (100m)', category: 'Cables & Fuentes', price: 38000, stock: 8, minStock: 3 }
    ];
    const initialInventoryCategories = ['CCTV & DVR', 'Alarmas & Sensores', 'Cables & Fuentes', 'Control Acceso', 'Accesorios'];
    const initialObjects = [];

    // LocalStorage Helper
    function loadData(key, fallback) {
      const data = localStorage.getItem('securtech_' + key);
      return data ? JSON.parse(data) : fallback;
    }

    function saveData(key, data) {
      localStorage.setItem('securtech_' + key, JSON.stringify(data));
      window.CloudSync?.persistKey(key, data);
    }

    // App State
    let clients = loadData('clients', initialClients);
    let orders = loadData('orders', initialOrders);
    let inventory = loadData('inventory', initialInventory);
    let inventoryCategories = [...new Set([
      ...loadData('inventoryCategories', initialInventoryCategories),
      ...inventory.map(item => item.category).filter(Boolean)
    ])];
    let quoteServices = loadData('quoteServices', []);
    let quoteBranding = {
      businessName: 'Leyra Seguridad',
      tagline: 'Instalación y mantenimiento de seguridad electrónica',
      phone: '',
      email: '',
      address: '',
      logo: '',
      color: '#0369a1',
      theme: 'classic',
      ...loadData('quoteBranding', {})
    };
    let objects = loadData('objects', initialObjects);
    let quotes = loadData('quotes', []);
    let quoteExtraItems = [];
    let quoteInventoryItems = [];
    let activeQuoteId = '';
    let quoteDocumentMode = 'estimate';

    // Initialization
    let appPageInitialized = false;
    window.addEventListener('DOMContentLoaded', async () => {
      setupNavigation();
      const needsLogin = await window.CloudSync?.initialize();
      if (!needsLogin) initializeAppPage();
    });

    function initializeAppPage() {
      if (appPageInitialized) return;
      appPageInitialized = true;
      const page = document.body.dataset.page;
      if (page === 'dashboard') renderDashboard();
      if (page === 'orders') { populateClientDropdown(); renderOrders(); }
      if (page === 'clients') renderClients();
      if (page === 'objects') { populateObjectClientDropdown(); renderObjects(); }
      if (page === 'inventory') { populateInventoryCategories(); renderInventory(); }
      if (page === 'quotes') { populateQuoteClientDropdown(); populateQuoteServiceOptions(); initializeQuoteBranding(); updateQuoteInventoryOptions(); renderQuoteInventoryItems(); calculateQuote(); renderQuotes(); }
    }

    window.initializeAppPage = initializeAppPage;

    window.applyCloudState = (key, value) => {
      if (key === 'clients' && Array.isArray(value)) clients = value;
      if (key === 'orders' && Array.isArray(value)) orders = value;
      if (key === 'inventory' && Array.isArray(value)) inventory = value;
      if (key === 'inventoryCategories' && Array.isArray(value)) inventoryCategories = value;
      if (key === 'objects' && Array.isArray(value)) objects = value;
      if (key === 'quotes' && Array.isArray(value)) quotes = value;
      if (key === 'quoteServices' && Array.isArray(value)) quoteServices = value;
      if (key === 'quoteBranding' && value && typeof value === 'object' && !Array.isArray(value)) {
        quoteBranding = { ...quoteBranding, ...value };
      }

      if (!appPageInitialized) return;
      const page = document.body.dataset.page;
      if (key === 'clients') {
        if (page === 'clients') renderClients();
        if (page === 'orders') populateClientDropdown();
        if (page === 'objects') populateObjectClientDropdown();
        if (page === 'quotes') populateQuoteClientDropdown();
      }
      if (key === 'orders') {
        if (page === 'orders') renderOrders();
        if (page === 'dashboard') renderDashboard();
      }
      if (key === 'inventory' || key === 'inventoryCategories') {
        if (page === 'inventory') { populateInventoryCategories(); renderInventory(); }
        if (page === 'quotes') updateQuoteInventoryOptions();
      }
      if (key === 'objects' && page === 'objects') renderObjects();
      if (key === 'quotes' && page === 'quotes') renderQuotes();
      if (key === 'quoteServices' && page === 'quotes') populateQuoteServiceOptions();
      if (key === 'quoteBranding' && page === 'quotes') initializeQuoteBranding();
      if (page === 'quotes' && ['clients', 'inventory', 'inventoryCategories', 'quotes', 'quoteServices'].includes(key)) calculateQuote();
    };

    // Navigation logic
    function setupNavigation() {
      const mobileBtn = document.getElementById('mobile-menu-btn');
      const closeBtn = document.getElementById('close-sidebar-btn');
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (!mobileBtn || !closeBtn || !sidebar || !overlay) return;

      function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
      }

      mobileBtn.addEventListener('click', toggleSidebar);
      closeBtn.addEventListener('click', toggleSidebar);
      overlay.addEventListener('click', toggleSidebar);
    }

    function switchTab(tabId) {
      const pages = { dashboard: 'dashboard.html', orders: 'ordenes.html', clients: 'clientes.html', objects: 'equipos.html', quotes: 'presupuestos.html', inventory: 'inventario.html' };
      if (pages[tabId] && document.body.dataset.page !== tabId) window.location.href = pages[tabId];
    }

    function populateQuoteClientDropdown() {
      const select = document.getElementById('quote-client-select');
      if (!select) return;
      select.innerHTML = `<option value="">Cliente nuevo / prospecto</option>` + clients.map(c => `
        <option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>
      `).join('');
    }

    function populateObjectClientDropdown() {
      const select = document.getElementById('form-object-client');
      if (!select) return;
      select.innerHTML = clients.length
        ? clients.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')
        : '<option value="">Primero registrá un cliente</option>';
      select.disabled = clients.length === 0;
    }

    function getStatusBadgeClass(status) {
      switch (status) {
        case 'Pendiente': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        case 'En Proceso': return 'bg-brand-500/10 text-brand-400 border border-brand-500/20';
        case 'Completado': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        case 'Cancelado': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
        default: return 'bg-slate-800 text-slate-400';
      }
    }

    // Modal Helpers
    function openModal(modalId) {
      document.getElementById(modalId).classList.remove('hidden');
    }

    function closeModal(modalId) {
      document.getElementById(modalId).classList.add('hidden');
    }

    function showToast(msg, isSuccess = true) {
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toast-message');
      const toastIcon = document.getElementById('toast-icon');

      toastMsg.innerText = msg;
      if (isSuccess) {
        toast.classList.remove('bg-rose-600');
        toast.classList.add('bg-brand-600');
        toastIcon.className = 'fa-solid fa-circle-check text-lg';
      } else {
        toast.classList.remove('bg-brand-600');
        toast.classList.add('bg-rose-600');
        toastIcon.className = 'fa-solid fa-triangle-exclamation text-lg';
      }

      toast.classList.remove('translate-y-20', 'opacity-0');
      setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
      }, 3000);
    }


    // Utility: Sanitize text
    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>"']/g, function(m) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        }[m];
      });
    }
  