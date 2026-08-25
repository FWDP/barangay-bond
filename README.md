# 🇵🇭 Barangay Bond

> Milestone-Based Youth Governance & Civic Accountability Platform
> Deployed on **Stellar Soroban Testnet** and powered by **Firebase** and **Google Gemini 2.5 AI**.

---

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge)](https://github.com/FWDP/barangay-bond)
[![Stellar Network](https://img.shields.io/badge/Stellar-Testnet-blue?style=for-the-badge&logo=stellar)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Smart_Contracts-black?style=for-the-badge)](https://stellar.org/soroban)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com)
[![Gemini AI](https://img.shields.io/badge/Google-Gemini_2.5_Flash-violet?style=for-the-badge&logo=google-gemini)](https://deepmind.google/technologies/gemini)
[![Vite](https://img.shields.io/badge/Vite-Vite_8-blueviolet?style=for-the-badge&logo=vite)](https://vite.dev)
[![React](https://img.shields.io/badge/React-React_19-blue?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-TS_6-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Problem & Solution](#-problem--solution)
- [Visual Interface Showcase](#-visual-interface-showcase)
- [System Architecture](#-system-architecture)
- [User Roles & Access Control Matrix](#-user-roles--access-control-matrix)
- [Smart Contract Escrow Engine (Rust / Soroban)](#-smart-contract-escrow-engine-rust--soroban)
- [Google Gemini 2.5 AI Dual-Telemetry Engine](#-google-gemini-25-ai-dual-telemetry-engine)
- [Philippine Statutory & Legal Framework](#-philippine-statutory--legal-framework)
- [User Journeys & Lifecycle Flows](#-user-journeys--lifecycle-flows)
- [Firestore Collections Schema](#-firestore-collections-schema)
- [Security & Governance Safeguards](#-security--governance-safeguards)
- [Tech Stack](#-tech-stack)
- [Environment Variables](#-environment-variables)
- [Local Setup & Installation](#-local-setup--installation)
- [Folder Structure](#-folder-structure)
- [Project Roadmap](#-project-roadmap)
- [License & Authors](#-license--authors)

---

## 🌟 Overview

**Barangay Bond** is a decentralized civic banking platform built specifically for **Sangguniang Kabataan (SK)** youth governance and local community accountability in the Philippines. It bridges official local government administration and citizen verification with public blockchain trust networks. 

By pairing **Stellar Soroban WASM smart contracts** with **Google Gemini 2.5 AI** and **Firebase Cloud Firestore**, Barangay Bond guarantees that municipal civic budgets are locked in tamper-proof escrow contracts. Funds are disbursed in multi-phase milestone tranches only when verified local youth residents review uploaded accomplishment proofs (site photos, receipts) and cast on-chain consensus votes.

---

## 🛑 Problem & Solution

### The Problem
* **Centralized Discretion & Ghost Projects:** Local youth development funds are susceptible to uncontrolled lump-sum releases, project abandonment, and opaque accounting without citizen oversight.
* **Low Civic Engagement:** Youth residents lack simple, transparent channels to audit community initiatives, vote on fund releases, and inspect financial ledgers in real time.
* **Identity Spoofing & Sybil Attacks:** Online voting and project registration are prone to duplicate accounts, fake credentials, and non-resident participation.

### The Solution
* **Multi-Phase Smart Contract Escrows:** 100% of approved project budgets are locked on-chain in Soroban smart contracts. Funds are partitioned into milestone tranches (e.g. 40%-30%-30%) disbursed sequentially upon citizen consensus.
* **Gemini 2.5 AI Proposal Telemetry:** Pre-audits project feasibility against Philippine Department of Trade and Industry (DTI) market rate indices to flag budget padding before escrow lock.
* **AI OCR Document Verification:** Real-time visual analysis of Philippine government IDs (PhilSys, Postal ID, Driver's License, Voter's ID) with PSGC boundary matching to prevent duplicate registrations.
* **Cryptographic e-OR Receipts:** Automated generation of print-ready electronic Official Receipts (e-ORs) compliant with R.A. 8792 for every on-chain tranche payout.
* **Immutable Public Audit Trails:** Every voter registration, project proposal, milestone proof, and fund release is logged immutably on the Stellar blockchain explorer.

---

## 📸 Visual Interface Showcase

### 1. Decentralized Landing Experience & Protocol Architecture
| Landing Page (Dark Mode) | 3D Holographic Vault Parallax HUD |
| :---: | :---: |
| ![Landing Hero](docs/screenshots/landing-hero-dark.png) | ![Vault HUD](docs/screenshots/landing-3d-vault-hud.png) |

| Interactive Protocol Engine (4-Phase Escrow) | 7-Stack Technology Architecture Grid |
| :---: | :---: |
| ![Protocol Engine](docs/screenshots/landing-protocol-simulator.png) | ![Tech Grid](docs/screenshots/landing-tech-architecture.png) |

| Philippine Statutory Compliance (R.A. 7160, 10742, 8792) | 12-Item Searchable System FAQ |
| :---: | :---: |
| ![Legal Matrix](docs/screenshots/landing-legal-compliance.png) | ![FAQ Accordion](docs/screenshots/landing-faq-accordion.png) |

---

### 2. Barangay Admin Governance & KYC Verification Desk
| Admin Treasury Overview & Escrow Vault | Resident KYC Verification Queue (AI Match Scoring) |
| :---: | :---: |
| ![Admin Treasury Desk](docs/screenshots/admin-panel-treasury.png) | ![Admin KYC Queue](docs/screenshots/admin-kyc-queue.png) |

| Admin Dashboard Overview & Live Telemetry | Resident ID Inspection & Validation Modal |
| :---: | :---: |
| ![Admin Overview](docs/screenshots/admin-dashboard-overview.png) | ![KYC ID Inspection](docs/screenshots/admin-kyc-inspect-modal.png) |

---

### 3. Sangguniang Kabataan (SK) Studio & Proposal Creator
| SK Studio Workspace | 3-Tranche Milestone Division Editor |
| :---: | :---: |
| ![SK Studio](docs/screenshots/sk-studio-workspace.png) | ![Proposal Editor](docs/screenshots/sk-proposal-editor.png) |

| SK Projects Management | SK Official Financial Dashboard |
| :---: | :---: |
| ![SK Projects](docs/screenshots/sk-projects-view.png) | ![SK Dashboard](docs/screenshots/sk-dashboard-overview.png) |

---

### 4. Youth Resident Mobile Experience & Citizen Quorum Voting
| Resident Mobile Dashboard & Civic Keypair | Mobile Projects & Deliverables View |
| :---: | :---: |
| ![Mobile Dashboard](docs/screenshots/resident-mobile-dashboard.png) | ![Mobile Projects](docs/screenshots/resident-mobile-projects-voting.png) |

| Citizen Milestone Voting & Proof Modal | Mobile Activity & Immutable Ledger |
| :---: | :---: |
| ![Mobile Voting Modal](docs/screenshots/resident-mobile-voting-modal.png) | ![Mobile Activity](docs/screenshots/resident-mobile-activity.png) |

---

### 5. Public Civic Explorer & Resident Onboarding
| Public Ledger Feed (Guest Explorer Mode) | Active Project Milestones & Deliverables Modal |
| :---: | :---: |
| ![Public Explorer](docs/screenshots/public-explorer-dashboard.png) | ![Milestones Deliverables](docs/screenshots/project-milestones-deliverables.png) |

| Civic Auth Sign-In Portal | 4-Step Resident Registration & PSGC Selector |
| :---: | :---: |
| ![Auth Sign In](docs/screenshots/auth-signin-portal.png) | ![Resident Registration](docs/screenshots/auth-resident-registration.png) |

---

## 🏗️ System Architecture

Barangay Bond implements a modular architecture combining reactive off-chain data coordination (Firebase Firestore + Google Gemini AI) with decentralized cryptographic finality (Stellar Soroban).

```mermaid
graph TD
    Browser[Client Vite Web App] -->|1. Sign Up / Upload Gov ID| FirebaseStorage[Firestore uploaded_documents]
    Browser -->|2. Form Data / Base64 Profile| FirebaseAuth[Firebase Auth Credential]
    FirebaseAuth -->|3. Trigger Verification Hook| FirestoreDB[(Firestore Database)]
    FirestoreDB -->|4. Retrieve Document Ref| GeminiAI[Google Gemini 2.5 Vision API]
    GeminiAI -->|5. Title Case/Fuzzy OCR Match| Browser
    Browser -->|6. In-App Keypair / SWK Link| SWK[StellarWalletsKit / Civic Vault]
    SWK -->|7. Sign Transaction Envelope| RPC[Stellar Testnet RPC Node]
    RPC -->|8. Execute State Transition| Soroban[Soroban Smart Contract #707]
    Soroban -->|9. Emit Events on State Change| EventPoll[Events Polling Service]
    EventPoll -->|10. Feed Real-Time Dashboard| Browser
```

---

## 👥 User Roles & Access Control Matrix

The platform enforces a hierarchical, role-based access control (RBAC) model aligned with Philippine Local Government Code boundaries:

```
SYSTEM ADMIN ──► Approves Barangays & Barangay Admins, Monitors System Audits
     │
     └──► BARANGAY ADMIN ──► Manages Treasury, Locks Escrow, Verifies KYC Queue
               │
               ├──► SK OFFICIAL ──► Proposes Projects, Defines Tranches, Uploads Milestone Proof
               │
               ├──► RESIDENT (YOUTH 15-30) ──► Votes on Milestones, Audits Proofs, Manages Civic Vault
               │
               └──► PUBLIC EXPLORER / VIEWER ──► Read-only inspection of ledgers & e-OR receipts
```

### Roles Breakdown
* **System Admin:** Platform supervisor. Verifies new LGU onboarding requests, audits cross-barangay telemetry, and manages root security configurations.
* **Barangay Admin (Captain / Treasurer):** Executive treasury authority. Reviews Gemini AI proposal scores, locks 100% budget into Soroban escrow, and verifies resident KYC profiles.
* **SK Official (Youth Council Lead):** Civic project builder. Drafts proposals, partitions budgets into multi-phase tranches, and uploads milestone completion proofs.
* **Youth Resident (15–30 Years Old):** Democratic citizen auditor. Holds In-App Civic Keypair voting rights to approve or reject milestone proofs before funds can be released.
* **Public Explorer (Guest):** Open-access auditor. Browses public project ledgers, inspects deliverable photos, and downloads official receipts without signing in.

---

## 🔒 Smart Contract Escrow Engine (Rust / Soroban)

Budgets are guarded on-chain by the `barangay_bond` Soroban contract written in Rust and compiled to WebAssembly (WASM):

```rust
pub fn create_project(
    env: Env,
    admin: Address,
    sk_official: Address,
    name: String,
    budget: i128,
    description: String,
    milestones: Vec<u32>,        // Custom percentage splits summing to 100%
    immediate_phase_1: bool,     // Immediate Mobilization vs Public Feasibility Vote
) -> u32;

pub fn submit_milestone_proof(
    env: Env,
    sk_official: Address,
    project_id: u32,
    milestone_index: u32,
    proof_url: String,
);

pub fn vote_milestone(
    env: Env,
    voter: Address,
    project_id: u32,
    milestone_index: u32,
    approve: bool,
);
```

### Key Contract Safeguards
1. **Budget Integrity:** `milestones.iter().sum() == 100` is enforced at execution. Total project budget is transferred directly to the contract account.
2. **Conflict of Interest Protection (R.A. 10742):** `voter != project.creator` — SK Officials cannot vote on their own project milestones.
3. **Separation of Powers:** `voter != admin` — Barangay Admins are blocked from voting on citizen consensus quorums.
4. **Tranche-Gated Payouts:** Funds for Phase $N$ are disbursed only when milestone approvals reach quorum consensus.

```mermaid
sequenceDiagram
    participant SK as SK Official
    participant BA as Barangay Admin
    participant SC as Soroban Smart Contract
    participant R as Verified Residents

    SK->>BA: Submit Proposal (Multi-Tranche Division)
    BA->>SC: create_project(100% Budget Escrow Lock)
    SC->>SK: Disburse Phase 1 Mobilization (if enabled)
    SK->>SC: submit_milestone_proof(Photos, Receipts)
    R->>SC: vote_milestone(Approve / Reject)
    Note over R,SC: Requires Consensus Quorum
    SC->>SK: release_milestone_escrow(Phase N Payout)
    SC-->>SK: Generate Electronic Official Receipt (e-OR)
```

---

## 🤖 Google Gemini 2.5 AI Dual-Telemetry Engine

Barangay Bond incorporates Google Gemini 2.5 Flash across two critical governance pipelines:

```mermaid
graph LR
    subgraph "1. Proposal Risk & Cost Telemetry"
        A[SK Proposal Submission] --> B[Gemini Budget Analyzer]
        B --> C[DTI Municipal Index Check]
        C --> D[Feasibility Score 0-100]
        D --> E[Admin Escrow Recommendation]
    end

    subgraph "2. Multi-Modal Identity KYC"
        F[Resident ID + Selfie] --> G[Canvas Client Downscaler]
        G --> H[Gemini Vision OCR]
        H --> I[PSGC Boundary Matching]
        I --> J[Duplicate & Sybil Detection]
    end
```

1. **Autonomous Proposal Auditor:** Analyzes itemized material costs, compares pricing with Philippine Department of Trade and Industry (DTI) indices, and assigns a scope feasibility rating.
2. **Identity Verification & Anti-Sybil Pipeline:** Cross-validates government ID details against PSGC registered barangay boundaries and performs multi-factor fuzzy matching to block duplicate enrollments.

---

## 🇵🇭 Philippine Statutory & Legal Framework

Barangay Bond is engineered to fulfill the requirements of three core Philippine Republic Acts:

| Republic Act | Governance Statute | System Implementation |
| :--- | :--- | :--- |
| **R.A. 7160** | *Local Government Code of 1991* | Full public disclosure and open ledger inspection for all LGU disbursements. |
| **R.A. 10742** | *Sangguniang Kabataan Reform Act of 2015* | Democratic youth quorum requirements and financial autonomy for youth councils. |
| **R.A. 8792** | *Electronic Commerce Act of 2000* | Cryptographically signed electronic Official Receipts (e-ORs) with verifiable hashes. |

---

## 🗺️ User Journeys & Lifecycle Flows

### 1. Youth Resident Registration & Voting Journey
```
Guest ──► Sign Up ──► PSGC LGU Select ──► Upload ID & Photo ──► Gemini OCR Match ──► Admin KYC Approval ──► In-App Keypair Generated ──► Active Citizen ──► Vote on Milestone Proofs
```

### 2. SK Official Proposal & Disbursement Journey
```
SK Official ──► Draft Proposal ──► 3-Tranche Breakdown ──► Gemini AI Telemetry ──► Barangay Admin Locks Escrow ──► Execute Milestone ──► Upload Site Photos/Receipts ──► Citizen Quorum Passed ──► Automatic Tranche Payout ──► Download e-OR PDF
```

---

## 📊 Firestore Collections Schema

The platform organizes its off-chain user profiles, verification queues, and audit feeds in a normalized Firestore structure:

| Collection | Purpose | Access Control |
| :--- | :--- | :--- |
| `users` | User profiles, roles (`resident`, `sk_official`, `barangay_admin`), and verification scores | Authenticated user write own; Admin read/update. |
| `barangays` | Master directory of approved Philippine LGUs and PSGC codes | System Admin write; Public read. |
| `resident_verification_queue` | Pending citizen applicants with Gemini OCR scorecards | Barangay Admin read/update. |
| `project_proposals` | Itemized proposals, AI audit telemetry, and milestone specs | SK Official write; Admin review; Public read. |
| `uploaded_documents` | Isolated Base64 government IDs and verification photos | Secure upload hook; Admin audit read-only. |
| `audit_logs` | Immutable audit trial of all administrative and governance events | System-generated write; Admin read-only. |
| `wallet_links` | Links Firestore UIDs to public Stellar account keys | Owner write; Public read to verify voting keys. |

---

## 🛠️ Security & Governance Safeguards

* **Data Isolation:** All sensitive identity documents (Base64 images) are housed in `/uploaded_documents`, completely isolated from general user profiles to prevent data harvesting.
* **Anti-Enumeration Rules:** Unauthenticated users cannot read or search user collections. Duplicate scanning for signups is wrapped in safe client blocks and computed securely in administrator sessions.
* **Session Verification Hooks:** Account statuses (`pending`, `suspended`, `inactive`) are evaluated synchronously on both `signIn` and `onAuthStateChanged` callbacks to prevent session hijacking.
* **Dual Wallet Architecture:** Frictionless **In-App Civic Keypair Vault** for 1-click citizen transactions, with optional support for external hardware/software wallets (Freighter, Albedo, xBull).

---

## 💻 Tech Stack

* **Frontend Framework:** React 19, TypeScript 6, Vite 8
* **Styling Engine:** Vanilla CSS (Glassmorphic Specular Highlights & Micro-animations)
* **Blockchain Core:** Stellar Network, Soroban Smart Contracts (Rust / WASM)
* **Wallet Protocol:** In-App Civic Keypairs + `@creit-tech/stellar-wallets-kit`
* **Off-Chain Backend:** Firebase (Authentication, Cloud Firestore, Security Rules)
* **AI Telemetry:** Google Gemini 2.5 Flash Vision & Text APIs
* **Receipt Engine:** jsPDF R.A. 8792 Electronic Official Receipt Generator
* **Geographic Index:** Philippine Standard Geographic Code (PSGC) API

---

## 🔑 Environment Variables

Create a `.env` file at the root of the project to configure your API integrations:

```env
# Gemini API Key (Identity OCR & Proposal Telemetry)
VITE_GEMINI_API_KEY=AIzaSy...

# Firebase Client Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tugma-8514e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tugma-8514e
VITE_FIREBASE_STORAGE_BUCKET=tugma-8514e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=578517024363
VITE_FIREBASE_APP_ID=1:578517024363:web:5ed04cf894eb1e73f4bb2e
VITE_FIREBASE_MEASUREMENT_ID=G-874ELHD8J6
```

---

## ⚙️ Local Setup & Installation

### Prerequisites
* Node.js v22.14.0+ & npm v11.2.0+
* Rust 1.95.0+ with target `wasm32v1-none`
* Stellar CLI 26.0.0+
* A Stellar wallet browser extension (e.g., Freighter) configured for **Stellar Testnet**.

### Setup Instructions

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/FWDP/barangay-bond.git
   cd barangay-bond
   ```

2. **Initialize Environment Configuration:**
   Create a `.env` file in the root directory and populate your Firebase and Gemini API keys.

3. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```

4. **Run the Vite Local Server:**
   ```bash
   npm run dev
   ```
   *Open `http://localhost:5173` to launch the platform.*

---

## 📂 Folder Structure

```
barangay-bond/
├── contracts/                  # Soroban Smart Contract source code (Rust)
│   └── contracts/barangay-bond/src/lib.rs
├── docs/                       # Project Documentation assets
│   ├── screenshots/            # UI Polished Screens (27 high-res captures)
│   └── README-assets/          # Architecture Diagrams
├── src/                        # React Frontend Core
│   ├── components/             # Reusable UI Panels, Modals, and Widgets
│   ├── configuration/          # Stellar network & contract configurations
│   ├── contexts/               # Auth, Wallet, and Theme state providers
│   ├── events/                 # Stellar RPC event polling listeners
│   ├── hooks/                  # Contract state and telemetry hooks
│   ├── repositories/           # Firestore data repositories
│   ├── rpc/                    # Horizon transaction simulation client
│   ├── services/               # Gemini AI & Firebase service integrations
│   ├── transactions/           # Stellar keypair submit handlers
│   ├── utils/                  # Currency formatting, PDF generator, and QR tools
│   ├── views/                  # Main Landing, Auth, and Dashboard layouts
│   └── types/                  # TypeScript interface specifications
└── firestore.rules             # Granular database security rules
```

---

## 🗺️ Project Roadmap

- [x] **Phase 1: Foundation & Civic Identity** — In-App Civic Keypairs, role access control, and PSGC boundaries.
- [x] **Phase 2: Multi-Phase Soroban Escrow** — Rust WASM contract with multi-tranche milestone payouts and conflict-of-interest guards.
- [x] **Phase 3: Google Gemini 2.5 AI Telemetry** — Proposal scope/DTI pricing audits and visual document OCR verification.
- [x] **Phase 4: Statutory Legal Compliance** — Automated cryptographic e-OR PDF generation under R.A. 8792.
- [x] **Phase 5: High-End UI Modernization** — Luxury landing page, 3D holographic vault HUD, protocol simulator, and mobile-optimized resident dashboard.
- [ ] **Phase 6: Multi-Barangay Scale** — Cross-boundary federation for city and municipal federations.

---

## 📄 License & Authors

* **License:** Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
* **Authors:** Built with 💛 by FWDP / Barangay Bond Development Team.
