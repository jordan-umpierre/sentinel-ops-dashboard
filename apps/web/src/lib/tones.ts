import type { AssetStatus, IncidentStatus, Severity } from "./api";

export const severityTone: Record<Severity, "cyan" | "green" | "amber" | "red"> = {
  info: "cyan",
  low: "green",
  medium: "amber",
  high: "red",
  critical: "red"
};

export const assetStatusTone: Record<AssetStatus, "neutral" | "green" | "amber" | "red"> = {
  nominal: "green",
  watch: "amber",
  alert: "red",
  offline: "neutral"
};

export const incidentStatusTone: Record<IncidentStatus, "green" | "amber" | "red"> = {
  open: "red",
  acknowledged: "amber",
  resolved: "green"
};
