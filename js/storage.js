// Persistencia local del listado de platos (sin backend).
// Estructura de cada plato: { id, category, name }
// `category` prepara el modelo para futuras categorías además de "tapas".

const STORAGE_KEY = 'barpepe.platos.v1';

const DEFAULT_DISHES = [
  'Patatas bravas',
  'Croquetas de jamón',
  'Tortilla española',
  'Boquerones en vinagre',
  'Pimientos de padrón',
  'Gambas al ajillo',
].map((name, i) => ({ id: `seed-${i}`, category: 'tapas', name }));

function uid() {
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadDishes() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.error('No se pudo acceder a localStorage', err);
    return [];
  }

  if (raw === null) {
    saveDishes(DEFAULT_DISHES);
    return DEFAULT_DISHES.slice();
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('El listado de platos guardado está corrupto', err);
    return [];
  }
}

function saveDishes(dishes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dishes));
}

function addDish(name, category) {
  const dishes = loadDishes();
  const dish = { id: uid(), category, name };
  dishes.push(dish);
  saveDishes(dishes);
  return dish;
}

function updateDish(id, name) {
  const dishes = loadDishes();
  const dish = dishes.find((d) => d.id === id);
  if (dish) {
    dish.name = name;
    saveDishes(dishes);
  }
  return dish;
}

function deleteDish(id) {
  const dishes = loadDishes().filter((d) => d.id !== id);
  saveDishes(dishes);
}
