    // ================= 5. INVENTORY LOGIC =================
    function populateInventoryCategories(selectedCategory) {
      const select = document.getElementById('form-item-category');
      if (!select) return;
      select.innerHTML = inventoryCategories.map(category => `
        <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
      `).join('');
      if (selectedCategory && inventoryCategories.includes(selectedCategory)) {
        select.value = selectedCategory;
      }
    }

    function addInventoryCategory() {
      const input = document.getElementById('new-inventory-category');
      const category = input.value.trim();
      if (!category) {
        showToast('Escribí un nombre para la categoría', false);
        input.focus();
        return;
      }
      const existing = inventoryCategories.find(item => item.toLocaleLowerCase() === category.toLocaleLowerCase());
      if (existing) {
        populateInventoryCategories(existing);
        showToast('Esa categoría ya existe', false);
        return;
      }
      inventoryCategories.push(category);
      saveData('inventoryCategories', inventoryCategories);
      populateInventoryCategories(category);
      input.value = '';
      showToast('Categoría agregada');
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.id === 'new-inventory-category') {
        event.preventDefault();
        addInventoryCategory();
      }
    });

    function renderInventory() {
      const search = document.getElementById('inventory-search').value.toLowerCase();
      const filtered = inventory.filter(i => 
        i.name.toLowerCase().includes(search) || 
        i.category.toLowerCase().includes(search)
      );

      const tbody = document.getElementById('inventory-table-body');
      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="py-8 text-center text-slate-500 text-xs">
              No hay materiales registrados en el inventario.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(item => {
        const isLow = item.stock <= item.minStock;
        return `
          <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/60">
            <td class="py-3.5 px-4">
              <div class="font-semibold text-white text-xs">${escapeHtml(item.name)}</div>
            </td>
            <td class="py-3.5 px-4 text-xs text-slate-400">
              ${escapeHtml(item.category)}
            </td>
            <td class="py-3.5 px-4 font-bold text-sm text-slate-200">
              ${item.stock}
            </td>
            <td class="py-3.5 px-4 text-xs font-mono text-slate-300">
              $${item.price.toLocaleString('es-AR')}
            </td>
            <td class="py-3.5 px-4">
              <span class="text-[10px] px-2.5 py-1 rounded-full font-semibold ${isLow ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
                ${isLow ? 'Stock Bajo' : 'Normal'}
              </span>
            </td>
            <td class="py-3.5 px-4 text-right space-x-1">
              <button onclick="updateStock('${item.id}', -1)" class="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition">
                -
              </button>
              <button onclick="updateStock('${item.id}', 1)" class="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition">
                +
              </button>
              <button onclick="deleteItem('${item.id}')" class="p-1.5 text-slate-500 hover:text-rose-400 transition ml-2">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function handleItemSubmit(e) {
      e.preventDefault();
      const newItem = {
        id: 'inv-' + Date.now(),
        name: document.getElementById('form-item-name').value,
        category: document.getElementById('form-item-category').value,
        price: parseFloat(document.getElementById('form-item-price').value) || 0,
        stock: parseInt(document.getElementById('form-item-stock').value) || 0,
        minStock: parseInt(document.getElementById('form-item-min').value) || 2
      };

      inventory.push(newItem);
      saveData('inventory', inventory);
      renderInventory();
      closeModal('new-item-modal');
      document.getElementById('item-form').reset();
      showToast('Material agregado al inventario');
    }

    function updateStock(id, delta) {
      const item = inventory.find(i => i.id === id);
      if (item) {
        item.stock = Math.max(0, item.stock + delta);
        saveData('inventory', inventory);
        renderInventory();
      }
    }

    function deleteItem(id) {
      if (confirm('¿Eliminar este insumo del inventario?')) {
        inventory = inventory.filter(i => i.id !== id);
        saveData('inventory', inventory);
        renderInventory();
        showToast('Insumo eliminado');
      }
    }
