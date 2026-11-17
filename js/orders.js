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
      if (!tbody.dataset.orderInteractionsAttached) {
        tbody.addEventListener('click', event => {
          const button = event.target.closest('button[data-order-action]');
          if (button) {
            const orderId = button.dataset.orderId || button.closest('tr[data-order-id]')?.dataset.orderId;
            if (button.dataset.orderAction === 'edit') editOrder(orderId);
            if (button.dataset.orderAction === 'delete') deleteOrder(orderId);
            if (button.dataset.orderAction === 'payment') openOrderPayment(orderId);
            return;
          }

          const row = event.target.closest('tr[data-order-id]');
          if (!row) return;
          toggleOrderDetails(row);
        });
        tbody.addEventListener('keydown', event => {
          const row = event.target.closest('tr[data-order-id]');
          if (!row || event.target.closest('button') || !['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          toggleOrderDetails(row);
        });
        tbody.dataset.orderInteractionsAttached = 'true';
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="py-8 text-center text-slate-500 text-xs">
              No se encontraron órdenes que coincidan con la búsqueda.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map((o, index) => {
        const orderId = escapeHtml(String(o.id || ''));
        const description = escapeHtml(o.desc || 'Sin descripción.');
        const techNotes = escapeHtml(o.techNotes || 'Sin notas de trabajo.');
        const total = roundOrderMoney(o.totalAmount);
        const paid = getOrderPaidAmount(o);
        const balance = roundOrderMoney(Math.max(0, total - paid));
        const payments = Array.isArray(o.payments) ? o.payments : [];
        const paymentHistory = payments.length
          ? payments.map(payment => `
              <li class="flex flex-wrap justify-between gap-2 text-xs text-slate-300">
                <span>${escapeHtml(formatOrderDate(payment.date))}${payment.note ? ` · ${escapeHtml(payment.note)}` : ''}</span>
                <span class="font-semibold text-white">${formatOrderMoney(payment.amount)}</span>
              </li>
            `).join('')
          : '<li class="text-xs text-slate-500">Todavía no hay abonos registrados.</li>';
        const balanceDisplay = total > 0
          ? `<span class="font-semibold ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}">${formatOrderMoney(balance)}</span><span class="mt-1 block text-[10px] text-slate-500">Abonado ${formatOrderMoney(paid)} de ${formatOrderMoney(total)}</span>`
          : '<span class="text-xs text-slate-500">Sin total acordado</span>';
        const paymentAction = total > 0 && balance > 0
          ? `<button type="button" data-order-action="payment" data-order-id="${orderId}" class="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500"><i class="fa-solid fa-hand-holding-dollar mr-1"></i>Registrar abono</button>`
          : '';
        return `
          <tr data-order-id="${orderId}" data-details-id="order-details-${index}" tabindex="0" aria-expanded="false" aria-label="Ver detalles de la orden ${orderId}" class="order-row hover:bg-slate-800/40 transition border-b border-slate-800/60">
            <td class="py-3 px-4 font-mono text-xs font-bold text-slate-200">
              <div>${orderId}</div>
              <div class="text-[10px] font-sans font-normal text-slate-500">${escapeHtml(o.date || '')}</div>
            </td>
            <td class="py-3 px-4">
              <div class="font-semibold text-white text-xs">${escapeHtml(o.clientName || '')}</div>
              <div class="text-[11px] text-slate-400 truncate max-w-[180px]">${escapeHtml(o.address || '')}</div>
            </td>
            <td class="py-3 px-4">
              <span class="text-xs bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300 font-medium">${escapeHtml(o.type || '')}</span>
            </td>
            <td class="py-3 px-4">
              <span class="text-[11px] font-semibold ${o.priority === 'Alta' ? 'text-rose-400' : o.priority === 'Media' ? 'text-amber-400' : 'text-slate-400'}">
                ${escapeHtml(o.priority || '')}
              </span>
            </td>
            <td class="py-3 px-4">
              <span class="text-[10px] px-2.5 py-1 rounded-full font-semibold ${getStatusBadgeClass(o.status)}">
                ${escapeHtml(o.status || '')}
              </span>
            </td>
            <td class="py-3 px-4">${balanceDisplay}</td>
            <td class="py-3 px-4 text-right space-x-1">
              <button type="button" data-order-action="edit" title="Editar u Operar Orden" aria-label="Editar orden ${orderId}" class="p-1.5 text-slate-400 hover:text-brand-400 transition">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button type="button" data-order-action="delete" title="Eliminar Orden" aria-label="Eliminar orden ${orderId}" class="p-1.5 text-slate-400 hover:text-rose-400 transition">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
          <tr id="order-details-${index}" class="order-details-row hidden">
            <td colspan="7" class="px-4 pb-4">
              <div class="grid gap-4 rounded-xl border border-slate-700/70 bg-slate-950/70 p-4 sm:grid-cols-2">
                <div>
                  <h3 class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Descripción del servicio</h3>
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">${description}</p>
                </div>
                <div>
                  <h3 class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Notas de trabajo</h3>
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">${techNotes}</p>
                </div>
                <div class="space-y-2 sm:col-span-2">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Seguimiento de pagos</h3>
                      <p class="mt-1 text-xs text-slate-300">${total > 0 ? `Total ${formatOrderMoney(total)}` : 'Total sin definir'} · Abonado ${formatOrderMoney(paid)} · Saldo ${formatOrderMoney(balance)}</p>
                    </div>
                    ${paymentAction}
                  </div>
                  <ul class="space-y-1 border-t border-slate-800 pt-2">${paymentHistory}</ul>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function toggleOrderDetails(row) {
      const details = document.getElementById(row.dataset.detailsId);
      if (!details) return;
      const expanded = row.getAttribute('aria-expanded') === 'true';
      row.setAttribute('aria-expanded', String(!expanded));
      details.classList.toggle('hidden', expanded);
    }

    function roundOrderMoney(amount) {
      return Math.round(((Number(amount) || 0) + Number.EPSILON) * 100) / 100;
    }

    function formatOrderMoney(amount) {
      return `$${(Number(amount) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function getOrderPaidAmount(order) {
      const paidCents = (Array.isArray(order.payments) ? order.payments : [])
        .reduce((sum, payment) => sum + Math.round((Number(payment.amount) || 0) * 100), 0);
      return paidCents / 100;
    }

    function formatOrderDate(date) {
      if (!date) return 'Fecha sin dato';
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? String(date) : parsed.toLocaleString('es-AR');
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
      const existingOrder = id ? orders.find(o => o.id === id) : null;
      const totalAmount = roundOrderMoney(document.getElementById('form-order-total').value);
      const paidAmount = existingOrder ? getOrderPaidAmount(existingOrder) : 0;
      if (!Number.isFinite(totalAmount) || totalAmount < 0) {
        showToast('Ingresá un total acordado válido', false);
        return;
      }
      if (totalAmount < paidAmount) {
        showToast('El total acordado no puede ser menor a los abonos ya registrados', false);
        return;
      }

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
        date: existingOrder?.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
        totalAmount,
        payments: existingOrder?.payments || []
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
      document.getElementById('form-order-total').value = '0';
      
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
      document.getElementById('form-order-total').value = Number(order.totalAmount) || 0;

      openModal('new-order-modal');
    }

    function openOrderPayment(orderId) {
      const order = orders.find(item => item.id === orderId);
      if (!order) return;
      const total = roundOrderMoney(order.totalAmount);
      const balance = roundOrderMoney(Math.max(0, total - getOrderPaidAmount(order)));
      if (total <= 0 || balance <= 0) {
        showToast(total <= 0 ? 'Editá la orden y definí el total acordado antes de registrar abonos' : 'La orden ya está completamente abonada', false);
        return;
      }

      document.getElementById('payment-order-id').value = order.id;
      document.getElementById('payment-modal-title').innerText = `Registrar abono · ${order.id}`;
      document.getElementById('payment-balance-summary').innerText = `Saldo pendiente: ${formatOrderMoney(balance)}`;
      const amountInput = document.getElementById('payment-amount');
      amountInput.value = balance.toFixed(2);
      amountInput.max = balance.toFixed(2);
      document.getElementById('payment-note').value = '';
      openModal('order-payment-modal');
    }

    function handleOrderPaymentSubmit(event) {
      event.preventDefault();
      const order = orders.find(item => item.id === document.getElementById('payment-order-id').value);
      const amount = roundOrderMoney(document.getElementById('payment-amount').value);
      if (!order || !Number.isFinite(amount) || amount <= 0) {
        showToast('Ingresá un importe de abono válido', false);
        return;
      }

      const total = roundOrderMoney(order.totalAmount);
      const balance = roundOrderMoney(Math.max(0, total - getOrderPaidAmount(order)));
      if (amount > balance) {
        showToast(`El abono no puede superar el saldo de ${formatOrderMoney(balance)}`, false);
        return;
      }

      order.payments = [...(Array.isArray(order.payments) ? order.payments : []), {
        id: `PAY-${Date.now()}`,
        amount,
        date: new Date().toISOString(),
        note: document.getElementById('payment-note').value.trim()
      }];
      saveData('orders', orders);
      closeModal('order-payment-modal');
      document.getElementById('order-payment-form').reset();
      renderOrders();
      if (typeof renderDashboard === 'function') renderDashboard();
      showToast(roundOrderMoney(balance - amount) <= 0 ? 'Abono registrado; la orden quedó saldada' : 'Abono registrado correctamente');
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
