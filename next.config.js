/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "maxmind", "puppeteer-core"],
};

module.exports = nextConfig;
