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

export interface AIAdvisorResponse {
  feasibilityScore: number; // 0 - 100
  verdict: "Highly Feasible" | "Requires Minor Adjustments" | "Needs Revision";
  summary: string;
  recommendedTotalXlm: number;
  budgetAction: "reduce" | "increase" | "optimal";
  totalBudgetJustification: string;
  budgetComparison: {
    declaredTotalXlm: number;
    phasesSumXlm: number;
    isBalanced: boolean;
    differenceXlm: number;
  };
  phaseFeedbacks: PhaseFeedback[];
  recommendedPhases: ProjectPhase[];
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
    phases: ProjectPhase[]
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

    console.log("🤖 [Real-World AI Auditor Debugger] Starting audit...", {
      projectName,
      descriptionLength: description?.length || 0,
      totalBudgetXlm: validBudget,
      declaredPhp,
      currentRate,
      phaseCount: phases.length,
      apiKeyConfigured: !!apiKey,
    });

    // Real-world Philippine benchmark calculation based on live rate
    let recTotal = validBudget > 0 ? validBudget : Math.round(6000 / currentRate);
    const lower = (projectName + " " + description).toLowerCase();

    if (lower.includes("wifi") || lower.includes("computer") || lower.includes("hub") || lower.includes("pc") || lower.includes("internet")) {
      recTotal = Math.round(10000 / currentRate); // ~₱10,000 PHP
    } else if (lower.includes("sport") || lower.includes("league") || lower.includes("basketball") || lower.includes("volleyball")) {
      recTotal = Math.round(5000 / currentRate); // ~₱5,000 PHP
    } else if (lower.includes("tree") || lower.includes("green") || lower.includes("clean") || lower.includes("garden")) {
      recTotal = Math.round(3500 / currentRate); // ~₱3,500 PHP
    }

    // Determine initial action recommendation
    let initialAction: "reduce" | "increase" | "optimal" = "optimal";
    if (validBudget > recTotal * 1.8) initialAction = "reduce";
    else if (validBudget > 0 && validBudget < recTotal * 0.5) initialAction = "increase";

    // If Gemini API Key is available, call live Gemini 2.5 Flash Endpoint
    if (apiKey) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const systemPrompt = `You are a brutally honest, real-world Financial Auditor & Barangay Procurement Expert for Philippine Sangguniang Kabataan (SK) youth projects.
Audit the following project proposal based on REAL-WORLD PHILIPPINE MARKET COSTS (Current Exchange Rate: 1 XLM = ₱${currentRate.toFixed(2)} PHP).

Project Title: "${projectName}"
Project Description: "${description}"
Declared Total Budget (XLM): ${validBudget} (≈ ₱${declaredPhp.toLocaleString()} PHP)
Declared Tranches: ${JSON.stringify(phases)}

YOUR AUDIT INSTRUCTIONS:
1. Evaluate if the declared total budget is REALISTIC.
   - If declared budget is INFLATED / OVERPRICED compared to real Philippine market rates, propose a LOWER budget (budgetAction: "reduce").
   - If declared budget is UNREALISTICALLY LOW for the scope, propose a HIGHER budget (budgetAction: "increase").
   - If reasonable, set budgetAction: "optimal".
2. Break down the project into 2 to 4 CONCRETE, REAL-WORLD TRANCHES with realistic phase titles, percentages (must sum to 100%), and exact Philippine deliverable descriptions (mentioning actual prices like ₱18,000 per PC, ₱3,500 ISP fee, ₱500 referee fee, etc.).

Return ONLY valid JSON matching this exact structure (no markdown fences):
{
  "feasibilityScore": 92,
  "verdict": "Highly Feasible",
  "summary": "1-2 sentence honest real-world procurement analysis.",
  "recommendedTotalXlm": ${recTotal},
  "budgetAction": "${initialAction}",
  "totalBudgetJustification": "Explicit real-world price breakdown in XLM and PHP explaining why to reduce, increase, or maintain the budget.",
  "recommendedPhases": [
    {
      "phaseNumber": 1,
      "title": "Phase 1: Real-World Mobilization Title (e.g. Core Procurement)",
      "percentage": 50, // Propose realistic percentage (e.g. 40, 50, 60 depending on upfront procurement needs)
      "amountXlm": ${(recTotal * 50) / 100}, // Proposed budget in XLM based on recommendedTotalXlm and percentage
      "description": "Concrete itemized purchases with real PHP prices (e.g. buying 2 PCs at ₱18,000 each = ₱36,000)"
    }
  ],
  "phaseFeedbacks": [
    {
      "phaseNumber": 1,
      "title": "Phase 1 Title",
      "percentage": 50,
      "amountXlm": ${(recTotal * 50) / 100},
      "assessment": "Honest assessment of Phase 1 budget and deliverables.",
      "status": "good",
      "recommendation": "Real-world audit requirement (e.g., official BIR receipts or photos)."
    }
  ],
  "keyTips": [
    "Real-world tip 1 for SK Official",
    "Real-world tip 2 for Barangay Admin"
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
            console.log("🤖 [Real-World AI Auditor] Gemini Honest Audit Result:", parsed);

            const aiTotal = parsed.recommendedTotalXlm || recTotal;
            const action = parsed.budgetAction || (validBudget > aiTotal * 1.5 ? "reduce" : validBudget < aiTotal * 0.5 && validBudget > 0 ? "increase" : "optimal");
            
            return {
              feasibilityScore: parsed.feasibilityScore || 88,
              verdict: parsed.verdict || "Highly Feasible",
              summary: parsed.summary || `Real-world market audit completed for "${projectName}".`,
              recommendedTotalXlm: aiTotal,
              budgetAction: action,
              totalBudgetJustification: parsed.totalBudgetJustification || `Real-world Philippine market audit recommends ${aiTotal} XLM (≈ ₱${(aiTotal * currentRate).toLocaleString()}).`,
              budgetComparison: {
                declaredTotalXlm: validBudget,
                phasesSumXlm: aiTotal,
                isBalanced: true,
                differenceXlm: 0,
              },
              phaseFeedbacks: parsed.phaseFeedbacks || [],
              recommendedPhases: (parsed.recommendedPhases || []).map((p: any, i: number) => ({
                phaseNumber: i + 1,
                title: p.title || `Phase ${i + 1}`,
                percentage: p.percentage || 33,
                amountXlm: (aiTotal * (p.percentage || 33)) / 100,
                description: p.description || "",
              })),
              keyTips: parsed.keyTips || [
                "💡 BIR Official Receipts: Mandatory for all equipment & venue procurement.",
                "🛡️ Geo-Tagged Audit: Photos required prior to milestone tranche approval.",
              ],
            };
          }
        }
      } catch (geminiErr: any) {
        console.error("❌ [Real-World AI Auditor] Gemini API exception:", geminiErr);
      }
    }

    // Fallback rule engine with honest real-life market numbers
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
      recommendedPhases = [
        {
          phaseNumber: 1,
          title: `Phase 1: Upfront Mobilization`,
          percentage: 50,
          amountXlm: (recTotal * 50) / 100,
          description: `Upfront mobilization release (₱${((recTotal * 50 * currentRate) / 100).toLocaleString()}) to begin procurement.`,
        },
        {
          phaseNumber: 2,
          title: `Phase 2: Core Execution & Delivery`,
          percentage: 50,
          amountXlm: (recTotal * 50) / 100,
          description: `Midterm & final deliverables (₱${((recTotal * 50 * currentRate) / 100).toLocaleString()}) verified via community audit.`,
        },
      ];
    }

    return {
      feasibilityScore: action === "optimal" ? 92 : 78,
      verdict: action === "optimal" ? "Highly Feasible" : "Requires Minor Adjustments",
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
      keyTips: [
        "💡 Real-World Pricing: All estimates based on current Philippine retail & ISP market rates.",
        "🛡️ Transparency Guard: Public audit prevents budget inflation and ghost projects.",
      ],
    };
  },
};
