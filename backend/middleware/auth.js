import jwt from 'jsonwebtoken';

// Middleware to verify JWT token
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      status: 'error',
      message: 'Access Denied: No Token Provided'
    });
  }
  
  // Accept both 'Bearer <token>' and raw '<token>'
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'campushub_secret');
    req.user = decoded; // Attach user payload (id, role, etc) to request
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Access Denied: Invalid or Expired Token'
    });
  }
};

// Middleware to restrict access by role
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized: User not authenticated'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Forbidden: Access restricted to roles: [${roles.join(', ')}]`
      });
    }
    
    next();
  };
};
