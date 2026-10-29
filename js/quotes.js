    // ================= 4. QUICK QUOTE CALCULATOR LOGIC =================
    let quoteBrandLogoPreview = '';

    function initializeQuoteBranding() {
      document.getElementById('branding-business-name').value = quoteBranding.businessName;
      document.getElementById('branding-tagline').value = quoteBranding.tagline;
      document.getElementById('branding-phone').value = quoteBranding.phone;
      document.getElementById('branding-email').value = quoteBranding.email;
      document.getElementById('branding-address').value = quoteBranding.address;
      document.getElementById('branding-color').value = quoteBranding.color;
      document.getElementById('branding-theme').value = quoteBranding.theme;
      quoteBrandLogoPreview = quoteBranding.logo;
      previewQuoteBranding();
    }

    function previewQuoteBranding() {
      const businessName = document.getElementById('branding-business-name').value.trim() || 'Leyra Seguridad';
      const tagline = document.getElementById('branding-tagline').value.trim();
      const contacts = [
        document.getElementById('branding-phone').value.trim(),
        document.getElementById('branding-email').value.trim(),
        document.getElementById('branding-address').value.trim()
      ].filter(Boolean);
      const color = document.getElementById('branding-color').value || '#0369a1';
      const theme = document.getElementById('branding-theme').value;
      const preview = document.getElementById('print-area');
      const logo = document.getElementById('summary-brand-logo');

      document.getElementById('summary-brand-name').textContent = businessName;
      document.getElementById('summary-brand-tagline').textContent = tagline;
      document.getElementById('summary-brand-tagline').classList.toggle('hidden', !tagline);
      document.getElementById('summary-brand-contact').textContent = contacts.join(' · ');
      document.getElementById('summary-brand-contact').classList.toggle('hidden', contacts.length === 0);
      logo.alt = `Logo de ${businessName}`;
      logo.classList.toggle('hidden', !quoteBrandLogoPreview);
      if (quoteBrandLogoPreview) logo.src = quoteBrandLogoPreview;
      preview.dataset.quoteTheme = ['classic', 'modern', 'minimal'].includes(theme) ? theme : 'classic';
      preview.style.setProperty('--quote-brand-color', color);
      document.getElementById('summary-total-price').style.color = color;
    }

    function handleQuoteBrandLogo(event) {
      const file = event.target.files[0];
      if (!file) return;
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowedTypes.includes(file.type) || file.size > 1024 * 1024) {
        event.target.value = '';
        showToast('Elegí una imagen PNG, JPG o WebP de hasta 1 MB', false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          showToast('No se pudo leer el archivo del logo', false);
          return;
        }
        quoteBrandLogoPreview = reader.result;
        previewQuoteBranding();
      };
      reader.onerror = () => showToast('No se pudo leer el archivo del logo', false);
      reader.readAsDataURL(file);
    }

    function removeQuoteBrandLogo() {
      quoteBrandLogoPreview = '';
      document.getElementById('branding-logo').value = '';
      previewQuoteBranding();
    }

    function saveQuoteBranding() {
      const form = document.getElementById('quote-branding-form');
      if (!form.reportValidity()) return;

      const updatedBranding = {
        businessName: document.getElementById('branding-business-name').value.trim(),
        tagline: document.getElementById('branding-tagline').value.trim(),
        phone: document.getElementById('branding-phone').value.trim(),
        email: document.getElementById('branding-email').value.trim(),
        address: document.getElementById('branding-address').value.trim(),
        logo: quoteBrandLogoPreview,
        color: document.getElementById('branding-color').value,
        theme: document.getElementById('branding-theme').value
      };

      try {
        saveData('quoteBranding', updatedBranding);
      } catch (error) {
        console.error('No se pudo guardar la identidad visual del presupuesto:', error);
        showToast('No se pudo guardar. Puede que el almacenamiento esté lleno.', false);
        return;
      }

      quoteBranding = updatedBranding;
      showToast('Identidad visual guardada');
    }

    function populateQuoteServiceOptions(selectedValue) {
      const select = document.getElementById('quote-service-type');
      if (!select) return;

      const currentValue = selectedValue || select.value;
      const defaultServices = [
        'Instalación de cámaras / CCTV',
        'Instalación o reparación de alarmas',
        'Reparación electrónica',
        'Control de acceso',
        'Mantenimiento / otro servicio'
      ];
      const services = [...new Set([...defaultServices, ...quoteServices])];
      select.replaceChildren(...services.map(service => {
        const option = document.createElement('option');
        option.value = service;
        option.textContent = service;
        return option;
      }));
      if (services.includes(currentValue)) select.value = currentValue;
    }

    function addQuoteService(event) {
      event.preventDefault();
      const input = document.getElementById('new-quote-service');
      const service = input.value.trim();
      if (!service) {
        showToast('Escribí el nombre del servicio', false);
        input.focus();
        return;
      }

      const existing = [...document.getElementById('quote-service-type').options]
        .find(option => option.value.toLocaleLowerCase() === service.toLocaleLowerCase());
      if (existing) {
        populateQuoteServiceOptions(existing.value);
        updateQuoteServiceDefaults();
        closeModal('new-quote-service-modal');
        input.value = '';
        showToast('Ese servicio ya existe; quedó seleccionado', false);
        return;
      }

      quoteServices.push(service);
      saveData('quoteServices', quoteServices);
      populateQuoteServiceOptions(service);
      updateQuoteServiceDefaults();
      closeModal('new-quote-service-modal');
      input.value = '';
      showToast('Servicio agregado');
    }

    function selectQuoteClient() {
      const client = clients.find(c => c.id === document.getElementById('quote-client-select').value);
      if (!client) return;
      document.getElementById('quote-client-name').value = client.name;
      document.getElementById('quote-client-phone').value = client.phone || '';
      document.getElementById('quote-client-address').value = client.address || '';
      const propertyType = client.type === 'Casa Particular' ? 'Residencial / Casa'
        : client.type === 'Empresa / Depósito' ? 'Depósito / Industria'
        : client.type === 'Edificio' ? 'Edificio / Consorcio'
        : 'Comercio / Local';
      document.getElementById('quote-property-type').value = propertyType;
      calculateQuote();
    }

    function updateQuoteServiceDefaults() {
      updateQuoteInventoryOptions();
      calculateQuote();
    }

    function getQuoteService() {
      const value = document.getElementById('quote-service-type').value.toLowerCase();
      if (value.includes('cámaras') || value.includes('cctv')) return 'cctv';
      if (value.includes('alarmas')) return 'alarm';
      if (value.includes('acceso')) return 'access';
      if (value.includes('reparación')) return 'repair';
      return 'maintenance';
    }

    function getInventoryItemsForQuote() {
      const service = getQuoteService();
      const filters = {
        cctv: {
          categories: ['cctv', 'dvr', 'cámara', 'cable', 'fuente', 'accesorio'],
          names: ['cctv', 'cámara', 'dvr', 'nvr', 'cable', 'balun', 'fuente', 'conector']
        },
        alarm: {
          categories: ['alarma', 'sensor', 'cable', 'fuente', 'accesorio'],
          names: ['alarma', 'sensor', 'x28', 'teclado', 'central', 'llamador', 'sirena', 'módulo', 'modulo', 'cable', 'fuente']
        },
        access: {
          categories: ['acceso', 'control', 'biometr', 'cable', 'fuente', 'accesorio'],
          names: ['acceso', 'lector', 'biométr', 'biometr', 'cerradura', 'control', 'cable', 'fuente']
        },
        repair: {
          categories: ['electr', 'repar', 'componente', 'cable', 'fuente', 'accesorio'],
          names: ['electr', 'placa', 'componente', 'repuesto', 'fuente', 'cable', 'conector']
        },
        maintenance: { categories: [], names: [] }
      };
      const filter = filters[service];
      if (service === 'maintenance') return inventory;
      return inventory.filter(item => {
        const category = String(item.category || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        return filter.categories.some(term => category.includes(term)) || filter.names.some(term => name.includes(term));
      });
    }

    function updateQuoteInventoryOptions() {
      const service = getQuoteService();
      const select = document.getElementById('quote-inventory-select');
      const heading = document.getElementById('quote-inventory-heading');
      const help = document.getElementById('quote-inventory-help');
      const empty = document.getElementById('quote-inventory-empty');
      const cctvOptions = document.getElementById('quote-cctv-options');
      const labels = {
        cctv: ['Componentes para CCTV / cámaras', 'Elegí los equipos de CCTV registrados en tu inventario.'],
        alarm: ['Módulos y componentes de alarma', 'Elegí centrales, teclados, llamadores, sensores y otros componentes del inventario.'],
        access: ['Equipos de control de acceso', 'Elegí lectores, cerraduras y accesorios de control de acceso del inventario.'],
        repair: ['Repuestos para reparación electrónica', 'Elegí los repuestos electrónicos que vas a utilizar.'],
        maintenance: ['Insumos para mantenimiento', 'Elegí cualquier material necesario para este servicio.']
      };
      const [title, description] = labels[service];
      heading.innerText = title;
      help.innerText = description;
      cctvOptions.classList.toggle('hidden', service !== 'cctv');

      const availableItems = getInventoryItemsForQuote();
      select.innerHTML = availableItems.map(item => `
        <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.category)} · $${Number(item.price).toLocaleString('es-AR')}</option>
      `).join('');
      select.disabled = availableItems.length === 0;
      document.getElementById('quote-inventory-quantity').disabled = availableItems.length === 0;
      const addButton = select.parentElement.querySelector('button');
      addButton.disabled = availableItems.length === 0;
      addButton.classList.toggle('opacity-50', availableItems.length === 0);
      addButton.classList.toggle('cursor-not-allowed', availableItems.length === 0);
      empty.innerText = availableItems.length ? '' : 'No hay artículos de esta categoría en el inventario. Agregalos en Inventario y volvé a este presupuesto.';
      empty.classList.toggle('hidden', availableItems.length > 0);
    }

    function calculateQuote() {
      const clientName = document.getElementById('quote-client-name').value || 'Cliente No Especificado';
      const clientPhone = document.getElementById('quote-client-phone').value;
      const clientAddress = document.getElementById('quote-client-address').value;
      const propertyType = document.getElementById('quote-property-type').value;
      const serviceType = document.getElementById('quote-service-type').value;
      const service = getQuoteService();
      const includesCameras = service === 'cctv';

      // Base Kit
      const selectedKit = document.querySelector('input[name="base-kit"]:checked').value;
      let kitName = includesCameras ? 'Kit 4 Cámaras 1080p' : 'Sin kit base';
      let kitPrice = includesCameras ? 180000 : 0;

      if (selectedKit === 'cctv_8') {
        kitName = includesCameras ? 'Kit 8 Cámaras 4K Hikvision' : 'Sin kit base';
        kitPrice = includesCameras ? 340000 : 0;
      }

      const laborHours = Number(document.getElementById('quote-labor-hours').value) || 0;
      const laborRate = Number(document.getElementById('quote-labor-rate').value) || 0;
      const laborPrice = laborHours * laborRate;
      const inventoryItemsTotal = quoteInventoryItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const suppliesSubtotal = kitPrice + inventoryItemsTotal + quoteExtraItems.reduce((sum, item) => sum + item.price, 0);
      const requestedDiscount = Number(document.getElementById('quote-discount').value) || 0;
      const discount = Math.min(requestedDiscount, quoteDocumentMode === 'final' ? suppliesSubtotal + laborPrice : suppliesSubtotal);
      const suppliesTotal = Math.max(0, suppliesSubtotal - Math.min(requestedDiscount, suppliesSubtotal));
      const finalTotal = Math.max(0, suppliesSubtotal + laborPrice - Math.min(requestedDiscount, suppliesSubtotal + laborPrice));
      const total = quoteDocumentMode === 'final' ? finalTotal : suppliesTotal;

      // Update UI elements
      document.getElementById('summary-client-name').innerText = clientName;
      document.getElementById('summary-client-phone').innerText = clientPhone ? `Tel.: ${clientPhone}` : '';
      document.getElementById('summary-client-address').innerText = clientAddress;
      document.getElementById('summary-property-type').innerText = propertyType;
      document.getElementById('summary-service-type').innerText = serviceType;
      
      document.getElementById('summary-kit-name').innerText = kitName;
      document.getElementById('summary-kit-price').innerText = `$${kitPrice.toLocaleString('es-AR')}`;
      document.getElementById('summary-labor-price').innerText = `$${laborPrice.toLocaleString('es-AR')}`;
      document.getElementById('quote-labor-internal-total').innerText = `$${laborPrice.toLocaleString('es-AR')}`;
      document.getElementById('summary-kit-row').classList.toggle('hidden', !includesCameras);
      document.getElementById('summary-labor-row').classList.toggle('hidden', quoteDocumentMode !== 'final' || laborPrice <= 0);
      document.getElementById('summary-extra-items').innerHTML = [
        ...quoteInventoryItems.map(item => `
          <div class="flex justify-between py-1 border-b border-slate-800/60">
            <span class="text-slate-400">${escapeHtml(item.description)} (${item.quantity} u.)</span>
            <span class="font-semibold text-slate-200">$${(item.quantity * item.unitPrice).toLocaleString('es-AR')}</span>
          </div>
        `),
        ...quoteExtraItems.map(item => `
        <div class="flex justify-between py-1 border-b border-slate-800/60">
          <span class="text-slate-400">${escapeHtml(item.description)}</span>
          <span class="font-semibold text-slate-200">$${item.price.toLocaleString('es-AR')}</span>
        </div>
        `)
      ].join('');
      document.getElementById('summary-notes').innerText = document.getElementById('quote-notes').value;

      document.getElementById('summary-total-price').innerText = `$${total.toLocaleString('es-AR')}`;
      document.getElementById('quote-number-display').innerText = activeQuoteId || 'BORRADOR';
      document.getElementById('summary-document-title').innerText = quoteDocumentMode === 'final' ? 'Factura final' : 'Presupuesto de Insumos';
      document.getElementById('summary-document-badge').innerText = quoteDocumentMode === 'final' ? 'Final' : 'Insumos';
      document.getElementById('summary-total-label').innerText = quoteDocumentMode === 'final' ? 'Total final' : 'Total de insumos';
      document.getElementById('summary-validity').classList.toggle('hidden', quoteDocumentMode === 'final');
      document.getElementById('summary-discount-row').classList.toggle('hidden', discount <= 0);
      if (discount > 0) document.getElementById('summary-discount-price').innerText = `-$${discount.toLocaleString('es-AR')}`;
      if (!activeQuoteId) {
        document.getElementById('quote-date-display').innerText = `Fecha: ${new Date().toLocaleDateString('es-AR')}`;
      }
    }

    function resetQuote() {
      document.getElementById('quote-form').reset();
      document.getElementById('quote-client-select').value = '';
      quoteExtraItems = [];
      quoteInventoryItems = [];
      activeQuoteId = '';
      quoteDocumentMode = 'estimate';
      document.getElementById('quote-labor-hours').value = '0';
      document.getElementById('quote-labor-rate').value = '0';
      document.querySelector('input[name="base-kit"][value="cctv_4"]').checked = true;
      updateQuoteInventoryOptions();
      renderQuoteInventoryItems();
      renderQuoteExtraItems();
      calculateQuote();
    }

    function setQuoteDocumentMode(mode) {
      quoteDocumentMode = mode;
      calculateQuote();
    }

    function printQuoteDocument(id, mode) {
      if (id) {
        const quote = quotes.find(item => item.id === id);
        if (!quote) {
          showToast('No se encontró el presupuesto solicitado', false);
          return;
        }
        loadQuoteIntoForm(quote);
      }
      setQuoteDocumentMode(mode);
      window.print();
    }

    function renderQuoteExtraItems() {
      const list = document.getElementById('quote-extra-items');
      list.innerHTML = quoteExtraItems.map((item, index) => `
        <div class="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
          <span class="text-slate-300">${escapeHtml(item.description)}</span>
          <span class="font-semibold text-white">$${item.price.toLocaleString('es-AR')}</span>
          <button type="button" onclick="removeQuoteItem(${index})" class="text-slate-500 hover:text-rose-400" aria-label="Quitar concepto"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `).join('');
      calculateQuote();
    }

    function renderQuoteInventoryItems() {
      const list = document.getElementById('quote-inventory-items');
      list.innerHTML = quoteInventoryItems.map((item, index) => `
        <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
          <span class="text-slate-300">${escapeHtml(item.description)} <span class="text-slate-500">(${item.quantity} × $${item.unitPrice.toLocaleString('es-AR')})</span></span>
          <span class="font-semibold text-white">$${(item.quantity * item.unitPrice).toLocaleString('es-AR')}</span>
          <button type="button" onclick="removeInventoryQuoteItem(${index})" class="text-slate-500 hover:text-rose-400" aria-label="Quitar ${escapeHtml(item.description)}"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `).join('');
      calculateQuote();
    }

    function addInventoryQuoteItem() {
      const item = inventory.find(entry => entry.id === document.getElementById('quote-inventory-select').value);
      const quantity = Number(document.getElementById('quote-inventory-quantity').value);
      if (!item || !Number.isInteger(quantity) || quantity < 1) {
        showToast('Elegí un artículo del inventario y una cantidad válida', false);
        return;
      }
      const existing = quoteInventoryItems.find(entry => entry.inventoryId === item.id);
      if (existing) existing.quantity += quantity;
      else quoteInventoryItems.push({
        inventoryId: item.id,
        description: item.name,
        category: item.category,
        quantity,
        unitPrice: Number(item.price) || 0
      });
      document.getElementById('quote-inventory-quantity').value = '1';
      renderQuoteInventoryItems();
    }

    function removeInventoryQuoteItem(index) {
      quoteInventoryItems.splice(index, 1);
      renderQuoteInventoryItems();
    }

    function addQuoteItem() {
      const descriptionInput = document.getElementById('quote-extra-description');
      const priceInput = document.getElementById('quote-extra-price');
      const description = descriptionInput.value.trim();
      const price = Number(priceInput.value);
      if (!description || !Number.isFinite(price) || price < 0) {
        showToast('Ingresá una descripción y un importe válido para el concepto', false);
        return;
      }
      quoteExtraItems.push({ description, price });
      descriptionInput.value = '';
      priceInput.value = '';
      renderQuoteExtraItems();
    }

    function removeQuoteItem(index) {
      quoteExtraItems.splice(index, 1);
      renderQuoteExtraItems();
    }

    function getQuoteFormData() {
      return {
        clientId: document.getElementById('quote-client-select').value,
        clientName: document.getElementById('quote-client-name').value.trim(),
        clientPhone: document.getElementById('quote-client-phone').value.trim(),
        clientAddress: document.getElementById('quote-client-address').value.trim(),
        propertyType: document.getElementById('quote-property-type').value,
        serviceType: document.getElementById('quote-service-type').value,
        kit: document.querySelector('input[name="base-kit"]:checked').value,
        inventoryItems: quoteInventoryItems.map(item => ({ ...item })),
        laborHours: Number(document.getElementById('quote-labor-hours').value) || 0,
        laborHourlyRate: Number(document.getElementById('quote-labor-rate').value) || 0,
        discount: Number(document.getElementById('quote-discount').value) || 0,
        extraItems: quoteExtraItems.map(item => ({ ...item })),
        notes: document.getElementById('quote-notes').value.trim()
      };
    }

    function saveQuote() {
      const formData = getQuoteFormData();
      if (!formData.clientName) {
        showToast('Ingresá el nombre del cliente para guardar el presupuesto', false);
        document.getElementById('quote-client-name').focus();
        return;
      }
      const id = activeQuoteId || `PRE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const quote = {
        ...formData,
        id,
        date: new Date().toISOString(),
        total: calculateQuoteTotals().suppliesTotal
      };
      const existingIndex = quotes.findIndex(item => item.id === id);
      if (existingIndex >= 0) quotes[existingIndex] = quote;
      else quotes.unshift(quote);
      activeQuoteId = id;
      saveData('quotes', quotes);
      calculateQuote();
      renderQuotes();
      showToast(`Presupuesto ${id} guardado`);
    }

    function renderQuotes() {
      const tbody = document.getElementById('quotes-table-body');
      if (!quotes.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-500 text-xs">Todavía no hay presupuestos guardados.</td></tr>';
      } else {
        tbody.innerHTML = quotes.map(quote => `
          <tr class="hover:bg-slate-800/40">
            <td class="py-3 px-4"><div class="font-mono text-xs font-bold text-white">${escapeHtml(quote.id)}</div><div class="text-[10px] text-slate-500">${new Date(quote.date).toLocaleDateString('es-AR')}</div></td>
            <td class="py-3 px-4 text-xs text-slate-200">${escapeHtml(quote.clientName)}</td>
            <td class="py-3 px-4 text-xs text-slate-400">${escapeHtml(quote.serviceType)}</td>
            <td class="py-3 px-4 text-xs font-semibold text-white">$${Number(quote.total).toLocaleString('es-AR')}</td>
            <td class="py-3 px-4 text-right whitespace-nowrap">
              <button onclick="showSavedQuote('${escapeHtml(quote.id)}')" title="Abrir presupuesto" class="p-1.5 text-slate-400 hover:text-brand-400"><i class="fa-solid fa-eye"></i></button>
              <button onclick="printQuoteDocument('${escapeHtml(quote.id)}', 'estimate')" title="Imprimir presupuesto de insumos" class="p-1.5 text-slate-400 hover:text-emerald-400"><i class="fa-solid fa-print"></i></button>
              <button onclick="printQuoteDocument('${escapeHtml(quote.id)}', 'final')" title="Imprimir factura final" class="p-1.5 text-slate-400 hover:text-brand-400"><i class="fa-solid fa-file-invoice-dollar"></i></button>
              <button onclick="deleteQuote('${escapeHtml(quote.id)}')" title="Eliminar presupuesto" class="p-1.5 text-slate-400 hover:text-rose-400"><i class="fa-solid fa-trash-can"></i></button>
            </td>
          </tr>
        `).join('');
      }
      document.getElementById('quote-count').innerText = `${quotes.length} presupuesto${quotes.length === 1 ? '' : 's'}`;
    }

    function showSavedQuote(id) {
      const quote = quotes.find(item => item.id === id);
      if (!quote) {
        showToast('No se encontró el presupuesto solicitado', false);
        return;
      }
      loadQuoteIntoForm(quote);
      setQuoteDocumentMode('estimate');
      document.getElementById('quote-date-display').innerText = `Fecha: ${new Date(quote.date).toLocaleDateString('es-AR')}`;
      document.getElementById('print-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function loadQuoteIntoForm(quote) {
      document.getElementById('quote-client-select').value = quote.clientId || '';
      document.getElementById('quote-client-name').value = quote.clientName;
      document.getElementById('quote-client-phone').value = quote.clientPhone || '';
      document.getElementById('quote-client-address').value = quote.clientAddress || '';
      document.getElementById('quote-property-type').value = quote.propertyType;
      document.getElementById('quote-service-type').value = quote.serviceType;
      const kit = document.querySelector(`input[name="base-kit"][value="${quote.kit}"]`);
      if (kit) kit.checked = true;
      updateQuoteInventoryOptions();
      quoteInventoryItems = getSavedQuoteInventoryItems(quote);
      document.getElementById('quote-labor-hours').value = quote.laborHours === undefined ? '1' : quote.laborHours;
      document.getElementById('quote-labor-rate').value = quote.laborHourlyRate === undefined ? Number(quote.labor) || 0 : quote.laborHourlyRate;
      document.getElementById('quote-discount').value = quote.discount;
      document.getElementById('quote-notes').value = quote.notes || '';
      quoteExtraItems = (quote.extraItems || []).map(item => ({ ...item }));
      activeQuoteId = quote.id;
      renderQuoteInventoryItems();
      renderQuoteExtraItems();
      document.getElementById('quote-date-display').innerText = `Fecha: ${new Date(quote.date).toLocaleDateString('es-AR')}`;
    }

    function getSavedQuoteInventoryItems(quote) {
      if (Array.isArray(quote.inventoryItems)) return quote.inventoryItems.map(item => ({ ...item }));

      const items = [];
      const service = String(quote.serviceType || '').toLowerCase();
      const isCctv = service.includes('cámaras') || service.includes('cctv');
      const isAlarm = service.includes('alarmas');
      if (isAlarm && quote.kit === 'alarm_wifi') {
        items.push({ inventoryId: '', description: 'Kit Alarma Inalámbrica', category: 'Alarmas & Sensores', quantity: 1, unitPrice: 210000 });
      }
      if ((isCctv || isAlarm) && Number(quote.cableMeters) > 0) {
        items.push({ inventoryId: '', description: `Cableado (${quote.cableMeters} m)`, category: 'Cables & Fuentes', quantity: Number(quote.cableMeters), unitPrice: 1200 });
      }
      if (isAlarm && Number(quote.sensorsQty) > 0) {
        items.push({ inventoryId: '', description: 'Sensores adicionales', category: 'Alarmas & Sensores', quantity: Number(quote.sensorsQty), unitPrice: 15000 });
      }
      const hddPrice = Number(quote.hdd) || 0;
      if (isCctv && hddPrice > 0) {
        items.push({ inventoryId: '', description: 'Almacenamiento DVR', category: 'CCTV & DVR', quantity: 1, unitPrice: hddPrice });
      }
      return items;
    }

    function calculateQuoteTotals() {
      const includesCameras = getQuoteService() === 'cctv';
      const kit = document.querySelector('input[name="base-kit"]:checked').value;
      const kitPrice = !includesCameras ? 0 : kit === 'cctv_8' ? 340000 : 180000;
      const laborTotal = (Number(document.getElementById('quote-labor-hours').value) || 0) * (Number(document.getElementById('quote-labor-rate').value) || 0);
      const extraTotal = quoteExtraItems.reduce((sum, item) => sum + item.price, 0);
      const inventoryTotal = quoteInventoryItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const subtotal = kitPrice + inventoryTotal + extraTotal;
      const discount = Number(document.getElementById('quote-discount').value) || 0;
      return {
        suppliesTotal: Math.max(0, subtotal - Math.min(discount, subtotal)),
        finalTotal: Math.max(0, subtotal + laborTotal - Math.min(discount, subtotal + laborTotal))
      };
    }

    function deleteQuote(id) {
      if (!confirm(`¿Eliminar el presupuesto ${id}?`)) return;
      quotes = quotes.filter(quote => quote.id !== id);
      saveData('quotes', quotes);
      if (activeQuoteId === id) activeQuoteId = '';
      renderQuotes();
      calculateQuote();
      showToast('Presupuesto eliminado');
    }

    function saveQuoteAsOrder() {
      const formData = getQuoteFormData();
      const clientName = formData.clientName || 'Cliente Cotización';
      
      // Auto create or match client
      let client = clients.find(c => c.id === formData.clientId) || clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
      if (!client) {
        client = {
          id: 'cli-' + Date.now(),
          name: clientName,
          phone: formData.clientPhone || 'Pendiente',
          email: '',
          type: formData.propertyType,
          address: formData.clientAddress || 'A confirmar en visita técnica'
        };
        clients.push(client);
        saveData('clients', clients);
        if (typeof populateClientDropdown === 'function') populateClientDropdown();
        populateQuoteClientDropdown();
        populateObjectClientDropdown();
        if (typeof renderClients === 'function') renderClients();
      }

      // Create service order
      const newOrder = {
        id: 'ORD-' + Math.floor(100 + Math.random() * 900),
        clientId: client.id,
        clientName: client.name,
        type: formData.serviceType.toLowerCase().includes('alarm') ? 'Alarma Anti-Intrusión' : formData.serviceType.toLowerCase().includes('acceso') ? 'Control de Acceso' : formData.serviceType.toLowerCase().includes('reparación') ? 'Reparación Electrónica' : formData.serviceType.toLowerCase().includes('mantenimiento') || formData.serviceType.toLowerCase().includes('otro') ? 'Mantenimiento General' : 'Cámaras CCTV',
        address: formData.clientAddress || client.address,
        priority: 'Media',
        status: 'Pendiente',
        desc: `${formData.serviceType}. Total presupuestado: ${document.getElementById('summary-total-price').innerText}`,
        techNotes: '',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };

      orders.unshift(newOrder);
      saveData('orders', orders);
      
      if (typeof renderOrders === 'function') renderOrders();
      if (typeof renderDashboard === 'function') renderDashboard();
      switchTab('orders');
      showToast('Cotización convertida en Orden de Servicio');
    }
