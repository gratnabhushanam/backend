const jwt = require('jsonwebtoken');
const { User } = require('../models');
const authController = require('../controllers/authController');

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

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const jwtSecret = resolveJwtSecret();
      if (!jwtSecret) {
        return res.status(500).json({ message: 'Server auth configuration error' });
      }

      const decoded = jwt.verify(token, jwtSecret);

      if (typeof authController.isMockMode === 'function' && authController.isMockMode()) {
        const mockUser = authController.getMockUserById(decoded.id);
        req.user = mockUser ? { ...mockUser, password: undefined } : null;
      } else {
        req.user = await User.findByPk(decoded.id, {
          attributes: { exclude: ['password'] }
        });
      }

      if (!req.user) {
         return res.status(401).json({ message: 'User not found' });
      }
      next();
    } catch (error) {
      console.error('Auth middleware error:', error.message);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin };
