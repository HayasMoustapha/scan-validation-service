/**
 * Non-credential test bootstrap.
 * Runs as a jest `setupFiles` (before any module import). dotenv.config() does NOT
 * override already-set env vars, so values pinned here win over .env / .env.test.
 * - External-provider creds are blanked to force the NODE_ENV==='test' mock path
 *   (no real Twilio/SMTP/SendGrid/Stripe/PayPal/Firebase).
 * - DB_* are pinned to the live local Postgres (5432) that actually exists, so the
 *   integration LOGIC is proven against the real DB. (.env.test pointed at a
 *   non-existent *_test DB with the wrong password.)
 * - REDIS_HOST is forced to IPv4 (localhost->::1 times out; redis on 127.0.0.1:6379).
 */
process.env.NODE_ENV = 'test';

// Disable real SMS providers (Twilio / Vonage)
process.env.TWILIO_ACCOUNT_SID = '';
process.env.TWILIO_AUTH_TOKEN = '';
process.env.TWILIO_PHONE_NUMBER = '';
process.env.VONAGE_API_KEY = '';
process.env.VONAGE_API_SECRET = '';
process.env.VONAGE_FROM_NUMBER = '';

// Disable real email providers (SMTP / SendGrid)
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.SMTP_PASSWORD = '';
process.env.SENDGRID_API_KEY = '';

// Disable real payment providers (Stripe / PayPal)
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.PAYPAL_CLIENT_ID = '';
process.env.PAYPAL_CLIENT_SECRET = '';

// Disable real push provider (Firebase)
process.env.FIREBASE_PROJECT_ID = '';
process.env.FIREBASE_CLIENT_EMAIL = '';
process.env.FIREBASE_PRIVATE_KEY = '';

// Live local Postgres (the only DB that exists on this box)
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = 'event_planner_scan';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'admin';

// Force IPv4 Redis (localhost->::1 times out; redis listens on 127.0.0.1:6379)
process.env.REDIS_HOST = '127.0.0.1';
