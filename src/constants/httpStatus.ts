export enum HttpStatus {
  /* =========================
   * 2xx — Success
   * ========================= */
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,              // async processing
  NO_CONTENT = 204,
  PARTIAL_CONTENT = 206,       // range requests, streaming

  /* =========================
   * 3xx — Redirection
   * ========================= */
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  NOT_MODIFIED = 304,          // caching / ETag
  TEMPORARY_REDIRECT = 307,
  PERMANENT_REDIRECT = 308,

  /* =========================
   * 4xx — Client Errors
   * ========================= */
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  PAYMENT_REQUIRED = 402,      // rarely used, but standardized
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  NOT_ACCEPTABLE = 406,
  REQUEST_TIMEOUT = 408,
  CONFLICT = 409,
  GONE = 410,                  // resource permanently removed
  PRECONDITION_FAILED = 412,   // If-Match / If-Unmodified-Since
  PAYLOAD_TOO_LARGE = 413,
  UNSUPPORTED_MEDIA_TYPE = 415,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,     // rate limiting

  /* =========================
   * 5xx — Server Errors
   * ========================= */
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}
