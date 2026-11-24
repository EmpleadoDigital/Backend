export interface HealthStatus {
  status: 'ok';
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}
