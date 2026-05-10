const MONUMENTS = [
  { slug: "paris-roubaix",  label: "Paris-Roubaix",          accent: "#f59e0b", achievement: "Hell of the North" },
  { slug: "flandres",       label: "Tour des Flandres",       accent: "#eab308", achievement: "Patron of Flanders" },
  { slug: "lbl",            label: "Liège-Bastogne-Liège",    accent: "#d946ef", achievement: "La Doyenne" },
  { slug: "lombardia",      label: "Il Lombardia",            accent: "#f97316", achievement: "Il Diavolo" },
  { slug: "milan-sanremo",  label: "Milan-San Remo",          accent: "#06b6d4", achievement: "Primavera" },
]

export default function PrototypePage() {
  return (
    <div style={{ background: "#0c0e12", minHeight: "100vh", padding: "40px 40px", fontFamily: "var(--font-geist-sans, -apple-system, sans-serif)", color: "#f0f4fa" }}>

      <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: "#525d6e", textTransform: "uppercase", marginBottom: 4, textAlign: "center" }}>
        WattHunter — Monuments Achievement Sets
      </h1>
      <p style={{ fontSize: 11, color: "#525d6e", textAlign: "center", marginBottom: 8 }}>
        NB Pro badge (1:1) · FLUX.2 banner (16:9) · Ring system: Victory / Podium / Top 10 / Dynamic
      </p>
      <RingLegend />

      {MONUMENTS.map(m => (
        <MonumentRow key={m.slug} {...m} />
      ))}

    </div>
  )
}

function RingLegend() {
  const rings = [
    { label: "Victory", ring: "#fbbf24", glow: "0 0 20px #fbbf2466, 0 0 40px #fbbf2422", anim: "breathe 3s ease-in-out infinite" },
    { label: "Podium", ring: "#f59e0b", glow: "0 0 8px #f59e0b55", anim: "none" },
    { label: "Top 10", ring: "#6b7280", glow: "none", anim: "none" },
    { label: "Dynamic", ring: "#22d3ee", glow: "0 0 12px #22d3ee66", anim: "pulse-ring 2.5s ease-in-out infinite" },
  ]
  return (
    <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 40, alignItems: "center" }}>
      {rings.map(r => (
        <div key={r.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${r.ring}`, boxShadow: r.glow, animation: r.anim, background: "#1a1e26" }} />
          <span style={{ fontSize: 9, color: "#525d6e", textTransform: "uppercase", letterSpacing: "0.08em" }}>{r.label}</span>
        </div>
      ))}
      <style>{`
        @keyframes breathe {
          0%, 100% { box-shadow: 0 0 8px #fbbf2444; }
          50%       { box-shadow: 0 0 24px #fbbf2488, 0 0 40px #fbbf2422; }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 6px #22d3ee; }
          50%       { box-shadow: 0 0 18px #22d3ee, 0 0 32px #22d3ee44; }
        }
      `}</style>
    </div>
  )
}

function MonumentRow({ slug, label, accent, achievement }: { slug: string; label: string; accent: string; achievement: string }) {
  const badge = `/achievements/monuments/badge-${slug}.png`
  const banner = `/achievements/monuments/banner-${slug}.png`

  const rings = [
    { tier: "Victory",  ring: "#fbbf24", glow: "0 0 20px #fbbf2466, 0 0 40px #fbbf2422", anim: "breathe 3s ease-in-out infinite" },
    { tier: "Podium",   ring: "#f59e0b", glow: "0 0 8px #f59e0b55", anim: "none" },
    { tier: "Top 10",   ring: "#6b7280", glow: "none", anim: "none" },
    { tier: "Dynamic",  ring: "#22d3ee", glow: "0 0 12px #22d3ee66", anim: "pulse-ring 2.5s ease-in-out infinite" },
  ]

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#525d6e", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {label}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left: badges with all 4 ring tiers */}
        <div>
          <div style={{ fontSize: 9, color: "#525d6e", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Badge · 4 ring tiers</div>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
            {rings.map(r => (
              <div key={r.tier} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {[48, 72].map(size => (
                  <div key={size} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: size, height: size, borderRadius: "50%", overflow: "hidden",
                      border: `2px solid ${r.ring}`, boxShadow: r.glow, animation: r.anim,
                      backgroundImage: `url(${badge})`, backgroundSize: "cover", backgroundPosition: "center"
                    }} />
                    {size === 48 && <span style={{ fontSize: 8, color: "#525d6e" }}>{r.tier}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right: profile card with banner + badge */}
        <div>
          <div style={{ fontSize: 9, color: "#525d6e", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>En contexte · Profile card</div>
          <ProfileCard bannerImg={banner} badgeImg={badge} achievement={achievement} accent={accent} />
        </div>
      </div>

      {/* Banner full width below */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 9, color: "#525d6e", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Banner 16:9</div>
        <Banner img={banner} achievement={achievement} accent={accent} />
      </div>
    </div>
  )
}

function Banner({ img, achievement, accent }: { img: string; achievement: string; accent: string }) {
  return (
    <div style={{ height: 100, borderRadius: 8, overflow: "hidden", position: "relative", border: `1px solid ${accent}22` }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.1) 100%)" }} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent, opacity: 0.9 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f4fa" }}>Les Rouleurs du Nord</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>{achievement}</div>
        </div>
      </div>
    </div>
  )
}

function ProfileCard({ bannerImg, badgeImg, achievement, accent }: { bannerImg: string; badgeImg: string; achievement: string; accent: string }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#12151a" }}>
      <div style={{ height: 76, position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 0 18px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${bannerImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 100%)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent, opacity: 0.8 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f4fa" }}>Les Rouleurs du Nord</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{achievement}</div>
        </div>
        <div style={{
          position: "relative", zIndex: 1, width: 50, height: 50, borderRadius: "50%", overflow: "hidden",
          border: `2px solid #fbbf24`, boxShadow: "0 0 16px #fbbf2466",
          backgroundImage: `url(${badgeImg})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0
        }} />
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#f0f4fa" }}>Les Rouleurs du Nord</div>
        <div style={{ fontSize: 11, color: "#525d6e", marginTop: 2 }}>Level 4 · 1 420 XP</div>
        <div style={{ marginTop: 6, padding: "4px 8px", borderRadius: 6, background: `${accent}12`, border: `1px solid ${accent}22`, fontSize: 9, color: accent, fontWeight: 700, letterSpacing: "0.06em", display: "inline-flex", gap: 5 }}>
          🏆 {achievement.toUpperCase()}
        </div>
      </div>
    </div>
  )
}
