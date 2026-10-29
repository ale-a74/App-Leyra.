    // ================= CUSTOMER EQUIPMENT LOGIC =================
    function renderObjects() {
      const search = document.getElementById('object-search').value.trim().toLowerCase();
      const filtered = objects.filter(item => {
        const client = clients.find(c => c.id === item.clientId);
        return [item.type, item.model, item.serial, item.location, item.notes, client ? client.name : '']
          .some(value => String(value || '').toLowerCase().includes(search));
      });
      const grid = document.getElementById('objects-grid');
      if (!filtered.length) {
        grid.innerHTML = `<p class="col-span-full text-center py-8 text-slate-500 text-xs">${search ? 'No se encontraron equipos.' : 'Todavía no hay equipos registrados. Agregá el primero para llevar su historial.'}</p>`;
        return;
      }
      grid.innerHTML = filtered.map(item => {
        const client = clients.find(c => c.id === item.clientId);
        return `
          <article class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div class="flex justify-between gap-3">
              <div>
                <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-md">${escapeHtml(item.type)}</span>
                <h4 class="font-bold text-white mt-2">${escapeHtml(item.model || 'Equipo sin marca/modelo')}</h4>
              </div>
              <button onclick="deleteObject('${escapeHtml(item.id)}')" title="Eliminar equipo" class="text-slate-500 hover:text-rose-400"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div class="text-xs text-slate-400 space-y-1">
              <p><i class="fa-solid fa-user mr-2"></i>${escapeHtml(client ? client.name : 'Cliente eliminado')}</p>
              ${item.serial ? `<p><i class="fa-solid fa-barcode mr-2"></i>Serie: ${escapeHtml(item.serial)}</p>` : ''}
              ${item.location ? `<p><i class="fa-solid fa-location-dot mr-2"></i>${escapeHtml(item.location)}</p>` : ''}
              ${item.notes ? `<p class="pt-2 border-t border-slate-800 whitespace-pre-wrap">${escapeHtml(item.notes)}</p>` : ''}
            </div>
          </article>
        `;
      }).join('');
    }

    function handleObjectSubmit(e) {
      e.preventDefault();
      const clientId = document.getElementById('form-object-client').value;
      if (!clients.some(client => client.id === clientId)) {
        showToast('Seleccioná un cliente registrado para asociar el equipo', false);
        return;
      }
      objects.unshift({
        id: `obj-${Date.now()}`,
        clientId,
        type: document.getElementById('form-object-type').value,
        model: document.getElementById('form-object-model').value.trim(),
        serial: document.getElementById('form-object-serial').value.trim(),
        location: document.getElementById('form-object-location').value.trim(),
        notes: document.getElementById('form-object-notes').value.trim()
      });
      saveData('objects', objects);
      renderObjects();
      closeModal('new-object-modal');
      document.getElementById('object-form').reset();
      showToast('Equipo registrado correctamente');
    }

    function deleteObject(id) {
      if (!confirm('¿Eliminar este equipo registrado?')) return;
      objects = objects.filter(item => item.id !== id);
      saveData('objects', objects);
      renderObjects();
      showToast('Equipo eliminado');
    }

