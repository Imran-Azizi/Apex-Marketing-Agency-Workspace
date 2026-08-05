export function ok(res, data = null, meta = undefined, status = 200) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

export function created(res, data) {
  return ok(res, data, undefined, 201);
}

export class AppError extends Error {
  constructor(message, status = 400, code = 'APP_ERROR', details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
