// Lógica de la app: pestañas, selección para la carta, CRUD y generación
// de la hoja imprimible. Sin frameworks — DOM directo.

const CATEGORIES = [
  { id: 'tapas', label: 'Tapas' },
  { id: 'platos', label: 'Platos' },
  { id: 'raciones', label: 'Raciones' },
  { id: 'bocadillos', label: 'Bocadillos' },
];
const DEFAULT_CATEGORY = CATEGORIES[0].id;

const DEFAULT_COPIES = 10;
const MIN_COPIES = 1;
const MAX_COPIES = 60;

const state = {
  selectedIds: new Set(),
  editingId: null,
  cartaCategory: DEFAULT_CATEGORY,
  gestionCategory: DEFAULT_CATEGORY,
};

const el = {
  tabButtons: document.querySelectorAll('.tab-btn'),
  panels: {
    carta: document.getElementById('tab-carta'),
    gestion: document.getElementById('tab-gestion'),
  },
  cartaCategoryBar: document.getElementById('carta-category-bar'),
  checklist: document.getElementById('dish-checklist'),
  emptyCartaMsg: document.getElementById('empty-carta-msg'),
  selectedCount: document.getElementById('selected-count'),
  btnGenerate: document.getElementById('btn-generate'),
  copiesInput: document.getElementById('copies-input'),
  form: document.getElementById('dish-form'),
  formId: document.getElementById('dish-id'),
  formName: document.getElementById('dish-name'),
  formCategory: document.getElementById('dish-category'),
  formSubmit: document.getElementById('dish-submit'),
  formCancel: document.getElementById('dish-cancel'),
  gestionCategoryBar: document.getElementById('gestion-category-bar'),
  dishList: document.getElementById('dish-list'),
  emptyGestionMsg: document.getElementById('empty-gestion-msg'),
  printArea: document.getElementById('print-area'),
};

function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

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
// Barras de categoría (compartidas entre las dos pestañas)
// ---------------------------------------------------------------
function renderCategoryBar(container, activeId, onSelect) {
  container.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-btn';
    btn.classList.toggle('is-active', cat.id === activeId);
    btn.dataset.category = cat.id;
    btn.textContent = cat.label;
    btn.addEventListener('click', () => onSelect(cat.id));
    container.appendChild(btn);
  });
}

// ---------------------------------------------------------------
// Pestaña: Generar carta
// ---------------------------------------------------------------
function renderChecklist() {
  renderCategoryBar(el.cartaCategoryBar, state.cartaCategory, (categoryId) => {
    state.cartaCategory = categoryId;
    renderChecklist();
  });

  const dishes = loadDishes().filter((d) => d.category === state.cartaCategory);

  el.checklist.innerHTML = '';
  el.emptyCartaMsg.hidden = dishes.length > 0;
  el.emptyCartaMsg.textContent = `Todavía no hay platos en «${categoryLabel(state.cartaCategory)}». Añade alguno desde «Gestionar platos».`;

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
    count === 1 ? '1 plato seleccionado' : `${count} platos seleccionados`;
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
  const groups = CATEGORIES.map((cat) => ({
    label: cat.label,
    dishes: dishes.filter((d) => d.category === cat.id),
  })).filter((group) => group.dishes.length > 0);

  const sections = groups
    .map(
      (group) => `
        <div class="comanda-section">
          <p class="comanda-section-title">${escapeHtml(group.label)}</p>
          <div class="comanda-rows">${group.dishes.map(buildComandaRow).join('')}</div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="comanda">
      <div class="comanda-header">
        <p class="comanda-bar-name">Bar Pepe y Consuelo</p>
        <p class="comanda-title">Comanda</p>
      </div>
      ${sections}
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
function populateCategorySelect(selectedId) {
  el.formCategory.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.label;
    el.formCategory.appendChild(option);
  });
  el.formCategory.value = selectedId;
}

function renderManageList() {
  renderCategoryBar(el.gestionCategoryBar, state.gestionCategory, (categoryId) => {
    state.gestionCategory = categoryId;
    renderManageList();
  });

  const dishes = loadDishes().filter((d) => d.category === state.gestionCategory);

  el.dishList.innerHTML = '';
  el.emptyGestionMsg.hidden = dishes.length > 0;
  el.emptyGestionMsg.textContent = `Todavía no has añadido ningún plato en «${categoryLabel(state.gestionCategory)}».`;

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
  populateCategorySelect(dish.category);
  el.formSubmit.textContent = 'Guardar cambios';
  el.formCancel.hidden = false;
  el.formName.focus();
}

function resetForm() {
  state.editingId = null;
  el.form.reset();
  el.formId.value = '';
  populateCategorySelect(state.gestionCategory);
  el.formSubmit.textContent = 'Añadir plato';
  el.formCancel.hidden = true;
}

el.formCancel.addEventListener('click', resetForm);

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = el.formName.value.trim();
  const category = el.formCategory.value;
  if (!name) return;

  if (state.editingId) {
    updateDish(state.editingId, name, category);
  } else {
    addDish(name, category);
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
populateCategorySelect(state.gestionCategory);
renderChecklist();
renderManageList();
