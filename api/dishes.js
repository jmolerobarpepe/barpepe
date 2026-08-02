const { readData, writeData, checkPassword } = require('./_store');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const data = await readData();
      res.status(200).json(data);
      return;
    }

    if (req.method === 'POST') {
      const { password, dishes, categoryDescriptions } = req.body || {};

      if (!checkPassword(password)) {
        res.status(401).json({ error: 'Contraseña incorrecta' });
        return;
      }

      if (!Array.isArray(dishes) || typeof categoryDescriptions !== 'object' || categoryDescriptions === null) {
        res.status(400).json({ error: 'Datos inválidos' });
        return;
      }

      const data = await writeData({ dishes, categoryDescriptions });
      res.status(200).json(data);
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error interno' });
  }
};
