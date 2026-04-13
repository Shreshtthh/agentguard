/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Stellar SDK to work server-side
  experimental: {
    serverComponentsExternalPackages: ["@stellar/stellar-sdk"],
  },
};

export default nextConfig;
