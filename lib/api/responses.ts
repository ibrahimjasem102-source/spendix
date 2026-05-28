import { NextResponse } from "next/server";

type JsonBody = object | unknown[] | null;

export function getRequestId(request?: Request) {
  return request?.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function apiJson(
  body: JsonBody,
  init: ResponseInit & { requestId?: string } = {}
) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-request-id", init.requestId ?? crypto.randomUUID());

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export function unauthorized(requestId?: string) {
  return apiJson({ errorKey: "errors.unauthorized" }, { status: 401, requestId });
}

export function badRequest(errorKey = "common.unknown_error", requestId?: string) {
  return apiJson({ errorKey }, { status: 400, requestId });
}

export function serverError(message = "Internal server error", requestId?: string) {
  return apiJson({ error: message }, { status: 500, requestId });
}
