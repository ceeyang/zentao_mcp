export type ToolMeta = {
  source: "zentao-rest-v1";
  fetchedAt: string;
};

export type ToolError = {
  code: string;
  message: string;
  detail?: unknown;
};

export type ToolEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: ToolError;
  meta: ToolMeta;
};

export function makeMeta(): ToolMeta {
  return {
    source: "zentao-rest-v1",
    fetchedAt: new Date().toISOString(),
  };
}

export function ok<T>(data: T): ToolEnvelope<T> {
  return { ok: true, data, meta: makeMeta() };
}

export function fail(
  code: string,
  message: string,
  detail?: unknown,
): ToolEnvelope<never> {
  return {
    ok: false,
    error: { code, message, detail },
    meta: makeMeta(),
  };
}

export function toToolText(envelope: ToolEnvelope<unknown>): string {
  return JSON.stringify(envelope, null, 2);
}
