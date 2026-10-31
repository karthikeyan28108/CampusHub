import { validationResult } from 'express-validator';

/**
 * Middleware that inspects validation results from express-validator.
 * If errors exist, it intercepts the request and responds with a 400 status
 * and the first validation error message.
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: errors.array()[0].msg
    });
  }
  next();
};
