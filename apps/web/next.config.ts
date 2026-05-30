import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Rider photos are self-hosted in Supabase Storage (PCS blocks direct hotlinks).
        protocol: "https",
        hostname: "uuvshpykvpnhpeondqjt.supabase.co",
        pathname: "/storage/v1/object/public/rider-photos/**",
      },
    ],
  },
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
