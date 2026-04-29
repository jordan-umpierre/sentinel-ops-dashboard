const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type UserRole = "admin" | "operator" | "viewer";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type AssetStatus = "nominal" | "watch" | "alert" | "offline";
export type AssetType = "personnel" | "vehicle" | "sensor" | "gateway";
export type EventType =
  | "access_denied"
  | "geofence_breach"
  | "equipment_offline"
  | "temperature_threshold"
  | "sensor_heartbeat"
  | "route_deviation";
export type IncidentStatus = "open" | "acknowledged" | "resolved";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  user: User;
};

export type Asset = {
  id: string;
  name: string;
  call_sign: string;
  asset_type: AssetType;
  status: AssetStatus;
  zone: string;
  latitude: number;
  longitude: number;
  battery_level: number;
  last_seen_at: string;
  metadata: Record<string, unknown>;
};

export type EventRecord = {
  id: string;
  asset_id: string | null;
  asset_name: string | null;
  event_type: string;
  severity: Severity;
  source: string;
  zone: string;
  message: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
};

export type Incident = {
  id: string;
  title: string;
  summary: string;
  severity: Severity;
  status: IncidentStatus;
  explanation: string;
  created_at: string;
  updated_at: string;
  related_event_ids: string[];
};

export type IncidentListItem = Incident & {
  affected_assets: string[];
  related_event_count: number;
};

export type AssetDetail = Asset & {
  recent_events: EventRecord[];
  related_incidents: IncidentListItem[];
};

export type IncidentDetail = IncidentListItem & {
  related_events: EventRecord[];
  affected_asset_details: Asset[];
};

export type IncidentSummary = {
  summary: string;
  likely_cause: string;
  affected_assets: string[];
  suggested_next_checks: string[];
  provider: string;
};

export type DashboardOverview = {
  site: {
    id: string;
    name: string;
    code: string;
    region: string;
    description: string;
  };
  metrics: {
    active_incidents: number;
    critical_events_today: number;
    assets_monitored: number;
    assets_in_alert: number;
    system_health_percent: number;
  };
  assets: Asset[];
  incidents: Incident[];
  recent_events: EventRecord[];
};

export type AssetFilters = {
  search?: string;
  status?: AssetStatus | "";
  asset_type?: AssetType | "";
  sort?: "name" | "status" | "battery" | "last_seen";
};

export type IncidentFilters = {
  search?: string;
  status?: IncidentStatus | "";
  severity?: Severity | "";
};

export type EventFilters = {
  search?: string;
  asset_id?: string;
  severity?: Severity | "";
  event_type?: EventType | "";
  sort?: "newest" | "oldest";
  page?: number;
  page_size?: number;
};

export type EventHistoryPage = {
  items: EventRecord[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

function toQueryString(params: Record<string, string | number | undefined>) {
  // URLSearchParams keeps filter construction structured and avoids hand-built
  // query strings as Phase 2 adds more searchable surfaces.
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // A small typed wrapper keeps auth headers, JSON parsing, and error handling
  // consistent without introducing generated clients this early in the project.
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Sentinel API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

export const apiClient = {
  login(payload: LoginPayload) {
    return request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getMe(token: string) {
    return request<User>("/api/auth/me", {
      headers: authHeaders(token)
    });
  },
  getDashboardOverview(token: string) {
    return request<DashboardOverview>("/api/dashboard/overview", {
      headers: authHeaders(token)
    });
  },
  getAssets(token: string, filters: AssetFilters = {}) {
    return request<Asset[]>(`/api/assets${toQueryString(filters)}`, {
      headers: authHeaders(token)
    });
  },
  getAssetDetail(token: string, assetId: string) {
    return request<AssetDetail>(`/api/assets/${assetId}`, {
      headers: authHeaders(token)
    });
  },
  getIncidents(token: string, filters: IncidentFilters = {}) {
    return request<IncidentListItem[]>(`/api/incidents${toQueryString(filters)}`, {
      headers: authHeaders(token)
    });
  },
  getIncidentDetail(token: string, incidentId: string) {
    return request<IncidentDetail>(`/api/incidents/${incidentId}`, {
      headers: authHeaders(token)
    });
  },
  getIncidentSummary(token: string, incidentId: string) {
    return request<IncidentSummary>(`/api/incidents/${incidentId}/summary`, {
      headers: authHeaders(token)
    });
  },
  getEvents(token: string, filters: EventFilters = {}) {
    return request<EventHistoryPage>(`/api/events${toQueryString(filters)}`, {
      headers: authHeaders(token)
    });
  }
};
