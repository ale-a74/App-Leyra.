    // ================= 3. CLIENTS LOGIC =================
    function renderClients() {
      const search = document.getElementById('client-search').value.toLowerCase();
      const filtered = clients.filter(c => 
        c.name.toLowerCase().includes(search) || 
        c.address.toLowerCase().includes(search) ||
        c.phone.includes(search)
      );

      const grid = document.getElementById('clients-grid');
      if (filtered.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center py-8 text-slate-500 text-xs">No hay clientes registrados.</p>`;
        return;
      }

      grid.innerHTML = filtered.map(c => {
        const clientOrders = orders.filter(o => o.clientId === c.id);
        return `
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition">
            <div class="flex justify-between items-start">
              <div>
                <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-md">
                  ${c.type}
                </span>
                <h4 class="font-bold text-white text-base mt-2">${escapeHtml(c.name)}</h4>
              </div>
              <button onclick="deleteClient('${c.id}')" class="text-slate-500 hover:text-rose-400 text-xs">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div class="space-y-1.5 text-xs text-slate-400">
              <p class="flex items-center space-x-2">
                <i class="fa-solid fa-location-dot w-4 text-center text-slate-500"></i>
                <span class="text-slate-300">${escapeHtml(c.address)}</span>
              </p>
              <p class="flex items-center space-x-2">
                <i class="fa-solid fa-phone w-4 text-center text-slate-500"></i>
                <span>${escapeHtml(c.phone)}</span>
              </p>
              ${c.email ? `
                <p class="flex items-center space-x-2">
                  <i class="fa-solid fa-envelope w-4 text-center text-slate-500"></i>
                  <span>${escapeHtml(c.email)}</span>
                </p>
              ` : ''}
            </div>

            <div class="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
              <span class="text-slate-500">${clientOrders.length} servicio(s) asociados</span>
              <button onclick="filterOrdersByClient('${c.id}')" class="text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1">
                <span>Historial</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    function handleClientSubmit(e) {
      e.preventDefault();
      const newClient = {
        id: 'cli-' + Date.now(),
        name: document.getElementById('form-client-name').value,
        phone: document.getElementById('form-client-phone').value,
        email: document.getElementById('form-client-email').value,
        type: document.getElementById('form-client-type').value,
        address: document.getElementById('form-client-address').value
      };

      clients.push(newClient);
      saveData('clients', clients);
      
      if (typeof populateClientDropdown === 'function') populateClientDropdown();
      populateQuoteClientDropdown();
      populateObjectClientDropdown();
      renderClients();
      if (typeof renderObjects === 'function') renderObjects();
      if (typeof renderDashboard === 'function') renderDashboard();
      closeModal('new-client-modal');
      document.getElementById('client-form').reset();
      showToast('Cliente guardado con éxito');
    }

    function deleteClient(id) {
      if (confirm('¿Desea eliminar este cliente? Se mantendrán sus órdenes pasadas.')) {
        clients = clients.filter(c => c.id !== id);
        saveData('clients', clients);
        renderClients();
        if (typeof populateClientDropdown === 'function') populateClientDropdown();
        populateQuoteClientDropdown();
        populateObjectClientDropdown();
        if (typeof renderObjects === 'function') renderObjects();
        if (typeof renderDashboard === 'function') renderDashboard();
        showToast('Cliente eliminado');
      }
    }

    function filterOrdersByClient(clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        window.location.href = `ordenes.html?client=${encodeURIComponent(client.name)}`;
      }
    }
