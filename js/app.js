// Lógica de la app: pestañas, selección para la carta, CRUD y generación
// de la hoja imprimible. Sin frameworks — DOM directo.

const ACTIVE_CATEGORY = 'tapas'; // única categoría disponible por ahora
const DEFAULT_COPIES = 10;
const MIN_COPIES = 1;
const MAX_COPIES = 60;

const state = {
  selectedIds: new Set(),
  editingId: null,
};

const el = {
  tabButtons: document.querySelectorAll('.tab-btn'),
  panels: {
    carta: document.getElementById('tab-carta'),
    gestion: document.getElementById('tab-gestion'),
  },
  checklist: document.getElementById('dish-checklist'),
  emptyCartaMsg: document.getElementById('empty-carta-msg'),
  selectedCount: document.getElementById('selected-count'),
  btnGenerate: document.getElementById('btn-generate'),
  copiesInput: document.getElementById('copies-input'),
  form: document.getElementById('dish-form'),
  formId: document.getElementById('dish-id'),
  formName: document.getElementById('dish-name'),
  formSubmit: document.getElementById('dish-submit'),
  formCancel: document.getElementById('dish-cancel'),
  dishList: document.getElementById('dish-list'),
  emptyGestionMsg: document.getElementById('empty-gestion-msg'),
  printArea: document.getElementById('print-area'),
};

// ---------------------------------------------------------------
// Pestañas
// ---------------------------------------------------------------
el.tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  el.tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  Object.entries(el.panels).forEach(([key, panel]) => {
    panel.hidden = key !== name;
  });
}

// ---------------------------------------------------------------
// Pestaña: Generar carta
// ---------------------------------------------------------------
function renderChecklist() {
  const dishes = loadDishes().filter((d) => d.category === ACTIVE_CATEGORY);

  // Descarta selecciones de platos que ya no existen.
  state.selectedIds.forEach((id) => {
    if (!dishes.some((d) => d.id === id)) state.selectedIds.delete(id);
  });

  el.checklist.innerHTML = '';
  el.emptyCartaMsg.hidden = dishes.length > 0;

  dishes.forEach((dish) => {
    const label = document.createElement('label');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = dish.id;
    checkbox.checked = state.selectedIds.has(dish.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedIds.add(dish.id);
      else state.selectedIds.delete(dish.id);
      updateCartaActions();
    });

    const name = document.createElement('span');
    name.className = 'dish-name';
    name.textContent = dish.name;

    label.append(checkbox, name);
    el.checklist.appendChild(label);
  });

  updateCartaActions();
}

function updateCartaActions() {
  const count = state.selectedIds.size;
  el.selectedCount.textContent =
    count === 1 ? '1 tapa seleccionada' : `${count} tapas seleccionadas`;
  el.btnGenerate.disabled = count === 0;
}

el.btnGenerate.addEventListener('click', generatePrintSheet);

function generatePrintSheet() {
  const dishes = loadDishes();
  const selected = dishes.filter((d) => state.selectedIds.has(d.id));
  if (selected.length === 0) return;

  const copies = clamp(
    parseInt(el.copiesInput.value, 10) || DEFAULT_COPIES,
    MIN_COPIES,
    MAX_COPIES,
  );

  const comandas = Array.from({ length: copies }, () => buildComanda(selected)).join('');
  el.printArea.innerHTML = `<div class="comanda-grid">${comandas}</div>`;

  // Da tiempo al navegador a maquetar el área de impresión antes de imprimir.
  requestAnimationFrame(() => window.print());
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildComanda(dishes) {
  const rows = dishes.map(buildComandaRow).join('');
  return `
    <div class="comanda">
      <div class="comanda-header">
        <p class="comanda-bar-name">Bar Pepe y Consuelo</p>
        <p class="comanda-title">Comanda de tapas</p>
      </div>
      <div class="comanda-rows">${rows}</div>
    </div>
  `;
}

function buildComandaRow(dish) {
  return `
    <div class="comanda-row">
      <span class="comanda-qty-box"></span>
      <span class="comanda-dish-name">${escapeHtml(dish.name)}</span>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------
// Pestaña: Gestionar platos (CRUD)
// ---------------------------------------------------------------
function renderManageList() {
  const dishes = loadDishes().filter((d) => d.category === ACTIVE_CATEGORY);

  el.dishList.innerHTML = '';
  el.emptyGestionMsg.hidden = dishes.length > 0;

  dishes.forEach((dish) => {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'dish-row-name';
    name.textContent = dish.name;

    const actions = document.createElement('span');
    actions.className = 'dish-row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-text btn-edit';
    editBtn.textContent = 'Editar';
    editBtn.addEventListener('click', () => startEdit(dish));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-text btn-delete';
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.addEventListener('click', () => handleDelete(dish));

    actions.append(editBtn, deleteBtn);
    li.append(name, actions);
    el.dishList.appendChild(li);
  });
}

function startEdit(dish) {
  state.editingId = dish.id;
  el.formId.value = dish.id;
  el.formName.value = dish.name;
  el.formSubmit.textContent = 'Guardar cambios';
  el.formCancel.hidden = false;
  el.formName.focus();
}

function resetForm() {
  state.editingId = null;
  el.form.reset();
  el.formId.value = '';
  el.formSubmit.textContent = 'Añadir plato';
  el.formCancel.hidden = true;
}

el.formCancel.addEventListener('click', resetForm);

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = el.formName.value.trim();
  if (!name) return;

  if (state.editingId) {
    updateDish(state.editingId, name);
  } else {
    addDish(name, ACTIVE_CATEGORY);
  }

  resetForm();
  renderManageList();
  renderChecklist();
});

function handleDelete(dish) {
  const confirmed = window.confirm(`¿Eliminar «${dish.name}» del listado de platos?`);
  if (!confirmed) return;

  deleteDish(dish.id);
  if (state.editingId === dish.id) resetForm();
  renderManageList();
  renderChecklist();
}

// ---------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------
renderChecklist();
renderManageList();
