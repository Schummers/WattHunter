import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/league/:leagueId/team/market/:path*",
        destination: "/league/:leagueId/auction/market/:path*",
        permanent: true,
      },
      {
        source: "/league/:leagueId/team/auctions/rounds",
        destination: "/league/:leagueId/auction/rounds",
        permanent: true,
      },
      {
        source: "/league/:leagueId/team/auctions/:path*",
        destination: "/league/:leagueId/auction/:path*",
        permanent: true,
      },
      {
        source: "/league/:leagueId/team/auctions",
        destination: "/league/:leagueId/auction",
        permanent: true,
      },
      {
        source: "/league/:leagueId/auctions/:path*",
        destination: "/league/:leagueId/auction/:path*",
        permanent: true,
      },
      {
        source: "/league/:leagueId/auctions",
        destination: "/league/:leagueId/auction",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
