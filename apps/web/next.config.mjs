import path from "path";

/**
 * Backend origin the /api proxy forwards to.
 *
 * Resolved when the Next.js server config is evaluated: on `next dev` that is
 * server start (restart to pick up a change), on Vercel it is build time —
 * `rewrites()` is compiled into the routes manifest, so changing API_ORIGIN
 * there needs a redeploy, not just an env edit.
 *
 * Preview fallback: preview deployments have no fixed API URL, so derive the
 * sibling linearcard-api deployment from this one's branch URL. This used to
 * live in the browser (api-client.ts rewriting window.location.hostname); it
 * belongs here now that the browser only ever calls its own origin.
 */
function resolveApiOrigin() {
  if (process.env.API_ORIGIN) return process.env.API_ORIGIN;
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  const vercelUrl =
    process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (process.env.VERCEL_ENV === "preview" && vercelUrl) {
    return `https://${vercelUrl.replace(/^linearcard(-git)?/, "linearcard-api$1")}`;
  }

  return "http://localhost:3001";
}

const API_ORIGIN = resolveApiOrigin().replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname, "../../"),
  },

  // Same-origin proxy: the browser only ever talks to its own origin, so
  // there is no CORS preflight and the admin_session cookie is set on the
  // same host the page runs on. See lib/api-client.ts.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
