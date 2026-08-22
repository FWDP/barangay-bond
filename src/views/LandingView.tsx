import React, { useState, useEffect } from "react";
import { useContractState } from "../hooks/useContractState";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Activity, ChevronDown, ShieldCheck, Coins, Users, Landmark, Sparkles, ArrowRight, Sun, Moon } from "lucide-react";
import { formatXlmToPhp } from "../utils/currency";

type ViewState = "landing" | "auth" | "dashboard";

interface LandingPageProps {
  setViewState: (state: ViewState) => void;
  setIsGuest: (val: boolean) => void;
}

export const LandingView: React.FC<LandingPageProps> = ({ setViewState, setIsGuest }) => {
  const { projects } = useContractState();
  const { getApprovedBarangays } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [approvedCount, setApprovedCount] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    getApprovedBarangays()
      .then((list) => setApprovedCount(list.length))
      .catch(console.error);
  }, [getApprovedBarangays]);

  const handleEnterGuest = () => {
    setIsGuest(true);
    setViewState("dashboard");
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const activeCount = projects.filter((p) => p.status < 2).length;
  const totalLocked = projects.reduce((sum, p) => sum + Number(p.budget), 0);

  return (
    <div className="role-resident" style={{ minHeight: "100dvh", position: "relative", paddingBottom: "7rem", backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Floating Top Navigation Pill */}
      <nav
        style={{
          position: "sticky",
          top: "1.25rem",
          maxWidth: "1080px",
          margin: "0 auto",
          zIndex: 50,
          padding: "0 1.25rem",
        }}
      >
        <div
          style={{
            background: "var(--bg-sidebar)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: "9999px",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-floating)",
            padding: "0.75rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🇵🇭</span>
            <div>
              <span style={{ fontWeight: 900, fontSize: "1.15rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Barangay Bond
              </span>
              <span style={{ fontSize: "0.68rem", color: "var(--role-accent)", fontWeight: 800, marginLeft: "0.5rem", background: "var(--role-accent-soft)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                STELLAR SOROBAN
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              style={{ width: "36px", height: "36px" }}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleEnterGuest}
              style={{ display: "inline-flex" }}
            >
              Public Feed
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setViewState("auth")}
            >
              Access Portal <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        style={{
          padding: "4.5rem 1.25rem 3rem 1.25rem",
          maxWidth: "1080px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            background: "var(--role-accent-soft)",
            border: "1px solid var(--role-accent-border)",
            borderRadius: "9999px",
            padding: "0.45rem 1.2rem",
            color: "var(--role-badge-color)",
            fontSize: "0.84rem",
            fontWeight: 800,
            marginBottom: "1.75rem",
            boxShadow: "0 0 24px var(--role-accent-soft)",
          }}
        >
          <Sparkles size={15} style={{ color: "var(--role-accent)" }} /> Powered by Stellar Soroban Smart Contracts
        </div>

        <h1
          style={{
            fontSize: "clamp(2.3rem, 6vw, 4.2rem)",
            fontWeight: 900,
            lineHeight: 1.12,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
            marginBottom: "1.5rem",
          }}
        >
          Transparent Youth Governance.
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #00d665 0%, #38bdf8 50%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Smart Escrow Auditing on Stellar.
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(1.02rem, 2vw, 1.2rem)",
            color: "var(--text-secondary)",
            maxWidth: "740px",
            margin: "0 auto 2.5rem auto",
            lineHeight: 1.6,
          }}
        >
          A decentralized municipal treasury portal. Local SK project funds are locked inside smart contract escrows and released autonomously when verified youth residents audit and approve deliverables.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "3.5rem",
          }}
        >
          <button
            className="btn btn-primary btn-lg"
            onClick={() => setViewState("auth")}
            style={{ width: "100%", maxWidth: "270px" }}
          >
            Join Barangay Bond <ArrowRight size={18} />
          </button>
          <button
            className="btn btn-outline btn-lg"
            onClick={handleEnterGuest}
            style={{ width: "100%", maxWidth: "270px" }}
          >
            <Activity size={18} /> Live Transparency Feed
          </button>
        </div>
      </section>

      {/* 4-Card Bento Grid */}
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 1.25rem 3.5rem 1.25rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "1.25rem", color: "var(--text-primary)" }}>
          Live On-Chain Transparency Metrics
        </h2>

        <div className="bank-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {/* Card 1: Barangays */}
          <div className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderLeft: "4px solid #6366f1" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8" }}>
              <Landmark size={22} />
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Registered Barangays</span>
            <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "var(--text-primary)" }}>{approvedCount}</div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Active participating LGUs</span>
          </div>

          {/* Card 2: Active Escrows */}
          <div className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderLeft: "4px solid #f59e0b" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
              <ShieldCheck size={22} />
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Active Projects</span>
            <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "var(--text-primary)" }}>{activeCount}</div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Milestones under evaluation</span>
          </div>

          {/* Card 3: Funds Locked */}
          <div className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderLeft: "4px solid #00d665" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(0,214,101,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00d665" }}>
              <Coins size={22} />
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Treasury Escrow</span>
            <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "var(--role-accent)" }}>
              {totalLocked} <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>XLM</span>
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--role-badge-color)", fontWeight: 700 }}>
              ≈ {formatXlmToPhp(totalLocked)} in Soroban
            </span>
          </div>

          {/* Card 4: Youth Quorum */}
          <div className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderLeft: "4px solid #a855f7" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c084fc" }}>
              <Users size={22} />
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Voter Quorum</span>
            <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "#a855f7" }}>60%</div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Required citizen consensus</span>
          </div>
        </div>
      </section>

      {/* How Milestone Escrows Work */}
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 1.25rem 3.5rem 1.25rem" }}>
        <div className="bank-card" style={{ padding: "2.5rem 2rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.4rem", color: "var(--text-primary)" }}>
            How Milestone Governance Works
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", marginBottom: "2rem" }}>
            Tranche-based budget releases protect public funds against misallocation.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            {[
              { step: 1, title: "Lock Escrow", desc: "Admin locks treasury budget; Phase 1 mobilization released." },
              { step: 2, title: "Execute Project", desc: "SK official executes deliverables with contractors." },
              { step: 3, title: "Upload Proof", desc: "Receipts, photo proof & invoices submitted to contract." },
              { step: 4, title: "Youth Vote", desc: "Verified 15-30 residents audit deliverables and sign votes." },
              { step: 5, title: "Auto-Release", desc: "Smart contract unlocks next tranche upon 60% quorum." },
            ].map((s) => (
              <div
                key={s.step}
                style={{
                  background: "var(--bg-elevated)",
                  borderRadius: "20px",
                  padding: "1.25rem 1rem",
                  border: "1px solid var(--border-subtle)",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.45rem",
                }}
              >
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "9999px",
                    background: "var(--role-accent)",
                    color: "var(--text-inverse)",
                    fontWeight: 900,
                    fontSize: "0.92rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px var(--role-accent-soft)",
                  }}
                >
                  {s.step}
                </div>
                <strong style={{ fontSize: "0.98rem", color: "var(--text-primary)", marginTop: "0.3rem" }}>{s.title}</strong>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 1.25rem 3.5rem 1.25rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "1.25rem", color: "var(--text-primary)" }}>
          Frequently Asked Questions
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {[
            {
              q: "Who is eligible to participate and vote?",
              a: "Youth residents aged 15-30 verified by the Barangay Admin. Overaged or underaged residents automatically register as permanent approved viewers to audit timelines.",
            },
            {
              q: "Why is the Stellar blockchain utilized?",
              a: "Stellar Soroban smart contracts guarantee decentralized custody of public budgets. Release tranches execute autonomously based on citizen consensus, creating a permanent audit trail with sub-cent gas fees.",
            },
            {
              q: "Are there gas fees for verified resident voting?",
              a: "Voters require native Testnet XLM to sign contract submissions. The Barangay Admin distributes faucet testnet tokens to linked resident wallets upon identity verification.",
            },
          ].map((faq, idx) => (
            <div
              key={idx}
              className="bank-card"
              style={{
                padding: "1.25rem 1.5rem",
                cursor: "pointer",
              }}
              onClick={() => toggleFaq(idx)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontWeight: 800, fontSize: "0.98rem", color: "var(--text-primary)" }}>{faq.q}</span>
                <ChevronDown
                  size={18}
                  style={{
                    color: "var(--text-secondary)",
                    transform: openFaq === idx ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </div>
              {openFaq === idx && (
                <p style={{ marginTop: "0.85rem", fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.55, borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ maxWidth: "1080px", margin: "0 auto", padding: "2rem 1.25rem", borderTop: "1px solid var(--border-subtle)", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        <p>🇵🇭 Barangay Bond — Official Digital Governance & Treasury Portal for Sangguniang Kabataan</p>
        <p style={{ marginTop: "0.4rem" }}>Built by Renz Buday (Solo Builder) | Powered by Stellar Soroban</p>
      </footer>
    </div>
  );
};

export default LandingView;

