const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type UserRole = "admin" | "operator" | "viewer";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type AssetStatus = "nominal" | "watch" | "alert" | "offline";
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
  assets: Array<{
    id: string;
    name: string;
    call_sign: string;
    asset_type: "personnel" | "vehicle" | "sensor" | "gateway";
    status: AssetStatus;
    zone: string;
    latitude: number;
    longitude: number;
    battery_level: number;
    last_seen_at: string;
    metadata: Record<string, unknown>;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    summary: string;
    severity: Severity;
    status: IncidentStatus;
    explanation: string;
    created_at: string;
    updated_at: string;
    related_event_ids: string[];
  }>;
  recent_events: Array<{
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
  }>;
};

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
  }
};
