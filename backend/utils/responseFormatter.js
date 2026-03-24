/**
 * Standardized API response formatter
 * Ensures consistent response structure across all endpoints
 */

export const sendSuccess = (res, data, message = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res, error, statusCode = 400, details = null) => {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'An error occurred';

  return res.status(statusCode).json({
    success: false,
    error: errorMessage,
    ...(details && { details }),
  });
};

export const sendCreated = (res, data, message = 'Created successfully') => {
  return sendSuccess(res, data, message, 201);
};

export const sendNotFound = (res, resource = 'Resource') => {
  return sendError(res, `${resource} not found`, 404);
};

export const sendUnauthorized = (res, message = 'Unauthorized') => {
  return sendError(res, message, 401);
};

export const sendForbidden = (res, message = 'Forbidden') => {
  return sendError(res, message, 403);
};

export const sendBadRequest = (res, message = 'Bad request') => {
  return sendError(res, message, 400);
};

export const sendConflict = (res, message = 'Conflict') => {
  return sendError(res, message, 409);
};

export const sendServerError = (res, error) => {
  console.error('Server error:', error);
  return sendError(res, error?.message || 'Internal server error', 500);
};
