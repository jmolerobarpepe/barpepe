// Lógica de la app: pestañas, selección para la carta, CRUD y generación
// de la hoja imprimible. Sin frameworks — DOM directo.
//
// Sin async/await, encadenado opcional (?.) ni Object.entries: se usan
// Promises con .then/.catch para que siga funcionando en navegadores muy
// antiguos (p. ej. Chrome 49 de Windows XP).

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

const SESSION_PASSWORD_KEY = 'barpepe.admin-password';

const state = {
  selectedIds: new Set(),
  editingId: null,
  cartaCategory: DEFAULT_CATEGORY,
  gestionCategory: DEFAULT_CATEGORY,
  adminPassword: sessionStorage.getItem(SESSION_PASSWORD_KEY),
};

const el = {
  tabButtons: document.querySelectorAll('.tab-btn'),
  panels: {
    carta: document.getElementById('tab-carta'),
    gestion: document.getElementById('tab-gestion'),
  },
  loadStatus: document.getElementById('load-status'),
  cartaCategoryBar: document.getElementById('carta-category-bar'),
  checklist: document.getElementById('dish-checklist'),
  emptyCartaMsg: document.getElementById('empty-carta-msg'),
  selectedCount: document.getElementById('selected-count'),
  btnGenerate: document.getElementById('btn-generate'),
  copiesInput: document.getElementById('copies-input'),
  gate: document.getElementById('gestion-gate'),
  gateForm: document.getElementById('gate-form'),
  gatePassword: document.getElementById('gate-password'),
  gateError: document.getElementById('gate-error'),
  gestionContent: document.getElementById('gestion-content'),
  btnLogout: document.getElementById('btn-logout'),
  form: document.getElementById('dish-form'),
  formId: document.getElementById('dish-id'),
  formName: document.getElementById('dish-name'),
  formCategory: document.getElementById('dish-category'),
  formSubmit: document.getElementById('dish-submit'),
  formCancel: document.getElementById('dish-cancel'),
  gestionCategoryBar: document.getElementById('gestion-category-bar'),
  categoryDescLabel: document.getElementById('category-description-label'),
  categoryDescInput: document.getElementById('category-description'),
  dishList: document.getElementById('dish-list'),
  emptyGestionMsg: document.getElementById('empty-gestion-msg'),
  printArea: document.getElementById('print-area'),
};

function categoryLabel(id) {
  const match = CATEGORIES.find((c) => c.id === id);
  return match ? match.label : id;
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
  Object.keys(el.panels).forEach((key) => {
    el.panels[key].hidden = key !== name;
  });
  if (name === 'gestion') renderGestionAccess();
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

  const dishes = getDishes().filter((d) => d.category === state.cartaCategory);

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
  const dishes = getDishes();
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
  // Se asume una única categoría por selección (el filtro de "Generar
  // carta" ya restringe qué platos se pueden marcar a la vez).
  const category = dishes[0].category;
  const description = getCategoryDescriptions()[category] || '';
  const rows = dishes.map(buildComandaRow).join('');

  return `
    <div class="comanda">
      <div class="comanda-header">
        <p class="comanda-bar-name">Bar Pepe y Consuelo</p>
        <p class="comanda-category">${escapeHtml(categoryLabel(category))}</p>
        ${description ? `<p class="comanda-description">${escapeHtml(description)}</p>` : ''}
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
// Acceso protegido a "Gestionar platos"
// ---------------------------------------------------------------
function renderGestionAccess() {
  const unlocked = Boolean(state.adminPassword);
  el.gate.hidden = unlocked;
  el.gestionContent.hidden = !unlocked;
  if (unlocked) renderManageList();
}

el.gateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const password = el.gatePassword.value;
  el.gateError.hidden = true;

  login(password)
    .catch(() => false)
    .then((ok) => {
      if (!ok) {
        el.gateError.textContent = 'Contraseña incorrecta.';
        el.gateError.hidden = false;
        return;
      }

      state.adminPassword = password;
      sessionStorage.setItem(SESSION_PASSWORD_KEY, password);
      el.gateForm.reset();
      renderGestionAccess();
    });
});

el.btnLogout.addEventListener('click', () => {
  state.adminPassword = null;
  sessionStorage.removeItem(SESSION_PASSWORD_KEY);
  renderGestionAccess();
});

function handleWriteError(err) {
  if (err.message === 'Contraseña incorrecta') {
    state.adminPassword = null;
    sessionStorage.removeItem(SESSION_PASSWORD_KEY);
    renderGestionAccess();
    el.gateError.textContent = 'La sesión ha caducado o la contraseña ha cambiado. Vuelve a introducirla.';
    el.gateError.hidden = false;
  } else {
    alert(err.message || 'No se pudieron guardar los cambios. Comprueba tu conexión e inténtalo de nuevo.');
  }
  renderManageList();
  renderChecklist();
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

function renderCategoryDescription() {
  el.categoryDescLabel.textContent = `Descripción de «${categoryLabel(state.gestionCategory)}» (aparece en la comanda)`;
  el.categoryDescInput.value = getCategoryDescriptions()[state.gestionCategory] || '';
}

el.categoryDescInput.addEventListener('change', () => {
  const description = el.categoryDescInput.value.trim();
  saveCategoryDescription(state.gestionCategory, description, state.adminPassword).catch(handleWriteError);
});

function renderManageList() {
  renderCategoryBar(el.gestionCategoryBar, state.gestionCategory, (categoryId) => {
    state.gestionCategory = categoryId;
    renderManageList();
  });

  renderCategoryDescription();

  const dishes = getDishes().filter((d) => d.category === state.gestionCategory);

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

  const writePromise = state.editingId
    ? updateDish(state.editingId, name, category, state.adminPassword)
    : addDish(name, category, state.adminPassword);

  writePromise
    .then(() => {
      resetForm();
      renderManageList();
      renderChecklist();
    })
    .catch(handleWriteError);
});

function handleDelete(dish) {
  const confirmed = window.confirm(`¿Eliminar «${dish.name}» del listado de platos?`);
  if (!confirmed) return;

  deleteDish(dish.id, state.adminPassword)
    .then(() => {
      if (state.editingId === dish.id) resetForm();
      renderManageList();
      renderChecklist();
    })
    .catch(handleWriteError);
}

// ---------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------
function init() {
  el.tabButtons.forEach((btn) => { btn.disabled = true; });

  fetchData()
    .then(() => {
      el.tabButtons.forEach((btn) => { btn.disabled = false; });
      el.loadStatus.hidden = true;
      el.panels.carta.hidden = false;

      populateCategorySelect(state.gestionCategory);
      renderChecklist();
      if (!el.panels.gestion.hidden) renderGestionAccess();
    })
    .catch((err) => {
      el.loadStatus.innerHTML = `
        <p>${escapeHtml(err.message || 'No se pudo cargar el listado de platos.')}</p>
        <button type="button" id="retry-load" class="btn btn-secondary">Reintentar</button>
      `;
      document.getElementById('retry-load').addEventListener('click', init);
    });
}

init();
