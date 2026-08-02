const { Redis } = require('@upstash/redis');

const DATA_KEY = 'barpepe:data';

const DEFAULT_DATA = {
  dishes: [
    'Patatas bravas',
    'Croquetas de jamón',
    'Tortilla española',
    'Boquerones en vinagre',
    'Pimientos de padrón',
    'Gambas al ajillo',
  ].map((name, i) => ({ id: `seed-${i}`, category: 'tapas', name })),
  categoryDescriptions: {},
};

let redis;

// La integración "Upstash for Redis" del Marketplace de Vercel expone las
// credenciales como KV_REST_API_URL/KV_REST_API_TOKEN (nombres heredados
// de la antigua Vercel KV); si se conecta Upstash directamente, usa
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN. Se admiten ambos.
function getRedis() {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Falta conectar una base de datos Redis al proyecto (Vercel → Storage → Create Database → Upstash for Redis).',
    );
  }

  redis = new Redis({ url, token });
  return redis;
}

async function readData() {
  const data = await getRedis().get(DATA_KEY);
  return data || DEFAULT_DATA;
}

async function writeData(data) {
  await getRedis().set(DATA_KEY, data);
  return data;
}

function checkPassword(password) {
  return typeof password === 'string' && password.length > 0 && password === process.env.ADMIN_PASSWORD;
}

module.exports = { readData, writeData, checkPassword };
