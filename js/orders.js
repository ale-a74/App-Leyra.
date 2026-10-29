    // ================= 2. ORDERS LOGIC =================
    function renderOrders() {
      const search = document.getElementById('order-search').value.toLowerCase();
      const statusFilter = document.getElementById('order-status-filter').value;
      const typeFilter = document.getElementById('order-type-filter').value;

      const filtered = orders.filter(o => {
        const matchesSearch = o.id.toLowerCase().includes(search) ||
                              o.clientName.toLowerCase().includes(search) ||
                              o.address.toLowerCase().includes(search);
        const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
        const matchesType = typeFilter === 'ALL' || o.type === typeFilter;

        return matchesSearch && matchesStatus && matchesType;
      });

      const tbody = document.getElementById('orders-table-body');
      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="py-8 text-center text-slate-500 text-xs">
              No se encontraron órdenes que coincidan con la búsqueda.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(o => `
        <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/60">
          <td class="py-3 px-4 font-mono text-xs font-bold text-slate-200">
            <div>${o.id}</div>
            <div class="text-[10px] font-sans font-normal text-slate-500">${o.date}</div>
          </td>
          <td class="py-3 px-4">
            <div class="font-semibold text-white text-xs">${escapeHtml(o.clientName)}</div>
            <div class="text-[11px] text-slate-400 truncate max-w-[180px]">${escapeHtml(o.address)}</div>
          </td>
          <td class="py-3 px-4">
            <span class="text-xs bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300 font-medium">${o.type}</span>
          </td>
          <td class="py-3 px-4">
            <span class="text-[11px] font-semibold ${o.priority === 'Alta' ? 'text-rose-400' : o.priority === 'Media' ? 'text-amber-400' : 'text-slate-400'}">
              ${o.priority}
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="text-[10px] px-2.5 py-1 rounded-full font-semibold ${getStatusBadgeClass(o.status)}">
              ${o.status}
            </span>
          </td>
          <td class="py-3 px-4 text-right space-x-1">
            <button onclick="editOrder('${o.id}')" title="Editar u Operar Orden" class="p-1.5 text-slate-400 hover:text-brand-400 transition">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="deleteOrder('${o.id}')" title="Eliminar Orden" class="p-1.5 text-slate-400 hover:text-rose-400 transition">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }

    function populateClientDropdown() {
      const select = document.getElementById('form-order-client');
      select.innerHTML = clients.map(c => `
        <option value="${c.id}">${escapeHtml(c.name)} - ${escapeHtml(c.address)}</option>
      `).join('');
    }

    function handleOrderSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('order-id').value;
      const clientId = document.getElementById('form-order-client').value;
      const clientObj = clients.find(c => c.id === clientId);

      const orderData = {
        id: id || 'ORD-' + Math.floor(100 + Math.random() * 900),
        clientId: clientId,
        clientName: clientObj ? clientObj.name : 'Cliente General',
        type: document.getElementById('form-order-type').value,
        address: document.getElementById('form-order-address').value,
        priority: document.getElementById('form-order-priority').value,
        status: document.getElementById('form-order-status').value,
        desc: document.getElementById('form-order-desc').value,
        techNotes: document.getElementById('form-order-tech-notes').value,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };

      if (id) {
        const index = orders.findIndex(o => o.id === id);
        if (index !== -1) orders[index] = orderData;
        showToast('Orden actualizada correctamente');
      } else {
        orders.unshift(orderData);
        showToast('Nueva orden de servicio creada');
      }

      saveData('orders', orders);
      closeModal('new-order-modal');
      document.getElementById('order-form').reset();
      document.getElementById('order-id').value = '';
      
      renderOrders();
      if (typeof renderDashboard === 'function') renderDashboard();
    }

    function editOrder(orderId) {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      document.getElementById('order-id').value = order.id;
      document.getElementById('order-modal-title').innerText = `Editar Orden ${order.id}`;
      document.getElementById('form-order-client').value = order.clientId;
      document.getElementById('form-order-type').value = order.type;
      document.getElementById('form-order-address').value = order.address;
      document.getElementById('form-order-priority').value = order.priority;
      document.getElementById('form-order-status').value = order.status;
      document.getElementById('form-order-desc').value = order.desc;
      document.getElementById('form-order-tech-notes').value = order.techNotes || '';

      openModal('new-order-modal');
    }

    function deleteOrder(orderId) {
      if (confirm(`¿Está seguro de eliminar la orden ${orderId}?`)) {
        orders = orders.filter(o => o.id !== orderId);
        saveData('orders', orders);
        renderOrders();
        if (typeof renderDashboard === 'function') renderDashboard();
        showToast('Orden eliminada');
      }
    }
