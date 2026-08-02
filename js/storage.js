// Cliente de la API /api/dishes: la lista de platos y las descripciones
// de categoría viven en una base de datos compartida (Vercel KV), no en
// localStorage, así que son las mismas en cualquier dispositivo.
//
// Se mantiene una copia en memoria (`cache`) para poder leer de forma
// síncrona desde la interfaz; cada escritura actualiza la copia local de
// forma optimista y la envía entera al servidor. Si el servidor la
// rechaza (contraseña incorrecta, red caída…), se revierte el cambio.

let cache = null;

function uid() {
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchData() {
  const res = await fetch('/api/dishes');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'No se pudo cargar el listado de platos');
  }
  cache = await res.json();
  return cache;
}

function ensureLoaded() {
  if (!cache) throw new Error('Los datos todavía no se han cargado');
}

function getDishes() {
  ensureLoaded();
  return cache.dishes;
}

function getCategoryDescriptions() {
  ensureLoaded();
  return cache.categoryDescriptions;
}

async function persist(password) {
  const res = await fetch('/api/dishes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password,
      dishes: cache.dishes,
      categoryDescriptions: cache.categoryDescriptions,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'No se pudieron guardar los cambios');
  }

  cache = await res.json();
  return cache;
}

async function addDish(name, category, password) {
  ensureLoaded();
  const previous = cache.dishes;
  const dish = { id: uid(), category, name };
  cache.dishes = [...previous, dish];
  try {
    await persist(password);
    return dish;
  } catch (err) {
    cache.dishes = previous;
    throw err;
  }
}

async function updateDish(id, name, category, password) {
  ensureLoaded();
  const previous = cache.dishes;
  cache.dishes = previous.map((d) => (d.id === id ? { ...d, name, category } : d));
  try {
    await persist(password);
  } catch (err) {
    cache.dishes = previous;
    throw err;
  }
}

async function deleteDish(id, password) {
  ensureLoaded();
  const previous = cache.dishes;
  cache.dishes = previous.filter((d) => d.id !== id);
  try {
    await persist(password);
  } catch (err) {
    cache.dishes = previous;
    throw err;
  }
}

async function saveCategoryDescription(categoryId, description, password) {
  ensureLoaded();
  const previous = cache.categoryDescriptions;
  cache.categoryDescriptions = { ...previous, [categoryId]: description };
  try {
    await persist(password);
  } catch (err) {
    cache.categoryDescriptions = previous;
    throw err;
  }
}

async function login(password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}
