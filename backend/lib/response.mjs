const DEFAULT_CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

export function corsHeaders(origin = DEFAULT_CORS_ORIGIN) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function emptyResponse(statusCode, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...corsHeaders(), ...extraHeaders },
    body: "",
  };
}
