const jwt = require('jsonwebtoken');

const resolveJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (secret) {
    return secret;
  }

  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    return null;
  }

  return 'gita_wisdom_super_secret_key';
};

const generateToken = (id) => {
  const secret = resolveJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET must be set in production');
  }

  return jwt.sign({ id }, secret, {
    expiresIn: '30d',
  });
};

module.exports = generateToken;
