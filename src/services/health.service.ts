export class HealthService {
  async getHealth() {
    return {
      api: {
        healthy: true,
      },
      database: {
        healthy: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    return {
      ready: true,
      api: { healthy: true },
      database: { healthy: true },
      redis: { configured: false, healthy: false },
      minio: { configured: false, healthy: false },
      odoo: { configured: false, healthy: false },
      timestamp: new Date().toISOString(),
    };
  }

  async getDependencies() {
    return {
      database: { status: "available" },
      redis: { status: "not_configured" },
      minio: { status: "not_configured" },
      odoo: { status: "not_configured" },
      timestamp: new Date().toISOString(),
    };
  }
}
