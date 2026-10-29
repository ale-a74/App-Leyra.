    // ================= 1. DASHBOARD LOGIC =================
    function renderDashboard() {
      const activeCount = orders.filter(o => o.status === 'Pendiente' || o.status === 'En Proceso').length;
      const completedCount = orders.filter(o => o.status === 'Completado').length;

      document.getElementById('metric-active-jobs').innerText = activeCount;
      document.getElementById('metric-total-clients').innerText = clients.length;
      document.getElementById('metric-completed-jobs').innerText = completedCount;
      document.getElementById('metric-pending-quotes').innerText = '4';

      // Systems breakdown percentages
      const totalOrders = orders.length || 1;
      const cctvCount = orders.filter(o => o.type.includes('CCTV')).length;
      const alarmCount = orders.filter(o => o.type.includes('Alarma')).length;
      const accessCount = orders.filter(o => o.type.includes('Acceso')).length;

      const cctvPct = Math.round((cctvCount / totalOrders) * 100);
      const alarmPct = Math.round((alarmCount / totalOrders) * 100);
      const accessPct = Math.round((accessCount / totalOrders) * 100);

      document.getElementById('stat-cctv-percent').innerText = `${cctvPct}%`;
      document.getElementById('stat-cctv-bar').style.width = `${cctvPct}%`;

      document.getElementById('stat-alarm-percent').innerText = `${alarmPct}%`;
      document.getElementById('stat-alarm-bar').style.width = `${alarmPct}%`;

      document.getElementById('stat-access-percent').innerText = `${accessPct}%`;
      document.getElementById('stat-access-bar').style.width = `${accessPct}%`;

      // Render Dashboard Orders List
      const container = document.getElementById('dashboard-orders-list');
      const recent = [...orders].reverse().slice(0, 4);

      if (recent.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 py-4 text-center">No hay órdenes registradas.</p>`;
        return;
      }

      container.innerHTML = recent.map(o => `
        <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition">
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-xs text-brand-400">${o.id}</span>
              <span class="text-xs text-white font-medium">${escapeHtml(o.clientName)}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${getStatusBadgeClass(o.status)}">${o.status}</span>
            </div>
            <p class="text-xs text-slate-400 flex items-center space-x-1">
              <i class="fa-solid fa-location-dot text-slate-500"></i>
              <span>${escapeHtml(o.address)}</span>
            </p>
          </div>
          <button onclick="switchTab('orders')" class="text-xs text-slate-400 hover:text-white p-2">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      `).join('');
    }
