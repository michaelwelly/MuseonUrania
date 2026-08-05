import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // docs/frontend/sitemap.md задаёт маршруты со слешем на конце: /products/,
  // /production/ и так далее. Без этой опции Next срезает слеш и каждая ссылка
  // в меню отвечает редиректом 308 вместо страницы.
  trailingSlash: true,
};

export default nextConfig;
