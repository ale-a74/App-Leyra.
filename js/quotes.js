    // ================= 4. QUICK QUOTE CALCULATOR LOGIC =================
    let quoteBrandLogoPreview = '';
    let editingBaseKitId = null;
    let baseKitDraftItems = [];
    let quoteKitSnapshot = null;

    function getBaseKitItemPrice(item) {
      if (item.sourcePrice !== undefined) {
        return getInventoryPriceInPesos({ price: item.sourcePrice, priceCurrency: item.priceCurrency || 'ARS' });
      }
      if (item.priceCurrency === 'USD') {
        return getInventoryPriceInPesos({ price: item.unitPrice, priceCurrency: 'USD' });
      }
      return Number(item.unitPrice) || 0;
    }

    function getBaseKitPrice(kit) {
      const items = Array.isArray(kit?.items) ? kit.items : [];
      if (items.some(item => getBaseKitItemPrice(item) === null)) return null;
      return items.reduce((total, item) => total + (Number(item.quantity) || 0) * getBaseKitItemPrice(item), 0);
    }

    function formatBaseKitPrice(price) {
      return price === null ? 'Cotización pendiente' : `$${price.toLocaleString('es-AR')}`;
    }

    function getQuoteInventoryItemPrice(item) {
      return item.sourcePrice !== undefined
        ? getInventoryPriceInPesos({ price: item.sourcePrice, priceCurrency: item.priceCurrency || 'ARS' })
        : Number(item.unitPrice) || 0;
    }

    function getSelectedBaseKit() {
      const selectedId = document.querySelector('input[name="base-kit"]:checked')?.value || 'none';
      if (selectedId === 'none') return null;
      if (quoteKitSnapshot && quoteKitSnapshot.id === selectedId) return quoteKitSnapshot;
      return quoteKits.find(kit => kit.id === selectedId) || null;
    }

    function renderQuoteKits(selectedId = document.querySelector('input[name="base-kit"]:checked')?.value || 'cctv_4', snapshot = quoteKitSnapshot) {
      const container = document.getElementById('quote-base-kits');
      if (!container) return;
      const kitsToShow = quoteKits.map(kit => snapshot && snapshot.id === kit.id ? snapshot : kit);
      if (snapshot && snapshot.id && !kitsToShow.some(kit => kit.id === snapshot.id)) kitsToShow.push(snapshot);
      const selectedKitId = kitsToShow.some(kit => kit.id === selectedId) ? selectedId : 'none';

      container.innerHTML = `
        <div class="relative rounded-xl border border-slate-800 bg-slate-950 ${selectedKitId === 'none' ? 'ring-1 ring-brand-500 bg-brand-500/10' : ''}">
          <input id="base-kit-none" type="radio" name="base-kit" value="none" ${selectedKitId === 'none' ? 'checked' : ''} class="peer sr-only">
          <label for="base-kit-none" class="block cursor-pointer p-3 pr-10 text-center">
            <i class="fa-solid fa-ban text-slate-400 text-lg mb-1 block"></i>
            <span class="text-xs font-bold block text-white">Sin kit base</span>
            <span class="text-xs text-slate-400 font-medium">$0</span>
          </label>
        </div>
        ${kitsToShow.map(kit => {
          const isSnapshotOnly = !quoteKits.some(entry => entry.id === kit.id);
          const selected = kit.id === selectedKitId;
          return `
            <div class="relative rounded-xl border border-slate-800 bg-slate-950 ${selected ? 'ring-1 ring-brand-500 bg-brand-500/10' : ''}">
              <input id="base-kit-${escapeHtml(kit.id)}" type="radio" name="base-kit" value="${escapeHtml(kit.id)}" ${selected ? 'checked' : ''} class="peer sr-only">
              <label for="base-kit-${escapeHtml(kit.id)}" class="block cursor-pointer p-3 pr-20 text-center">
                <i class="fa-solid fa-video text-brand-400 text-lg mb-1 block"></i>
                <span class="text-xs font-bold block text-white">${escapeHtml(kit.name)}</span>
                <span class="text-xs text-slate-400 font-medium">${formatBaseKitPrice(getBaseKitPrice(kit))}</span>
              </label>
              ${isSnapshotOnly
                ? '<span class="absolute right-2 top-2 text-[10px] text-slate-500">Guardado</span>'
                : `<div class="absolute right-2 top-2 flex gap-1">
                    <button type="button" data-edit-kit="${escapeHtml(kit.id)}" aria-label="Editar ${escapeHtml(kit.name)}" title="Editar kit" class="p-1 text-slate-400 hover:text-brand-400"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" data-delete-kit="${escapeHtml(kit.id)}" aria-label="Eliminar ${escapeHtml(kit.name)}" title="Eliminar kit" class="p-1 text-slate-400 hover:text-rose-400"><i class="fa-solid fa-trash-can"></i></button>
                  </div>`}
            </div>
          `;
        }).join('')}
      `;
      container.querySelectorAll('input[name="base-kit"]').forEach(input => {
        input.addEventListener('change', () => {
          if (!quoteKitSnapshot || quoteKitSnapshot.id !== input.value) quoteKitSnapshot = null;
          renderQuoteKits(input.value, quoteKitSnapshot);
          calculateQuote();
        });
      });
      container.querySelectorAll('[data-edit-kit]').forEach(button => {
        button.addEventListener('click', () => openBaseKitEditor(button.dataset.editKit));
      });
      container.querySelectorAll('[data-delete-kit]').forEach(button => {
        button.addEventListener('click', () => deleteBaseKit(button.dataset.deleteKit));
      });
    }

    function populateBaseKitInventoryOptions() {
      const select = document.getElementById('base-kit-inventory-select');
      select.innerHTML = inventory.map(item => `
        <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.category)} · ${formatInventoryPriceARS(item)}</option>
      `).join('');
      select.disabled = inventory.length === 0;
      document.getElementById('base-kit-inventory-quantity').disabled = inventory.length === 0;
      select.parentElement.querySelector('button').disabled = inventory.length === 0;
    }

    function openBaseKitEditor(id = '') {
      const kit = quoteKits.find(entry => entry.id === id);
      if (id && !kit) {
        showToast('No se encontró el kit para editar', false);
        return;
      }
      editingBaseKitId = kit ? kit.id : null;
      baseKitDraftItems = kit ? kit.items.map(item => ({ ...item })) : [];
      document.getElementById('base-kit-form').reset();
      document.getElementById('base-kit-name').value = kit ? kit.name : '';
      document.getElementById('base-kit-modal-title').textContent = kit ? 'Editar kit base' : 'Nuevo kit base';
      document.getElementById('base-kit-custom-name').value = '';
      document.getElementById('base-kit-custom-price').value = '';
      document.getElementById('base-kit-inventory-quantity').value = '1';
      populateBaseKitInventoryOptions();
      renderBaseKitDraft();
      openModal('base-kit-modal');
    }

    function closeBaseKitEditor() {
      closeModal('base-kit-modal');
      editingBaseKitId = null;
      baseKitDraftItems = [];
    }

    function renderBaseKitDraft() {
      document.getElementById('base-kit-components').innerHTML = baseKitDraftItems.map((item, index) => {
        const unitPrice = getBaseKitItemPrice(item);
        const linePrice = unitPrice === null ? null : item.quantity * unitPrice;
        return `
          <div class="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
            <span class="min-w-0 text-slate-300">${escapeHtml(item.description)} <span class="text-slate-500">(${item.quantity} × ${formatBaseKitPrice(unitPrice)})</span></span>
            <span class="shrink-0 font-semibold text-white">${formatBaseKitPrice(linePrice)}</span>
            <button type="button" data-remove-kit-item="${index}" aria-label="Quitar ${escapeHtml(item.description)}" class="shrink-0 text-slate-500 hover:text-rose-400"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        `;
      }).join('');
      document.getElementById('base-kit-total').textContent = formatBaseKitPrice(getBaseKitPrice({ items: baseKitDraftItems }));
      document.querySelectorAll('[data-remove-kit-item]').forEach(button => {
        button.addEventListener('click', () => {
          baseKitDraftItems.splice(Number(button.dataset.removeKitItem), 1);
          renderBaseKitDraft();
        });
      });
    }

    function addInventoryItemToBaseKit() {
      const item = inventory.find(entry => entry.id === document.getElementById('base-kit-inventory-select').value);
      const quantity = Number(document.getElementById('base-kit-inventory-quantity').value);
      if (!item || !Number.isInteger(quantity) || quantity < 1) {
        showToast('Elegí un artículo del inventario y una cantidad válida', false);
        return;
      }
      const unitPrice = getInventoryPriceInPesos(item);
      if (unitPrice === null) {
        showToast('Cargá una cotización del dólar válida antes de agregar este artículo al kit', false);
        return;
      }
      const existing = baseKitDraftItems.find(entry => entry.inventoryId === item.id);
      if (existing) existing.quantity += quantity;
      else baseKitDraftItems.push({
        inventoryId: item.id,
        description: item.name,
        category: item.category,
        quantity,
        unitPrice,
        sourcePrice: Number(item.price),
        priceCurrency: item.priceCurrency || 'ARS'
      });
      document.getElementById('base-kit-inventory-quantity').value = '1';
      renderBaseKitDraft();
    }

    function addCustomItemToBaseKit() {
      const nameInput = document.getElementById('base-kit-custom-name');
      const priceInput = document.getElementById('base-kit-custom-price');
      const description = nameInput.value.trim();
      const unitPrice = Number(priceInput.value);
      if (!description || !Number.isFinite(unitPrice) || unitPrice < 0) {
        showToast('Ingresá el nombre y un precio válido para el componente', false);
        return;
      }
      baseKitDraftItems.push({ inventoryId: '', description, category: 'Personalizado', quantity: 1, unitPrice });
      nameInput.value = '';
      priceInput.value = '';
      renderBaseKitDraft();
    }

    function saveBaseKit(event) {
      event.preventDefault();
      const name = document.getElementById('base-kit-name').value.trim();
      if (!name) {
        showToast('Ingresá el nombre del kit', false);
        return;
      }
      if (quoteKits.some(kit => kit.id !== editingBaseKitId && kit.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        showToast('Ya existe un kit con ese nombre', false);
        return;
      }
      const id = editingBaseKitId || `kit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kit = { id, name, items: baseKitDraftItems.map(item => ({ ...item })) };
      const index = quoteKits.findIndex(entry => entry.id === id);
      if (index >= 0) quoteKits[index] = kit;
      else quoteKits.push(kit);
      saveData('quoteKits', quoteKits);
      quoteKitSnapshot = quoteKitSnapshot && quoteKitSnapshot.id === id
        ? { ...kit, items: kit.items.map(item => ({ ...item })) }
        : null;
      closeBaseKitEditor();
      renderQuoteKits(id, quoteKitSnapshot);
      calculateQuote();
      showToast('Kit guardado');
    }

    function deleteBaseKit(id) {
      const kit = quoteKits.find(entry => entry.id === id);
      if (!kit || !confirm(`¿Eliminar el kit "${kit.name}"?`)) return;
      const selectedId = document.querySelector('input[name="base-kit"]:checked')?.value;
      quoteKits = quoteKits.filter(entry => entry.id !== id);
      saveData('quoteKits', quoteKits);
      const preserveSnapshot = quoteKitSnapshot && quoteKitSnapshot.id === id;
      if (!preserveSnapshot) quoteKitSnapshot = null;
      renderQuoteKits(selectedId === id && !preserveSnapshot ? 'none' : selectedId, quoteKitSnapshot);
      calculateQuote();
      showToast('Kit eliminado');
    }

    function initializeQuoteBranding() {
      document.getElementById('branding-business-name').value = quoteBranding.businessName;
      document.getElementById('branding-tagline').value = quoteBranding.tagline;
      document.getElementById('branding-phone').value = quoteBranding.phone;
      document.getElementById('branding-mobile').value = quoteBranding.mobile || '';
      document.getElementById('branding-email').value = quoteBranding.email;
      document.getElementById('branding-address').value = quoteBranding.address;
      document.getElementById('branding-locality').value = quoteBranding.locality || '';
      document.getElementById('branding-province').value = quoteBranding.province || '';
      document.getElementById('branding-postal-code').value = quoteBranding.postalCode || '';
      document.getElementById('branding-tax-id').value = quoteBranding.taxId || '';
      document.getElementById('branding-tax-condition').value = quoteBranding.taxCondition || '';
      document.getElementById('branding-gross-income').value = quoteBranding.grossIncome || '';
      document.getElementById('branding-activity-start').value = quoteBranding.activityStart || '';
      document.getElementById('branding-color').value = quoteBranding.color;
      document.getElementById('branding-theme').value = quoteBranding.theme;
      quoteBrandLogoPreview = quoteBranding.logo;
      previewQuoteBranding();
    }

    function previewQuoteBranding() {
      const businessName = document.getElementById('branding-business-name').value.trim() || 'Leyra Seguridad';
      const tagline = document.getElementById('branding-tagline').value.trim();
      const location = [
        document.getElementById('branding-locality').value.trim(),
        document.getElementById('branding-province').value.trim()
          ? `Pcia. ${document.getElementById('branding-province').value.trim()}`
          : '',
        document.getElementById('branding-postal-code').value.trim()
          ? `CP ${document.getElementById('branding-postal-code').value.trim()}`
          : ''
      ].filter(Boolean).join(' · ');
      const color = document.getElementById('branding-color').value || '#E53935';
      const theme = document.getElementById('branding-theme').value;
      const preview = document.getElementById('print-area');
      const logo = document.getElementById('summary-brand-logo');

      document.getElementById('summary-brand-name').textContent = businessName;
      document.getElementById('summary-brand-tagline').textContent = tagline;
      document.getElementById('summary-brand-tagline').classList.toggle('hidden', !tagline);
      setQuoteSummaryField('summary-brand-address', 'Domicilio', document.getElementById('branding-address').value.trim());
      setQuoteSummaryField('summary-brand-location', '', location);
      setQuoteSummaryField('summary-brand-phone', 'Tel.', document.getElementById('branding-phone').value.trim());
      setQuoteSummaryField('summary-brand-mobile', 'Cel.', document.getElementById('branding-mobile').value.trim());
      setQuoteSummaryField('summary-brand-email', '', document.getElementById('branding-email').value.trim());
      setQuoteSummaryField('summary-brand-tax-id', 'CUIT', document.getElementById('branding-tax-id').value.trim());
      setQuoteSummaryField('summary-brand-tax-condition', 'IVA', document.getElementById('branding-tax-condition').value.trim());
      setQuoteSummaryField('summary-brand-gross-income', 'Ing. Brutos', document.getElementById('branding-gross-income').value.trim());
      setQuoteSummaryField('summary-brand-activity-start', 'Inicio', document.getElementById('branding-activity-start').value.trim());
      logo.alt = `Logo de ${businessName}`;
      logo.classList.toggle('hidden', !quoteBrandLogoPreview);
      if (quoteBrandLogoPreview) logo.src = quoteBrandLogoPreview;
      preview.dataset.quoteTheme = ['classic', 'modern', 'minimal'].includes(theme) ? theme : 'classic';
      preview.style.setProperty('--quote-brand-color', color);
      document.getElementById('summary-total-price').style.color = color;
    }

    function setQuoteSummaryField(id, label, value) {
      const element = document.getElementById(id);
      element.textContent = value ? (label ? `${label}: ${value}` : value) : '';
      element.classList.toggle('hidden', !value);
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
        mobile: document.getElementById('branding-mobile').value.trim(),
        email: document.getElementById('branding-email').value.trim(),
        address: document.getElementById('branding-address').value.trim(),
        postalCode: document.getElementById('branding-postal-code').value.trim(),
        locality: document.getElementById('branding-locality').value.trim(),
        province: document.getElementById('branding-province').value.trim(),
        taxId: document.getElementById('branding-tax-id').value.trim(),
        taxCondition: document.getElementById('branding-tax-condition').value.trim(),
        grossIncome: document.getElementById('branding-gross-income').value.trim(),
        activityStart: document.getElementById('branding-activity-start').value.trim(),
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
      document.getElementById('quote-client-number').value = client.clientNumber || '';
      document.getElementById('quote-client-tax-id').value = client.taxId || '';
      document.getElementById('quote-client-address').value = client.address || '';
      document.getElementById('quote-client-locality').value = client.locality || '';
      document.getElementById('quote-client-province').value = client.province || '';
      document.getElementById('quote-client-postal-code').value = client.postalCode || '';
      document.getElementById('quote-client-contact').value = client.contact || client.contactName || '';
      document.getElementById('quote-client-tax-condition').value = client.taxCondition || client.iva || '';
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
        <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.category)} · ${formatInventoryPriceARS(item)}</option>
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
      const selectedKit = getSelectedBaseKit();
      const kitPrice = includesCameras && selectedKit ? getBaseKitPrice(selectedKit) || 0 : 0;

      const laborHours = Number(document.getElementById('quote-labor-hours').value) || 0;
      const laborRate = Number(document.getElementById('quote-labor-rate').value) || 0;
      const laborPrice = laborHours * laborRate;
      const inventoryItemsTotal = quoteInventoryItems.reduce((sum, item) => sum + item.quantity * (getQuoteInventoryItemPrice(item) || 0), 0);
      const suppliesSubtotal = kitPrice + inventoryItemsTotal + quoteExtraItems.reduce((sum, item) => sum + item.price, 0);
      const requestedDiscount = Number(document.getElementById('quote-discount').value) || 0;
      const discount = Math.min(requestedDiscount, quoteDocumentMode === 'final' ? suppliesSubtotal + laborPrice : suppliesSubtotal);
      const suppliesTotal = Math.max(0, suppliesSubtotal - Math.min(requestedDiscount, suppliesSubtotal));
      const finalTotal = Math.max(0, suppliesSubtotal + laborPrice - Math.min(requestedDiscount, suppliesSubtotal + laborPrice));
      const total = quoteDocumentMode === 'final' ? finalTotal : suppliesTotal;
      const quoteLines = [
        ...(includesCameras && selectedKit ? selectedKit.items.map(item => ({ ...item, unitPrice: getBaseKitItemPrice(item) || 0 })) : []),
        ...quoteInventoryItems.map(item => ({ ...item, unitPrice: getQuoteInventoryItemPrice(item) || 0 })),
        ...quoteExtraItems.map(item => ({ code: '', description: item.description, quantity: 1, unitPrice: item.price })),
        ...(quoteDocumentMode === 'final' && laborPrice > 0
          ? [{ code: '', description: 'Mano de obra', quantity: laborHours, unitPrice: laborRate }]
          : [])
      ];

      // Update UI elements
      document.getElementById('summary-client-name').innerText = clientName;
      setQuoteSummaryField('summary-client-number', 'Nº cliente', document.getElementById('quote-client-number').value.trim());
      setQuoteSummaryField('summary-client-tax-id', 'CUIT', document.getElementById('quote-client-tax-id').value.trim());
      setQuoteSummaryField('summary-client-address', 'Dirección', clientAddress);
      setQuoteSummaryField('summary-client-locality', 'Localidad', document.getElementById('quote-client-locality').value.trim());
      setQuoteSummaryField('summary-client-province', 'Provincia', document.getElementById('quote-client-province').value.trim());
      setQuoteSummaryField('summary-client-postal-code', 'C.P.', document.getElementById('quote-client-postal-code').value.trim());
      setQuoteSummaryField('summary-client-contact', 'Contacto', document.getElementById('quote-client-contact').value.trim());
      setQuoteSummaryField('summary-client-tax-condition', 'IVA', document.getElementById('quote-client-tax-condition').value.trim());
      setQuoteSummaryField('summary-client-phone', 'Tel.', clientPhone);
      document.getElementById('summary-property-type').innerText = propertyType;
      document.getElementById('summary-service-type').innerText = serviceType;
      
      document.getElementById('quote-labor-internal-total').innerText = `$${laborPrice.toLocaleString('es-AR')}`;
      document.getElementById('summary-item-rows').innerHTML = quoteLines.map(item => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        return `
          <tr>
            <td>${escapeHtml(item.code || '0')}</td>
            <td>${escapeHtml(item.description)}</td>
            <td class="text-right">${quantity.toLocaleString('es-AR')}</td>
            <td class="text-right">$ ${unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td class="text-right">$ ${(quantity * unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');
      const displayedSubtotal = quoteDocumentMode === 'final' ? suppliesSubtotal + laborPrice : suppliesSubtotal;
      document.getElementById('summary-subtotal-price').innerText = `$ ${displayedSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
      document.getElementById('summary-notes').innerText = document.getElementById('quote-notes').value;

      document.getElementById('summary-total-price').innerText = `$ ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
      document.getElementById('quote-number-display').innerText = `Nº ${activeQuoteId || 'BORRADOR'}`;
      document.getElementById('summary-document-title').innerText = quoteDocumentMode === 'final' ? 'Factura' : 'Presupuesto';
      document.getElementById('summary-document-badge').innerText = quoteDocumentMode === 'final' ? 'Final' : 'Insumos';
      document.getElementById('summary-total-label').innerText = 'Total:';
      document.getElementById('summary-validity').classList.toggle('hidden', quoteDocumentMode === 'final');
      document.getElementById('summary-discount-row').classList.toggle('hidden', discount <= 0);
      if (discount > 0) document.getElementById('summary-discount-price').innerText = `-$ ${discount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
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
      quoteKitSnapshot = null;
      renderQuoteKits('cctv_4');
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
      list.innerHTML = quoteInventoryItems.map((item, index) => {
        const unitPrice = getQuoteInventoryItemPrice(item) || 0;
        return `
          <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
            <span class="text-slate-300">${escapeHtml(item.description)} <span class="text-slate-500">(${item.quantity} × $${unitPrice.toLocaleString('es-AR')})</span></span>
            <span class="font-semibold text-white">$${(item.quantity * unitPrice).toLocaleString('es-AR')}</span>
            <button type="button" onclick="removeInventoryQuoteItem(${index})" class="text-slate-500 hover:text-rose-400" aria-label="Quitar ${escapeHtml(item.description)}"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        `;
      }).join('');
      calculateQuote();
    }

    function addInventoryQuoteItem() {
      const item = inventory.find(entry => entry.id === document.getElementById('quote-inventory-select').value);
      const quantity = Number(document.getElementById('quote-inventory-quantity').value);
      if (!item || !Number.isInteger(quantity) || quantity < 1) {
        showToast('Elegí un artículo del inventario y una cantidad válida', false);
        return;
      }
      const unitPrice = getInventoryPriceInPesos(item);
      if (unitPrice === null) {
        showToast('Cargá una cotización del dólar válida antes de agregar este artículo al presupuesto', false);
        return;
      }
      const existing = quoteInventoryItems.find(entry => entry.inventoryId === item.id);
      if (existing) existing.quantity += quantity;
      else quoteInventoryItems.push({
        inventoryId: item.id,
        description: item.name,
        category: item.category,
        quantity,
        unitPrice,
        sourcePrice: Number(item.price),
        priceCurrency: item.priceCurrency || 'ARS'
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
        clientNumber: document.getElementById('quote-client-number').value.trim(),
        clientTaxId: document.getElementById('quote-client-tax-id').value.trim(),
        clientAddress: document.getElementById('quote-client-address').value.trim(),
        clientLocality: document.getElementById('quote-client-locality').value.trim(),
        clientProvince: document.getElementById('quote-client-province').value.trim(),
        clientPostalCode: document.getElementById('quote-client-postal-code').value.trim(),
        clientContact: document.getElementById('quote-client-contact').value.trim(),
        clientTaxCondition: document.getElementById('quote-client-tax-condition').value.trim(),
        propertyType: document.getElementById('quote-property-type').value,
        serviceType: document.getElementById('quote-service-type').value,
        kit: document.querySelector('input[name="base-kit"]:checked')?.value || 'none',
        inventoryItems: quoteInventoryItems.map(item => {
          const savedItem = { ...item };
          delete savedItem.sourcePrice;
          delete savedItem.priceCurrency;
          savedItem.unitPrice = getQuoteInventoryItemPrice(item) || 0;
          return savedItem;
        }),
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
      const selectedKit = getSelectedBaseKit();
      if (getQuoteService() === 'cctv' && selectedKit && getBaseKitPrice(selectedKit) === null) {
        showToast('Cargá una cotización del dólar válida antes de guardar el presupuesto', false);
        return;
      }
      const savedKitItems = selectedKit?.items.map(item => {
        const unitPrice = getBaseKitItemPrice(item);
        if (unitPrice === null) return { ...item };
        const savedItem = { ...item, unitPrice };
        delete savedItem.sourcePrice;
        delete savedItem.priceCurrency;
        return savedItem;
      }) || [];
      const id = activeQuoteId || `PRE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const quote = {
        ...formData,
        kitName: selectedKit?.name || '',
        kitPrice: selectedKit ? getBaseKitPrice(selectedKit) || 0 : 0,
        kitItems: savedKitItems,
        id,
        date: new Date().toISOString(),
        total: calculateQuoteTotals().suppliesTotal
      };
      const existingIndex = quotes.findIndex(item => item.id === id);
      if (existingIndex >= 0) quotes[existingIndex] = quote;
      else quotes.unshift(quote);
      activeQuoteId = id;
      saveData('quotes', quotes);
      quoteInventoryItems = formData.inventoryItems.map(item => ({ ...item }));
      quoteKitSnapshot = selectedKit ? { ...selectedKit, items: savedKitItems.map(item => ({ ...item })) } : null;
      renderQuoteKits(selectedKit?.id || 'none', quoteKitSnapshot);
      renderQuoteInventoryItems();
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
      document.getElementById('quote-client-number').value = quote.clientNumber || '';
      document.getElementById('quote-client-tax-id').value = quote.clientTaxId || '';
      document.getElementById('quote-client-address').value = quote.clientAddress || '';
      document.getElementById('quote-client-locality').value = quote.clientLocality || '';
      document.getElementById('quote-client-province').value = quote.clientProvince || '';
      document.getElementById('quote-client-postal-code').value = quote.clientPostalCode || '';
      document.getElementById('quote-client-contact').value = quote.clientContact || '';
      document.getElementById('quote-client-tax-condition').value = quote.clientTaxCondition || '';
      document.getElementById('quote-property-type').value = quote.propertyType;
      document.getElementById('quote-service-type').value = quote.serviceType;
      quoteKitSnapshot = getQuoteKitSnapshot(quote);
      renderQuoteKits(quote.kit || 'none', quoteKitSnapshot);
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

    function getQuoteKitSnapshot(quote) {
      if (!quote.kit || quote.kit === 'none') return null;
      if (Array.isArray(quote.kitItems)) {
        return { id: quote.kit, name: quote.kitName || 'Kit Base', items: quote.kitItems.map(item => ({ ...item })) };
      }
      if (!['cctv_4', 'cctv_8'].includes(quote.kit)) return null;
      const legacyKit = quote.kit === 'cctv_8'
        ? { name: 'Kit 8 Cámaras 4K Hikvision', price: 340000 }
        : { name: 'Kit 4 Cámaras 1080p', price: 180000 };
      return {
        id: quote.kit,
        name: legacyKit.name,
        items: [{ inventoryId: '', description: legacyKit.name, category: 'Kit Base', quantity: 1, unitPrice: legacyKit.price }]
      };
    }

    function calculateQuoteTotals() {
      const includesCameras = getQuoteService() === 'cctv';
      const selectedKit = getSelectedBaseKit();
      const kitPrice = includesCameras && selectedKit ? getBaseKitPrice(selectedKit) || 0 : 0;
      const laborTotal = (Number(document.getElementById('quote-labor-hours').value) || 0) * (Number(document.getElementById('quote-labor-rate').value) || 0);
      const extraTotal = quoteExtraItems.reduce((sum, item) => sum + item.price, 0);
      const inventoryTotal = quoteInventoryItems.reduce((sum, item) => sum + item.quantity * (getQuoteInventoryItemPrice(item) || 0), 0);
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
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        totalAmount: Math.round(calculateQuoteTotals().finalTotal * 100) / 100,
        payments: []
      };

      orders.unshift(newOrder);
      saveData('orders', orders);
      
      if (typeof renderOrders === 'function') renderOrders();
      if (typeof renderDashboard === 'function') renderDashboard();
      switchTab('orders');
      showToast('Cotización convertida en Orden de Servicio');
    }
