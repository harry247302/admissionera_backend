const env = require('../config/env');
const { verifyToken } = require('../utils/jwt');

const authenticate = (req, res, next) => {
  const token = req.cookies[env.cookie.name];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (_err) {
    res.clearCookie(env.cookie.name, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    });
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = authenticate;
