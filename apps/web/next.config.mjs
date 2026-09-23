/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@chatto/shared", "@chatto/config"],
  async rewrites() {
    const apiUrl = (process.env.API_INTERNAL_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
    return [{ source: "/api/auth/:path*", destination: `${apiUrl}/auth/:path*` }];
  },
};

export default nextConfig;
