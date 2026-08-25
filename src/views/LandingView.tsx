import React, { useState, useEffect, useRef } from "react";
import { useContractState } from "../hooks/useContractState";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  Users,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  ExternalLink,
  Lock,
  FileCheck,
  Layers,
  Cpu,
  Database,
  Terminal,
  FileText,
  MapPin,
  Wallet,
  CheckCircle2,
  ChevronRight,
  Search,
  ChevronDown,
} from "lucide-react";
import { formatXlmToPhp } from "../utils/currency";
import { STELLAR_CONFIG } from "../configuration/config";

type ViewState = "landing" | "auth" | "dashboard";

interface LandingPageProps {
  setViewState: (state: ViewState) => void;
  setIsGuest: (val: boolean) => void;
}

/* =========================================================================
   1. COMPONENT: INTERACTIVE 3D PARTICLE MESH BACKGROUND
   ========================================================================= */
const InteractiveCanvasBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const isMobile = width < 768;
    const nodeCount = isMobile ? 45 : 95;
    const maxDistance = isMobile ? 90 : 135;

    const mouse = { x: -1000, y: -1000, active: false };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const nodes = Array.from({ length: nodeCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 1.8 + 0.8,
    }));

    let isVisible = true;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        if (mouse.active) {
          const dx = mouse.x - node.x;
          const dy = mouse.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            const force = (160 - dist) / 160;
            node.x += (dx / dist) * force * 0.75;
            node.y += (dy / dist) * force * 0.75;
          }
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(6, 182, 212, 0.45)";
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * 0.22;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
};

/* =========================================================================
   2. MAIN LANDING VIEW COMPONENT
   ========================================================================= */
export const LandingView: React.FC<LandingPageProps> = ({ setViewState, setIsGuest }) => {
  const { projects } = useContractState();
  const { getApprovedBarangays } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [approvedCount, setApprovedCount] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqSearch, setFaqSearch] = useState("");
  const [simulatorStep, setSimulatorStep] = useState<1 | 2 | 3 | 4>(1);

  // 3D Tilt Card state
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getApprovedBarangays()
      .then((list) => setApprovedCount(list.length))
      .catch(console.error);
  }, [getApprovedBarangays]);

  const handleEnterGuest = () => {
    setIsGuest(true);
    setViewState("dashboard");
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = -(y / (rect.height / 2)) * 8;
    const rotateY = (x / (rect.width / 2)) * 8;
    setCardTilt({ rotateX, rotateY });
  };

  const handleCardMouseLeave = () => {
    setCardTilt({ rotateX: 0, rotateY: 0 });
  };

  const activeCount = projects.filter((p) => p.status < 2).length;
  const totalLocked = projects.reduce((sum, p) => sum + Number(p.budget), 0);

  // 7 Core Tech Stacks
  const techStacks = [
    {
      name: "Stellar Soroban (Rust)",
      role: "Smart Contract Escrows",
      desc: "WASM-compiled decentralized contracts securing project funds with automated milestone releases.",
      icon: Terminal,
      tag: "Rust / WASM",
      badgeColor: "#38bdf8",
      accentSoft: "rgba(56, 189, 248, 0.12)",
    },
    {
      name: "Google Gemini 2.5 AI",
      role: "Autonomous Proposal Auditor",
      desc: "Real-time budgetary analysis, scope feasibility scoring, and itemized cost variance verification.",
      icon: Cpu,
      tag: "AI Telemetry",
      badgeColor: "#a855f7",
      accentSoft: "rgba(168, 85, 247, 0.12)",
    },
    {
      name: "Firebase Cloud Vault",
      role: "Real-Time Civic DB & Auth",
      desc: "Sub-millisecond reactive user state, audit logs, proposal pipelines, and multi-tier role verification.",
      icon: Database,
      tag: "Cloud Firestore",
      badgeColor: "#f59e0b",
      accentSoft: "rgba(245, 158, 11, 0.12)",
    },
    {
      name: "Vite 8 + React 19",
      role: "High-Performance Client",
      desc: "Sub-second HMR engine, strict TypeScript type system, and modular reactive architecture.",
      icon: Layers,
      tag: "TypeScript 6",
      badgeColor: "#6366f1",
      accentSoft: "rgba(99, 102, 241, 0.12)",
    },
    {
      name: "jsPDF Official e-OR",
      role: "Government Disbursement Receipts",
      desc: "Cryptographic, print-ready electronic receipts compliant with R.A. 8792 Philippine e-Commerce Act.",
      icon: FileText,
      tag: "R.A. 8792 Compliant",
      badgeColor: "#10b981",
      accentSoft: "rgba(16, 185, 129, 0.12)",
    },
    {
      name: "PSGC Geolocation API",
      role: "Philippine Standard Geographic Code",
      desc: "Authoritative LGU registry covering all Philippine regions, provinces, cities, and 42,000+ barangays.",
      icon: MapPin,
      tag: "Official LGU Index",
      badgeColor: "#06b6d4",
      accentSoft: "rgba(6, 182, 212, 0.12)",
    },
    {
      name: "Civic Keypair & In-App Vault",
      role: "Frictionless 1-Click Signing",
      desc: "In-app cryptographic civic vaults with optional external wallet integration (Freighter, Albedo, xBull).",
      icon: Wallet,
      tag: "In-App Keypair",
      badgeColor: "#ec4899",
      accentSoft: "rgba(236, 72, 153, 0.12)",
    },
  ];

  // FAQ Items
  const faqItems = [
    {
      q: "How does Barangay Bond eliminate Ghost Projects?",
      a: "No funds are ever released as an uncontrolled lump sum. Budgets are locked in on-chain Soroban escrow contracts. Phase 1 mobilization requires either immediate or public feasibility authorization, while subsequent tranches are only disbursed after SK officials upload deliverable proof and 2 verified resident votes reach quorum.",
    },
    {
      q: "Who can participate in community voting?",
      a: "All verified youth residents (ages 15-30) who belong to the registered Barangay can cast cryptographic votes to approve or reject milestone proofs. Each citizen vote is signed on-chain.",
    },
    {
      q: "What role does Google Gemini AI play?",
      a: "The Gemini AI Advisor analyzes submitted project proposals against real-world Philippine municipal market rates. It detects overbudgeted materials, checks deliverable timelines, and provides actionable recommendations to the Barangay Captain before escrow approval.",
    },
    {
      q: "Is Barangay Bond compliant with Philippine Law?",
      a: "Yes. Barangay Bond is engineered to fulfill the transparency requirements of R.A. 7160 (Local Government Code of 1991), R.A. 10742 (Sangguniang Kabataan Reform Act), and the electronic document standards of R.A. 8792.",
    },
  ];

  const filteredFaqs = faqItems.filter(
    (item) =>
      item.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div
      className="role-resident"
      style={{
        minHeight: "100dvh",
        position: "relative",
        backgroundColor: "var(--bg-base)",
        color: "var(--text-primary)",
        overflowX: "hidden",
      }}
    >
      {/* 1. Aurora Background Flowing Glows */}
      <div className="aurora-glow-container">
        <div className="aurora-glow-orb aurora-orb-1" />
        <div className="aurora-glow-orb aurora-orb-2" />
        <div className="aurora-glow-orb aurora-orb-3" />
      </div>

      {/* 2. Interactive Canvas Particle Mesh */}
      <InteractiveCanvasBackground />

      {/* =========================================================================
          3. FLOATING STICKY NAVIGATION PILL
          ========================================================================= */}
      <nav
        style={{
          position: "sticky",
          top: "1.25rem",
          maxWidth: "1140px",
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
            padding: "0.7rem 1.4rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo & Identity */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <img
              src="/logo.png"
              alt="Barangay Bond"
              style={{ width: "34px", height: "34px", borderRadius: "9px", objectFit: "contain" }}
            />
            <div>
              <span style={{ fontWeight: 900, fontSize: "1.15rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Barangay Bond
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "var(--role-accent)",
                  fontWeight: 800,
                  marginLeft: "0.5rem",
                  background: "var(--role-accent-soft)",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                }}
              >
                STELLAR SOROBAN
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              style={{ width: "36px", height: "36px" }}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="btn btn-outline btn-sm tap-scale"
              onClick={handleEnterGuest}
              style={{ display: "inline-flex", fontWeight: 700 }}
            >
              Public Feed
            </button>
            <button
              className="btn btn-primary btn-sm tap-scale"
              onClick={() => setViewState("auth")}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 800 }}
            >
              <span>Access Portal</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          4. HERO SECTION WITH 3D HOLOGRAPHIC VAULT TILT CARD
          ========================================================================= */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3.5rem 1.25rem 3rem 1.25rem",
          maxWidth: "1140px",
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {/* Logo Emblem Header */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
            <img
              src="/logo.png"
              alt="Barangay Bond Emblem"
              style={{
                width: "84px",
                height: "84px",
                borderRadius: "22px",
                objectFit: "contain",
                filter: "drop-shadow(0 12px 32px rgba(6, 182, 212, 0.45))",
              }}
            />
          </div>

          {/* Live Status Pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--role-accent-soft)",
              border: "1px solid var(--role-accent-border)",
              borderRadius: "9999px",
              padding: "0.45rem 1.25rem",
              color: "var(--role-badge-color)",
              fontSize: "0.82rem",
              fontWeight: 800,
              marginBottom: "1.5rem",
              boxShadow: "0 0 24px var(--role-accent-soft)",
            }}
          >
            <span className="pulse-beacon" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            <span>Stellar Soroban Main Vault Live</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem" }}>{STELLAR_CONFIG.network.toUpperCase()}</span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(2.4rem, 6.5vw, 4.5rem)",
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-0.035em",
              maxWidth: "880px",
              margin: "0 0 1.25rem 0",
            }}
          >
            Decentralized Civic Finance.<br />
            <span className="landing-shimmer-text">Zero Ghost Projects.</span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              color: "var(--text-secondary)",
              maxWidth: "700px",
              lineHeight: 1.6,
              margin: "0 0 2.25rem 0",
            }}
          >
            Empowering Philippine Sangguniang Kabataan and Barangay Captains with multi-phase smart contract escrows, autonomous AI risk auditing, and verified citizen voting.
          </p>

          {/* Dual CTAs */}
          <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", justifyContent: "center", marginBottom: "3.5rem" }}>
            <button
              className="btn btn-primary btn-lg tap-scale"
              onClick={() => setViewState("auth")}
              style={{
                height: "54px",
                padding: "0 2rem",
                fontSize: "1rem",
                fontWeight: 800,
                boxShadow: "0 12px 28px -6px var(--role-accent-soft)",
              }}
            >
              Launch Civic Portal <ArrowRight size={18} />
            </button>
            <button
              className="btn btn-outline btn-lg tap-scale"
              onClick={handleEnterGuest}
              style={{ height: "54px", padding: "0 1.75rem", fontSize: "1rem", fontWeight: 700 }}
            >
              Explore Public Ledgers
            </button>
          </div>
        </div>

        {/* 3D Parallax Tilt Vault Holographic Card */}
        <div
          ref={cardRef}
          className="vault-3d-card-wrapper"
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          style={{
            maxWidth: "840px",
            margin: "0 auto",
            transform: `rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg)`,
            cursor: "pointer",
          }}
          onClick={handleEnterGuest}
        >
          <div className="vault-3d-card-inner" style={{ padding: "2rem" }}>
            <div className="vault-card-sheen" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: "var(--role-accent-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--role-accent)",
                  }}
                >
                  <Lock size={24} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Verified Soroban Escrow Contract
                  </span>
                  <h3 style={{ margin: "0.15rem 0 0 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    Barangay Civic Vault #707
                  </h3>
                </div>
              </div>

              <span className="badge badge-success" style={{ padding: "0.35rem 0.85rem", fontSize: "0.76rem" }}>
                ● 100% Cryptographically Secured
              </span>
            </div>

            {/* Financial Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", textAlign: "left", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--bg-elevated)", padding: "1.1rem", borderRadius: "16px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Escrow Locked</span>
                <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--role-accent)", marginTop: "0.2rem" }}>
                  {formatXlmToPhp(totalLocked)}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  {totalLocked.toLocaleString()} XLM locked
                </div>
              </div>

              <div style={{ background: "var(--bg-elevated)", padding: "1.1rem", borderRadius: "16px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Active Projects in Execution</span>
                <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--text-primary)", marginTop: "0.2rem" }}>
                  {activeCount} Community Initiatives
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  All phases tied to citizen voting
                </div>
              </div>

              <div style={{ background: "var(--bg-elevated)", padding: "1.1rem", borderRadius: "16px", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Governance Consensus</span>
                <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#10b981", marginTop: "0.2rem" }}>
                  2 Approvals Quorum
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  {approvedCount > 0 ? `${approvedCount} Registered LGUs` : "100% On-Chain Finality"}
                </div>
              </div>
            </div>

            {/* Interactive Footer Callout */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              <span>💡 Tilt or hover card for 3D holographic perspective</span>
              <span style={{ color: "var(--accent-blue)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                Click to inspect live ledger <ExternalLink size={13} />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. PLAYABLE 4-STEP SMART CONTRACT ESCROW SIMULATOR
          ========================================================================= */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "4.5rem 1.25rem",
          maxWidth: "1140px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Interactive Architecture
          </span>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 900, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            How a Civic Escrow Works in 4 Steps
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0.5rem auto 0 auto", fontSize: "0.95rem" }}>
            Click on any step below to simulate how Soroban smart contracts guarantee accountability at every phase.
          </p>
        </div>

        {/* 4 Step Selector Nodes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
          {[
            {
              num: 1,
              title: "1. Proposal & AI Audit",
              desc: "SK Official drafts project. Gemini AI audits budgets & feasibility.",
              icon: Cpu,
            },
            {
              num: 2,
              title: "2. Admin Escrow Lock",
              desc: "Barangay Admin approves & locks 100% budget into Soroban.",
              icon: Lock,
            },
            {
              num: 3,
              title: "3. Citizen Quorum Vote",
              desc: "Citizens audit deliverables. 2 approvals unlock next tranche.",
              icon: Users,
            },
            {
              num: 4,
              title: "4. Instant Payout & e-OR",
              desc: "Contract releases payment + generates official Philippine e-OR.",
              icon: FileCheck,
            },
          ].map((s) => {
            const Icon = s.icon;
            const isActive = simulatorStep === s.num;
            return (
              <div
                key={s.num}
                className={`simulator-step-node ${isActive ? "active" : ""}`}
                onClick={() => setSimulatorStep(s.num as any)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: isActive ? "var(--role-accent)" : "var(--bg-elevated)",
                      color: isActive ? "#ffffff" : "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <strong style={{ fontSize: "0.92rem", color: isActive ? "var(--role-accent)" : "var(--text-primary)" }}>
                    {s.title}
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Live Simulator Preview Display */}
        <div
          className="bank-card"
          style={{
            padding: "2rem",
            border: "1px solid var(--border-primary)",
            background: "var(--bg-card)",
            borderRadius: "24px",
            boxShadow: "var(--shadow-floating)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span className="badge badge-info" style={{ fontSize: "0.75rem" }}>
                Simulation State: Step {simulatorStep} of 4
              </span>
              <strong style={{ fontSize: "1.05rem", color: "var(--text-primary)" }}>
                {simulatorStep === 1 && "SK Official Submits Basketball Court Lighting Repair (₱50,000 / 1,000 XLM)"}
                {simulatorStep === 2 && "Barangay Admin Locks 1,000 XLM into Contract #707 Escrow"}
                {simulatorStep === 3 && "Youth Residents Review Proof of Materials & Cast Cryptographic Votes"}
                {simulatorStep === 4 && "Soroban Contract Disburses 400 XLM Tranche + Issues Official Receipt"}
              </strong>
            </div>

            <button
              className="btn btn-sm btn-primary tap-scale"
              onClick={() => setSimulatorStep((prev) => (prev < 4 ? ((prev + 1) as any) : 1))}
              style={{ fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>{simulatorStep === 4 ? "Restart Flow" : "Advance Step"}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Step Visualizer Body */}
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "18px", padding: "1.5rem" }}>
            {simulatorStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent-purple)", fontWeight: 800 }}>
                  <Sparkles size={16} /> Gemini 2.5 AI Audit Result:
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  ✓ <strong>Feasibility Score: 94/100 (Optimal)</strong> • LED Floodlight unit prices align with DTI municipal price indices. 3-phase milestone division approved.
                </div>
              </div>
            )}

            {simulatorStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent-blue)", fontWeight: 800 }}>
                  <Lock size={16} /> Soroban Escrow Lock Verified:
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  ✓ <strong>1,000 XLM Transferred to Contract Escrow</strong> • Funds cannot be withdrawn or diverted without citizen quorum consensus.
                </div>
              </div>
            )}

            {simulatorStep === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent-green)", fontWeight: 800 }}>
                  <Users size={16} /> Community Consensus Meter:
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  👍 <strong>2 Verified Resident Approvals Cast</strong> • Quorum met! On-chain trigger ready to release Phase 1 mobilization.
                </div>
              </div>
            )}

            {simulatorStep === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#10b981", fontWeight: 800 }}>
                  <CheckCircle2 size={16} /> Automatic Milestone Payout Complete:
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  ✓ <strong>400 XLM Transferred to SK Official Wallet</strong> • Electronic Official Receipt <code>BGY-OR-707A</code> generated and permanently audit-linked.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. FULL 7 TECH STACK MATRIX SHOWCASE
          ========================================================================= */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "4.5rem 1.25rem",
          maxWidth: "1140px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Technical Architecture
          </span>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 900, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            Powered by 7 Production-Grade Technologies
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0.5rem auto 0 auto", fontSize: "0.95rem" }}>
            Engineered from smart contracts to AI auditing to provide high reliability, sub-second latency, and institutional trust.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {techStacks.map((tech) => {
            const Icon = tech.icon;
            return (
              <div key={tech.name} className="tech-stack-card">
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: tech.accentSoft,
                        color: tech.badgeColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        padding: "0.2rem 0.55rem",
                        borderRadius: "9999px",
                        background: tech.accentSoft,
                        color: tech.badgeColor,
                      }}
                    >
                      {tech.tag}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.2rem 0" }}>
                    {tech.name}
                  </h3>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--role-accent)", marginBottom: "0.6rem" }}>
                    {tech.role}
                  </div>
                  <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                    {tech.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          7. GOVERNANCE PILLARS SECTION
          ========================================================================= */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "4rem 1.25rem",
          maxWidth: "1140px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Institutional Trust
          </span>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 900, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            Engineered for Philippine Local Governance
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          {[
            {
              title: "Tranche-Based Escrow",
              desc: "Budgets locked in Soroban. Funds disbursed in verified phases rather than vulnerable lump sums.",
              icon: Lock,
            },
            {
              title: "Citizen Quorum Voting",
              desc: "Verified youth residents hold voting keys to approve deliverables before releases happen.",
              icon: Users,
            },
            {
              title: "Autonomous AI Telemetry",
              desc: "Google Gemini 2.5 flags price variances, timeline risks, and suspicious proposals before approval.",
              icon: Cpu,
            },
            {
              title: "Electronic Official Receipts",
              desc: "Cryptographically verifiable e-OR PDFs generated for every on-chain transaction under R.A. 8792.",
              icon: FileCheck,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bank-card"
                style={{
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "var(--role-accent-soft)",
                    color: "var(--role-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={22} />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                  {item.title}
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          8. PHILIPPINE STATUTORY & LEGAL COMPLIANCE
          ========================================================================= */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3.5rem 1.25rem",
          maxWidth: "1140px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)",
            border: "1px solid var(--role-accent-border)",
            borderRadius: "24px",
            padding: "2.5rem 2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "2rem" }}>🇵🇭</span>
            <h3 style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
              Full Compliance with Philippine Republic Acts
            </h3>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "1rem", maxWidth: "800px" }}>
            <div style={{ background: "var(--bg-card)", padding: "0.85rem 1.25rem", borderRadius: "14px", border: "1px solid var(--border-subtle)", fontSize: "0.85rem", fontWeight: 700 }}>
              ⚖️ <strong>R.A. 7160:</strong> Local Government Code of 1991 (Public Transparency)
            </div>
            <div style={{ background: "var(--bg-card)", padding: "0.85rem 1.25rem", borderRadius: "14px", border: "1px solid var(--border-subtle)", fontSize: "0.85rem", fontWeight: 700 }}>
              📜 <strong>R.A. 10742:</strong> Sangguniang Kabataan Reform Act
            </div>
            <div style={{ background: "var(--bg-card)", padding: "0.85rem 1.25rem", borderRadius: "14px", border: "1px solid var(--border-subtle)", fontSize: "0.85rem", fontWeight: 700 }}>
              🧾 <strong>R.A. 8792:</strong> Electronic Commerce Act (Digital e-ORs)
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. SEARCHABLE FAQ ACCORDION
          ========================================================================= */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "4.5rem 1.25rem",
          maxWidth: "880px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Frequently Asked Questions
          </span>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 900, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            Everything You Need to Know
          </h2>

          {/* Search Bar */}
          <div style={{ position: "relative", maxWidth: "460px", margin: "1.25rem auto 0 auto" }}>
            <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search questions (e.g. escrow, voting, AI)..."
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              style={{ paddingLeft: "2.5rem", borderRadius: "9999px", height: "46px" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {filteredFaqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={faq.q}
                className="bank-card"
                style={{
                  padding: "1.25rem 1.5rem",
                  cursor: "pointer",
                  borderRadius: "16px",
                  transition: "all 0.2s ease",
                }}
                onClick={() => setOpenFaq(isOpen ? null : index)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "1rem", color: "var(--text-primary)" }}>{faq.q}</strong>
                  <ChevronDown
                    size={18}
                    style={{
                      color: "var(--text-muted)",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.25s ease",
                    }}
                  />
                </div>
                {isOpen && (
                  <p style={{ margin: "0.85rem 0 0 0", fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          10. FINTECH FOOTER & SYSTEM STATUS
          ========================================================================= */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid var(--border-primary)",
          background: "var(--bg-sidebar)",
          padding: "3.5rem 1.25rem 2.5rem 1.25rem",
        }}
      >
        <div
          style={{
            maxWidth: "1140px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <img src="/logo.png" alt="Barangay Bond" style={{ width: "36px", height: "36px", borderRadius: "10px" }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.05rem", color: "var(--text-primary)" }}>Barangay Bond</div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Decentralized Civic Banking on Stellar Soroban</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${STELLAR_CONFIG.contractId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent-blue)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 700 }}
            >
              Soroban Contract Explorer <ExternalLink size={12} />
            </a>
            <span>•</span>
            <button
              onClick={() => setViewState("auth")}
              style={{ background: "none", border: "none", color: "var(--role-accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              Sign In
            </button>
          </div>
        </div>

        <div style={{ maxWidth: "1140px", margin: "2rem auto 0 auto", textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          © 2026 Barangay Bond. Built for the Republic of the Philippines on the Stellar Network.
        </div>
      </footer>
    </div>
  );
};

export default LandingView;
