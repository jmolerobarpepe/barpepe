// Cliente de la API /api/dishes: la lista de platos y las descripciones
// de categoría viven en una base de datos compartida (Vercel KV), no en
// localStorage, así que son las mismas en cualquier dispositivo.
//
// Se mantiene una copia en memoria (`cache`) para poder leer de forma
// síncrona desde la interfaz; cada escritura actualiza la copia local de
// forma optimista y la envía entera al servidor. Si el servidor la
// rechaza (contraseña incorrecta, red caída…), se revierte el cambio.
//
// Escrito con Promises (.then/.catch) en vez de async/await, y sin
// spread de objetos ({...obj}) ni encadenado opcional (?.), para que
// siga funcionando en navegadores muy antiguos (p. ej. Chrome 49 de
// Windows XP, el último que Google publicó para ese sistema).

let cache = null;

function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function readErrorBody(res) {
  return res.json().catch(function () { return {}; });
}

function fetchData() {
  return fetch('/api/dishes').then(function (res) {
    if (!res.ok) {
      return readErrorBody(res).then(function (body) {
        throw new Error(body.error || 'No se pudo cargar el listado de platos');
      });
    }
    return res.json().then(function (data) {
      cache = data;
      return cache;
    });
  });
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

function persist(password) {
  return fetch('/api/dishes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: password,
      dishes: cache.dishes,
      categoryDescriptions: cache.categoryDescriptions,
    }),
  }).then(function (res) {
    if (!res.ok) {
      return readErrorBody(res).then(function (body) {
        throw new Error(body.error || 'No se pudieron guardar los cambios');
      });
    }
    return res.json().then(function (data) {
      cache = data;
      return cache;
    });
  });
}

function addDish(name, category, password) {
  ensureLoaded();
  const previous = cache.dishes;
  const dish = { id: uid(), category: category, name: name };
  cache.dishes = previous.concat([dish]);
  return persist(password)
    .then(function () {
      return dish;
    })
    .catch(function (err) {
      cache.dishes = previous;
      throw err;
    });
}

function updateDish(id, name, category, password) {
  ensureLoaded();
  const previous = cache.dishes;
  cache.dishes = previous.map(function (d) {
    if (d.id !== id) return d;
    return Object.assign({}, d, { name: name, category: category });
  });
  return persist(password).catch(function (err) {
    cache.dishes = previous;
    throw err;
  });
}

function deleteDish(id, password) {
  ensureLoaded();
  const previous = cache.dishes;
  cache.dishes = previous.filter(function (d) {
    return d.id !== id;
  });
  return persist(password).catch(function (err) {
    cache.dishes = previous;
    throw err;
  });
}

function saveCategoryDescription(categoryId, description, password) {
  ensureLoaded();
  const previous = cache.categoryDescriptions;
  const next = Object.assign({}, previous);
  next[categoryId] = description;
  cache.categoryDescriptions = next;
  return persist(password).catch(function (err) {
    cache.categoryDescriptions = previous;
    throw err;
  });
}

function login(password) {
  return fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: password }),
  }).then(function (res) {
    return res.ok;
  });
}
