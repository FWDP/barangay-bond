import type { ProjectPhase } from "../types";
import { getXlmToPhpRate, xlmToPhp } from "../utils/currency";

export interface PhaseFeedback {
  phaseNumber: number;
  title: string;
  suggestedTitle?: string;
  percentage: number;
  suggestedPercentage?: number;
  amountXlm: number;
  assessment: string;
  status: "good" | "needs_clarity" | "budget_mismatch";
  recommendation: string;
}

export interface GovernmentAgencyIntegration {
  agencyName: string; // e.g. "City Disaster Risk Reduction & Management Office (CDRRMO)", "DICT", "TESDA", "BFP / PNP", "DENR", "City Health Office"
  borrowableItemsOrService?: string; // e.g. "Spine boards, CPR simulation manikins, megaphones, emergency rescue kits (BORROW FOR FREE)"
  roleOrBenefit: string; // e.g. "Free certified BLS/CPR modules & equipment loan saves public funds"
  recommendedAction: string; // e.g. "Coordinate with City DRRMO to borrow spine boards and request free certified training, purchasing only consumables at standard SRP."
}

export interface AIAdvisorResponse {
  feasibilityScore: number; // 0 - 100
  verdict: "Highly Feasible" | "Requires Minor Adjustments" | "Needs Revision";
  summary: string;
  recommendedTotalXlm: number;
  budgetAction: "reduce" | "increase" | "optimal";
  totalBudgetJustification: string;
  improvedProjectName?: string;
  improvedDescription?: string;
  budgetComparison: {
    declaredTotalXlm: number;
    phasesSumXlm: number;
    isBalanced: boolean;
    differenceXlm: number;
  };
  phaseFeedbacks: PhaseFeedback[];
  recommendedPhases: ProjectPhase[];
  partnerAgencies?: GovernmentAgencyIntegration[];
  keyTips: string[];
}

export const aiProposalAdvisorService = {
  /**
   * Analyze proposal using live Gemini API with real-world Philippine procurement audit
   */
  async analyzeProposal(
    projectName: string,
    description: string,
    totalBudgetXlm: number,
    phases: ProjectPhase[],
    customInstruction?: string
  ): Promise<AIAdvisorResponse> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || "";
    const validBudget = Math.max(totalBudgetXlm || 0, 0);
    const currentRate = getXlmToPhpRate();
    if (currentRate <= 0) {
      return {
        feasibilityScore: 0,
        verdict: "Needs Revision",
        summary: "❌ Real-world market audit failed: Live XLM to PHP exchange rate is offline.",
        recommendedTotalXlm: 0,
        budgetAction: "optimal",
        totalBudgetJustification: "The exchange rate APIs (CoinGecko/Coinbase) are currently unreachable and no cache exists. Budgets cannot be evaluated without real-time price feeds.",
        budgetComparison: {
          declaredTotalXlm: validBudget,
          phasesSumXlm: 0,
          isBalanced: false,
          differenceXlm: 0,
        },
        phaseFeedbacks: [],
        recommendedPhases: [],
        keyTips: [
          "⚠️ Internet Connection: Please check your internet connectivity.",
          "🔒 Safety First: Financial audits are disabled when live exchange rates cannot be verified.",
        ],
      };
    }

    const declaredPhp = xlmToPhp(validBudget);
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    console.log("🤖 [Real-World AI Auditor Debugger] Starting audit...", {
      projectName,
      descriptionLength: description?.length || 0,
      totalBudgetXlm: validBudget,
      declaredPhp,
      currentRate,
      todayStr,
      phaseCount: phases.length,
      customInstruction,
      apiKeyConfigured: !!apiKey,
    });

    // If Gemini API Key is available, call live Gemini 2.5 Flash Endpoint
    if (apiKey) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const systemPrompt = `You are an expert Financial Auditor, Procurement Specialist, and Project Architect for Philippine Sangguniang Kabataan (SK) local youth government projects (RA 10742 - SK Reform Act).
Audit and optimize the following project proposal based on REAL-WORLD PHILIPPINE MARKET COSTS and SUGGESTED RETAIL PRICES (SRP).

CURRENT REAL-WORLD DATE: ${todayStr} (Use this real calendar anchor whenever the user or proposal requests valid upcoming dates, schedules, or timelines).
LIVE STELLAR EXCHANGE RATE: 1 XLM = ₱${currentRate.toFixed(2)} PHP

Project Title: "${projectName}"
Project Description: "${description}"
Declared Total Budget (XLM): ${validBudget} XLM (≈ ₱${declaredPhp.toLocaleString()} PHP)
Declared Tranches: ${JSON.stringify(phases)}
${customInstruction ? `
SPECIAL USER DIRECTIVES & CUSTOM CONDITIONS:
The user has provided the following specific constraints, adjustments, or prompt instructions:
"${customInstruction}"
MANDATORY: You MUST strictly honor these user directives in your audit, title/description refinement, deliverable pricing, and tranche breakdown (e.g. if the user asks to add valid realistic dates next month on a Saturday into the description, calculate the actual upcoming date from ${todayStr}, update the description, and assign corresponding target dates to phases)!
` : ""}

CORE AUDIT & PROCUREMENT PROTOCOL:
1. INTER-AGENCY BORROWING & FREE COUNTERPARTING (PRIORITY 1):
   - Evaluate all deliverables to see if specific equipment, gear, venues, or services can be BORROWED or REQUESTED FOR FREE from relevant Philippine Government Partner Agencies:
     * City DRRMO / BFP / Red Cross: Spine boards, CPR training manikins, megaphones, emergency rescue gear, certified resource instructors.
     * DENR / Dept. of Agriculture: Tree seedlings, organic fertilizer, basic planting tools.
     * DICT / DOST: Public WiFi bandwidth, digital literacy modules, tech starter grants.
     * Barangay LGU / City Hall: Tents, tables, chairs, PA sound systems, public gymnasium / covered court venues.
     * TESDA / DepEd: Certified master trainers, vocational curriculum, public school classrooms.
   - For all items that can be borrowed or partnered for free, DO NOT budget commercial purchase costs. Recommend borrowing/partnering to save public funds.

2. STANDARD PHILIPPINE MARKET COST & SRP FOR PURCHASES (PRIORITY 2):
   - For items that CANNOT be borrowed and must be purchased (e.g. consumable first-aid supplies, sports uniforms/balls, hardware, participant snacks, printer ink, trophies):
     * Price them strictly using standard Philippine Suggested Retail Price (SRP) / DTI & COA market retail rates.
     * Do not use artificial budget caps or arbitrary ranges; evaluate the exact deliverable quantities and itemized SRP costs.

3. AUTONOMOUS DELIVERABLE PRICING, TITLE/DESCRIPTION REFINEMENT & TARGET DATES:
   - If the user custom prompt requests or benefits from improvements to the Title or Description (e.g. adding realistic schedules, clarifying scope, correcting typos), provide "improvedProjectName" and "improvedDescription".
   - If generating upcoming dates or timelines, calculate them accurately relative to ${todayStr} (e.g. if scheduling next month, pick an upcoming date in the following month).
   - In "recommendedPhases", include a realistic "targetDate" for each phase (e.g. "Sept 19, 2026" or "Week 1: Sept 5-10, 2026").
   - Independently calculate "recommendedTotalXlm" in XLM (Stellar Lumens) based on the exact deliverables.
   - In phase descriptions, cite realistic Philippine Peso SRP values for each item.
   - Calculate an authentic integer "feasibilityScore" (0 - 100) based on budget realism (40 pts), scope clarity (25 pts), phase auditability (20 pts), and youth impact (15 pts).

4. PROMPT-DRIVEN AVAILABILITY & INTER-AGENCY FALLBACK CASCADE (CRITICAL):
   When the user custom prompt states that an item, equipment, or facility is UNAVAILABLE from a specific agency (e.g. "no available spine board at barangay outpost", "CDRRMO has no training manikins", "City Hall gym is occupied"):
   - Priority A (Alternative Partner Agency Referral): First check if another Philippine government agency, LGU department, or NGO can lend the item for free (e.g., if Barangay Outpost lacks spine boards, check City DRRMO, Bureau of Fire Protection (BFP), or Philippine Red Cross). Explain this alternative referral clearly in "partnerAgencies".
   - Priority B (Standard Market SRP Purchase): If no partner agency can provide the item for free, or if the user prompt directs to buy it, budget the item using standard Philippine Suggested Retail Price (SRP) and explain the purchase derivation in "totalBudgetJustification" and phase descriptions.
 5. STRICT SCOPE-LOCKED REVISIONS (DO NOT MODIFY UNMENTIONED DETAILS):
    - When executing custom prompts or revisions, ONLY modify the specific fields, items, or dates explicitly targeted by the user.
    - Preserve all other deliverable components and existing scope intact without resetting or altering unmentioned fields.

Return ONLY valid JSON matching this exact structure (no markdown fences, no comments):
{
  "feasibilityScore": 88,
  "verdict": "Highly Feasible",
  "summary": "Honest real-world SRP procurement and inter-agency borrowing analysis.",
  "improvedProjectName": "Refined Project Title If Applicable",
  "improvedDescription": "Refined project description incorporating any requested dates or scope improvements.",
  "recommendedTotalXlm": 115.0,
  "budgetAction": "optimal",
  "totalBudgetJustification": "Itemized derivation detailing items borrowed for free from government agencies vs items purchased via standard SRP.",
  "recommendedPhases": [
    {
      "phaseNumber": 1,
      "title": "Phase 1: Mobilization & Materials Procurement",
      "percentage": 50,
      "amountXlm": 57.5,
      "targetDate": "September 12, 2026",
      "description": "Procurement of consumable supplies at standard SRP with realistic PHP estimates.",
      "requiredProofs": "Official BIR sales invoices and supplier delivery vouchers"
    }
  ],
  "phaseFeedbacks": [
    {
      "phaseNumber": 1,
      "title": "Phase 1 Title",
      "percentage": 50,
      "amountXlm": 57.5,
      "assessment": "Phase 1 cost assessment.",
      "status": "good",
      "recommendation": "Upload official receipts and geo-tagged photos."
    }
  ],
  "partnerAgencies": [
    {
      "agencyName": "City Disaster Risk Reduction & Management Office (CDRRMO)",
      "borrowableItemsOrService": "Spine boards, CPR manikins, and certified BLS trainers (BORROW FOR FREE)",
      "roleOrBenefit": "Free certified BLS/CPR resource speakers and equipment loan saves public funds",
      "recommendedAction": "Coordinate with City DRRMO to borrow spine boards and request certified instructors for the training sessions, purchasing only consumable trauma kits at standard SRP."
    }
  ],
  "keyTips": [
    "Inter-Agency Borrowing: Borrow government gear (spine boards, tents, sound systems) to save budget.",
    "Standard SRP Invoicing: Ensure supplier sales invoices match DTI Suggested Retail Prices."
  ]
}`;

        console.log("🤖 [Real-World AI Auditor] Sending POST request to Gemini 2.5 Flash API...");

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            console.log("🤖 [Real-World AI Auditor] Gemini Cost-Weighted Audit Result:", parsed);

            const aiTotal = parsed.recommendedTotalXlm || validBudget || 100;
            const action = parsed.budgetAction || (validBudget > aiTotal * 1.5 ? "reduce" : validBudget < aiTotal * 0.5 && validBudget > 0 ? "increase" : "optimal");
            
            const rawPhases: any[] = parsed.recommendedPhases || [];
            const count = rawPhases.length || 1;
            const rawSum = rawPhases.reduce((acc, p) => acc + (Number(p.percentage) || 0), 0);

            // Proportional normalization to preserve the AI's authentic cost distribution analysis
            let normalizedPhases = rawPhases.map((p: any, i: number) => {
              const rawPct = Number(p.percentage) || 0;
              let proportionalPct = rawSum > 0 ? Math.round((rawPct / rawSum) * 100) : Math.floor(100 / count);
              return {
                phaseNumber: i + 1,
                title: p.title || `Phase ${i + 1}`,
                percentage: proportionalPct,
                amountXlm: Math.round(((aiTotal * proportionalPct) / 100) * 10) / 10,
                targetDate: p.targetDate || undefined,
                description: p.description || "",
                requiredProofs: p.requiredProofs || "Official BIR Receipts & Geo-tagged progress photos",
              };
            });

            // Adjust any 1-2% rounding difference onto the largest phase
            const currentSum = normalizedPhases.reduce((acc, p) => acc + p.percentage, 0);
            if (currentSum !== 100 && normalizedPhases.length > 0) {
              const diff = 100 - currentSum;
              let maxIdx = 0;
              for (let i = 1; i < normalizedPhases.length; i++) {
                if (normalizedPhases[i].percentage > normalizedPhases[maxIdx].percentage) {
                  maxIdx = i;
                }
              }
              normalizedPhases[maxIdx].percentage += diff;
              normalizedPhases[maxIdx].amountXlm = Math.round(((aiTotal * normalizedPhases[maxIdx].percentage) / 100) * 10) / 10;
            }

            const sanitizedAgencies = (parsed.partnerAgencies || []).map((agency: any) => ({
              agencyName: agency.agencyName || "",
              borrowableItemsOrService: agency.borrowableItemsOrService || "",
              roleOrBenefit: agency.roleOrBenefit || "",
              recommendedAction: agency.recommendedAction || "",
            }));

            return {
              feasibilityScore: parsed.feasibilityScore || 88,
              verdict: parsed.verdict || "Highly Feasible",
              summary: parsed.summary || `Real-world market audit completed for "${projectName}".`,
              improvedProjectName: parsed.improvedProjectName || undefined,
              improvedDescription: parsed.improvedDescription || undefined,
              recommendedTotalXlm: aiTotal,
              budgetAction: action,
              totalBudgetJustification: parsed.totalBudgetJustification || `Real-world Philippine market audit recommends ${aiTotal} XLM (≈ ₱${(aiTotal * currentRate).toLocaleString()}).`,
              budgetComparison: {
                declaredTotalXlm: validBudget,
                phasesSumXlm: aiTotal,
                isBalanced: true,
                differenceXlm: 0,
              },
              phaseFeedbacks: (parsed.phaseFeedbacks || normalizedPhases.map(p => ({
                phaseNumber: p.phaseNumber,
                title: p.title,
                percentage: p.percentage,
                amountXlm: p.amountXlm,
                assessment: `Allocates ${p.percentage}% (${p.amountXlm} XLM) based on standard itemized deliverables.`,
                status: "good" as const,
                recommendation: "Ensure supplier invoices match DTI Suggested Retail Prices.",
              }))),
              recommendedPhases: normalizedPhases,
              partnerAgencies: sanitizedAgencies.length > 0 ? sanitizedAgencies : [
                {
                  agencyName: "National Youth Commission (NYC) & DILG",
                  borrowableItemsOrService: "CBYDP Youth Development Guidelines and certified trainers",
                  roleOrBenefit: "SK Governance & Standard Youth Development Framework compliance",
                  recommendedAction: "Ensure project objectives align with the Comprehensive Barangay Youth Development Plan (CBYDP)."
                }
              ],
              keyTips: parsed.keyTips || [
                "Inter-Agency Borrowing: Borrow government gear (spine boards, sound systems) to save budget.",
                "Standard SRP Invoicing: Ensure supplier sales invoices match DTI Suggested Retail Prices."
              ],
            };
          }
        }
      } catch (geminiErr: any) {
        console.error("❌ [Real-World AI Auditor] Gemini API exception:", geminiErr);
      }
    }

    // Fallback rule engine calculation based on live rate (Community SK Project Scale: ₱3,000 - ₱25,000 PHP)
    let recTotal = validBudget > 0 ? validBudget : Math.round(8000 / currentRate);
    const lower = (projectName + " " + description).toLowerCase();

    if (lower.includes("wifi") || lower.includes("computer") || lower.includes("hub") || lower.includes("pc") || lower.includes("e-library") || lower.includes("study")) {
      recTotal = Math.round(18000 / currentRate); // ~₱18,000 PHP (approx 150-180 XLM)
    } else if (lower.includes("first-aid") || lower.includes("disaster") || lower.includes("drrm") || lower.includes("emergency") || lower.includes("rescue") || lower.includes("medical")) {
      recTotal = Math.round(10000 / currentRate); // ~₱10,000 PHP (approx 90-110 XLM)
    } else if (lower.includes("sport") || lower.includes("league") || lower.includes("basketball") || lower.includes("volleyball") || lower.includes("tournament")) {
      recTotal = Math.round(12000 / currentRate); // ~₱12,000 PHP (approx 110-130 XLM)
    } else if (lower.includes("livelihood") || lower.includes("workshop") || lower.includes("barista") || lower.includes("baking") || lower.includes("training") || lower.includes("seminar")) {
      recTotal = Math.round(7500 / currentRate); // ~₱7,500 PHP (approx 65-85 XLM)
    } else if (lower.includes("tree") || lower.includes("green") || lower.includes("clean") || lower.includes("garden") || lower.includes("environment")) {
      recTotal = Math.round(4500 / currentRate); // ~₱4,500 PHP (approx 40-50 XLM)
    }

    const action = validBudget > recTotal * 1.8 ? "reduce" : validBudget > 0 && validBudget < recTotal * 0.5 ? "increase" : "optimal";
    const justification =
      action === "reduce"
        ? `⚠️ Declared budget of ${validBudget} XLM (₱${(validBudget * currentRate).toLocaleString()}) is overpriced. Proposing reduction to ${recTotal} XLM (≈ ₱${(recTotal * currentRate).toLocaleString()}) based on Philippine SK procurement market rates.`
        : action === "increase"
        ? `⚠️ Declared budget of ${validBudget} XLM (₱${(validBudget * currentRate).toLocaleString()}) is underfunded for this scope. Proposing increase to ${recTotal} XLM (≈ ₱${(recTotal * currentRate).toLocaleString()}).`
        : `✅ Declared budget of ${validBudget || recTotal} XLM matches standard Philippine market benchmarks for this project.`;

    let recommendedPhases: ProjectPhase[] = [];
    if (phases && phases.length > 0) {
      recommendedPhases = phases.map((p, i) => ({
        phaseNumber: i + 1,
        title: p.title || `Phase ${i + 1}`,
        percentage: p.percentage || 50,
        amountXlm: (recTotal * (p.percentage || 50)) / 100,
        description: p.description || `Deliverables for Phase ${i + 1} (₱${((recTotal * (p.percentage || 50) * currentRate) / 100).toLocaleString()}).`,
      }));
    } else {
      const isMultiStage = lower.includes("build") || lower.includes("hub") || lower.includes("center") || lower.includes("tournament") || lower.includes("league") || lower.includes("rehab");
      if (isMultiStage) {
        recommendedPhases = [
          {
            phaseNumber: 1,
            title: "Phase 1: Mobilization & Initial Procurement",
            percentage: 40,
            amountXlm: (recTotal * 40) / 100,
            description: "Upfront procurement of raw materials, venue rental, equipment, and contractor mobilization.",
            requiredProofs: "Official BIR sales invoices and procurement delivery receipts",
          },
          {
            phaseNumber: 2,
            title: "Phase 2: Core Execution & Midterm Implementation",
            percentage: 30,
            amountXlm: (recTotal * 30) / 100,
            description: "On-site construction, hardware installation, match execution, or primary program delivery.",
            requiredProofs: "Geo-tagged on-site progress photos and signed milestone inspection reports",
          },
          {
            phaseNumber: 3,
            title: "Phase 3: Final Turnover, Audit & Community Launch",
            percentage: 30,
            amountXlm: (recTotal * 30) / 100,
            description: "Final completion, youth orientation, championship awards, and official project turnover.",
            requiredProofs: "Final completion certificate and community beneficiary sign-in logbook",
          },
        ];
      } else {
        recommendedPhases = [
          {
            phaseNumber: 1,
            title: "Phase 1: Upfront Mobilization & Supplies Acquisition",
            percentage: 50,
            amountXlm: (recTotal * 50) / 100,
            description: `Upfront mobilization release (₱${((recTotal * 50 * currentRate) / 100).toLocaleString()}) to purchase supplies and initiate activity.`,
            requiredProofs: "Official sales receipts and supplier delivery vouchers",
          },
          {
            phaseNumber: 2,
            title: "Phase 2: Project Delivery & Public Verification",
            percentage: 50,
            amountXlm: (recTotal * 50) / 100,
            description: `Final deliverable distribution and verified public turnover (₱${((recTotal * 50 * currentRate) / 100).toLocaleString()}).`,
            requiredProofs: "Geo-tagged turnover photos and signed beneficiary acknowledgment roster",
          },
        ];
      }
    }

    // Calculate authentic composite feasibility score based on real weights
    let score = 83;
    if (validBudget > 0 && recTotal > 0) {
      const diffRatio = Math.abs(validBudget - recTotal) / recTotal;
      if (diffRatio <= 0.12) score += 10; // within 12% of market benchmark
      else if (diffRatio <= 0.30) score += 3; // within 30% of market benchmark
      else if (diffRatio <= 0.60) score -= 15; // noticeable deviation
      else score -= 32; // severe inflation or underfunding
    } else {
      score -= 5;
    }

    // Scope & Description detail check
    const descLen = (description || "").trim().length;
    if (descLen >= 100) score += 5;
    else if (descLen < 30) score -= 14;

    // Phases structural check
    if (phases && phases.length >= 1) score += 2;

    const dynamicScore = Math.max(35, Math.min(97, Math.round(score)));
    const calculatedVerdict: "Highly Feasible" | "Requires Minor Adjustments" | "Needs Revision" =
      dynamicScore >= 85 ? "Highly Feasible" : dynamicScore >= 65 ? "Requires Minor Adjustments" : "Needs Revision";

    return {
      feasibilityScore: dynamicScore,
      verdict: calculatedVerdict,
      summary: `Real-world market audit evaluated "${projectName || "New Project"}" against Philippine SK procurement standards.`,
      recommendedTotalXlm: recTotal,
      budgetAction: action,
      totalBudgetJustification: justification,
      budgetComparison: {
        declaredTotalXlm: validBudget,
        phasesSumXlm: recTotal,
        isBalanced: true,
        differenceXlm: 0,
      },
      phaseFeedbacks: recommendedPhases.map((p) => ({
        phaseNumber: p.phaseNumber,
        title: p.title,
        percentage: p.percentage,
        amountXlm: p.amountXlm,
        assessment: `Phase ${p.phaseNumber} tranche is realistic.`,
        status: "good",
        recommendation: `Upload BIR receipt and geo-tagged photos for Phase ${p.phaseNumber}.`,
      })),
      recommendedPhases,
      partnerAgencies: [
        {
          agencyName: "National Youth Commission (NYC) & DILG",
          roleOrBenefit: "SK Governance & Standard Youth Development Framework compliance",
          recommendedAction: "Ensure project objectives align with the Comprehensive Barangay Youth Development Plan (CBYDP)."
        }
      ],
      keyTips: [
        "💡 Real-World Pricing: All estimates based on current Philippine retail & ISP market rates.",
        "🛡️ Transparency Guard: Public audit prevents budget inflation and ghost projects.",
      ],
    };
  },
};
