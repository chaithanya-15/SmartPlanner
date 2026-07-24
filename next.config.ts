import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@fullcalendar/core",
    "@fullcalendar/daygrid",
    "@fullcalendar/timegrid",
    "@fullcalendar/interaction",
    "@fullcalendar/react",
    "fullcalendar",
    "@full-ui/headless-calendar",
  ],
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql", "@libsql/hrana-client", "@libsql/core", "@libsql/isomorphic-ws", "ws"],
};

export default nextConfig;
