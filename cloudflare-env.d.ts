declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    APP_ENCRYPTION_KEY?: string;
    SERVICE_SECRET?: string;
    PUBLIC_SITE_URL?: string;
    SITES_SERVICE_ACCESS_TOKEN?: string;
  }
}
