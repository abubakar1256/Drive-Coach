/** @type {import('next').NextConfig} */
const defaultApiServerUrl = process.env.NODE_ENV === "production"
  ? "https://courageous-embrace-production.up.railway.app"
  : "http://localhost:4000";
const configuredApiServerUrl = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL ?? defaultApiServerUrl;
const apiServerUrl = configuredApiServerUrl.replace(/\/$/, "");
const apiDestination = apiServerUrl.endsWith("/api/v1") ? apiServerUrl : `${apiServerUrl}/api/v1`;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiDestination}/:path*` }];
  },
};

export default nextConfig;
