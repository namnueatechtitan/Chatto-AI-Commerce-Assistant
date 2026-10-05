/** @type {import("next").NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  transpilePackages: ["@chatto/shared", "@chatto/config"],
  async redirects() {
    return [{ source: "/auth", destination: "/login", permanent: false }];
  },
  async rewrites() {
    const apiUrl = (process.env.API_INTERNAL_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
    return [
      { source: "/api/auth/:path*", destination: `${apiUrl}/auth/:path*` },
      { source: "/api/merchants/:path*", destination: `${apiUrl}/merchants/:path*` },
      { source: "/api/onboarding/:path*", destination: `${apiUrl}/onboarding/:path*` },
      { source: "/api/conversations/messages/latest", destination: `${apiUrl}/conversations/messages/latest` },
    ];
  },
};

export default nextConfig;
