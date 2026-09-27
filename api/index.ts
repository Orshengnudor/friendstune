import app from "../packages/web/src/api/index";

/**
 * THE API ON VERCEL
 * -----------------
 * In the sandbox a Vite plugin mounts the Hono app on the dev server. In
 * production Vercel serves the built client as static files, so the same Hono
 * app runs here instead, as one Node function that answers everything under
 * /api (the charts: likes, plays, saves, downloads and simulated RF).
 *
 * The rewrite in vercel.json points /api/(.*) at this file. The function reads
 * DATABASE_URL and DATABASE_AUTH_TOKEN from the project's environment
 * variables, which is the only configuration the charts need.
 */
export default function handler(request: Request) {
  return app.fetch(request);
}
