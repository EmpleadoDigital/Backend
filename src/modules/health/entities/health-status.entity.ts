export type DatabaseStatus = 'connected' | 'disconnected' | 'not_configured';

export interface HealthStatus {
  status: 'ok';
  service: string;
  environment: string;
  database: DatabaseStatus;
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}
