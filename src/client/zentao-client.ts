import type { ZenTaoHttpClient } from "./auth.js";

export type BugScope = "product" | "project" | "execution";

export type BugListParams = {
  scope: BugScope;
  id: number;
  status?: string;
  browseType?: string;
  assignedTo?: string;
  keyword?: string;
  page?: number;
  limit?: number;
};

export type ResolveBugBody = {
  resolution: string;
  resolvedBuild?: string | number;
  assignedTo?: string;
  comment?: string;
  duplicateBug?: number;
};

export type ActivateBugBody = {
  assignedTo?: string;
  openedBuild?: string[];
  comment?: string;
};

export type CloseBugBody = {
  comment?: string;
};

export type BugRecord = Record<string, unknown>;

export type BugListResponse = {
  page?: number;
  total?: number;
  limit?: number;
  bugs?: BugRecord[];
  data?: BugRecord[];
};

export type MyWorkResponse = {
  page?: number;
  total?: number;
  limit?: number;
  bugs?: BugRecord[];
  data?: BugRecord[];
  bug?: {
    total?: number;
    bugs?: BugRecord[];
  };
};

export class ZenTaoClient {
  private readonly http: ZenTaoHttpClient;

  constructor(http: ZenTaoHttpClient) {
    this.http = http;
  }

  async listProducts(limit = 1): Promise<unknown> {
    return this.http.request("/products", {
      query: { limit },
    });
  }

  async listMyBugs(params: {
    type?: string;
    order?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<MyWorkResponse> {
    return this.http.request<MyWorkResponse>("/user", {
      query: {
        fields: "bug",
        type: params.type ?? "assignedTo",
        order: params.order ?? "id_desc",
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    });
  }

  async listBugs(params: BugListParams): Promise<BugListResponse> {
    const query: Record<string, string | number | undefined> = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    };
    if (params.status) query.status = params.status;
    if (params.browseType) query.browseType = params.browseType;
    if (params.assignedTo) query.assignedTo = params.assignedTo;
    if (params.keyword) query.keyword = params.keyword;

    const path = scopePath(params.scope, params.id);
    return this.http.request<BugListResponse>(`${path}/bugs`, { query });
  }

  async getBug(bugId: number): Promise<BugRecord> {
    return this.http.request<BugRecord>(`/bugs/${bugId}`);
  }

  async resolveBug(bugId: number, body: ResolveBugBody): Promise<BugRecord> {
    return this.http.request<BugRecord>(`/bugs/${bugId}/resolve`, {
      method: "POST",
      body,
    });
  }

  async closeBug(bugId: number, body: CloseBugBody = {}): Promise<BugRecord> {
    return this.http.request<BugRecord>(`/bugs/${bugId}/close`, {
      method: "POST",
      body,
    });
  }

  async activateBug(
    bugId: number,
    body: ActivateBugBody = {},
  ): Promise<BugRecord> {
    return this.http.request<BugRecord>(`/bugs/${bugId}/active`, {
      method: "POST",
      body,
    });
  }
}

function scopePath(scope: BugScope, id: number): string {
  switch (scope) {
    case "product":
      return `/products/${id}`;
    case "project":
      return `/projects/${id}`;
    case "execution":
      return `/executions/${id}`;
  }
}

function isMyWorkResponse(
  payload: BugListResponse | MyWorkResponse,
): payload is MyWorkResponse {
  return "bug" in payload;
}

export function extractBugItems(payload: BugListResponse | MyWorkResponse): BugRecord[] {
  if (Array.isArray(payload.bugs)) return payload.bugs;
  if (Array.isArray(payload.data)) return payload.data;
  if (isMyWorkResponse(payload) && payload.bug && Array.isArray(payload.bug.bugs)) {
    return payload.bug.bugs;
  }
  return [];
}

export function extractBugTotal(payload: BugListResponse | MyWorkResponse): number | undefined {
  if (typeof payload.total === "number") return payload.total;
  if (isMyWorkResponse(payload) && payload.bug && typeof payload.bug.total === "number") {
    return payload.bug.total;
  }
  return undefined;
}
