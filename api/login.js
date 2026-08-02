const { checkPassword } = require('./_store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { password } = req.body || {};

  if (checkPassword(password)) {
    res.status(200).json({ ok: true });
    return;
  }

  res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
};
