import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { logger } from "../utils/logger";
import { normalizeName, normalizeAddress } from "../utils/normalization";

export type VerificationRecommendation = "AUTO_ACCEPT" | "MANUAL_REVIEW" | "AUTO_REJECT";

export interface IdentityVerificationRequest {
  name: string;
  birthdate: string;
  address: string;
  barangayName: string;
  municipality: string;
  province: string;
  idType: string;
  idNumber: string;
  schoolName?: string;
  imageDataUrl: string; // Base64 data URL
}

export interface FieldMatchResult {
  status: "PASS" | "WARNING" | "FAIL";
  originalValue: string;
  extractedValue: string;
  confidence: number;
}

export interface IdentityVerificationResult {
  documentType: string;
  confidence: number;
  imageQuality: {
    blurry: boolean;
    cropped: boolean;
    rotated: boolean;
    glare: boolean;
    lowResolution: boolean;
    partiallyHidden: boolean;
    readable: boolean;
  };
  extractedFields: {
    name: string;
    birthdate: string;
    address: string;
    idNumber: string;
    barangay: string;
    municipality: string;
    province: string;
    schoolName?: string;
    studentNumber?: string;
    expiryDate?: string;
  };
  fieldMatches: {
    name: FieldMatchResult;
    birthdate: FieldMatchResult;
    address: FieldMatchResult;
    barangay: FieldMatchResult;
    idNumber: FieldMatchResult;
  };
  riskScore: number;
  recommendation: VerificationRecommendation;
  reasons: string[];
  faceDetected: boolean;
  tamperingDetected: boolean;
  screenshotDetected: boolean;
  aiGeneratedDetected: boolean;
  decision?: "AUTO_APPROVE" | "PASS" | "MANUAL_REVIEW" | "HIGH_RISK" | "AUTO_REJECT";
  scores?: {
    overallScore: number;
    nameMatch: number;
    birthdateMatch: number;
    idNumberMatch: number;
    barangayMatch: number;
    municipalityMatch: number;
    provinceMatch: number;
    imageQuality: number;
    documentAuthenticity: number;
    duplicateRisk: number;
  };
}

export interface DuplicateMatch {
  userId: string;
  name: string;
  similarity: number;
  matchedFields: string[];
}

export interface AIIdentityProvider {
  analyzeIdentity(input: IdentityVerificationRequest): Promise<IdentityVerificationResult>;
}

/**
 * Text normalizer to drop Brgy. formatting and accents
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/\bbrgy\.?\b/g, "barangay")
    .replace(/\bsto\.?\b/g, "santo")
    .replace(/\bst\.?\b/g, "street")
    .replace(/\brd\.?\b/g, "road")
    .replace(/\bave\.?\b/g, "avenue")
    .replace(/\bblvd\.?\b/g, "boulevard")
    .replace(/\bsitio\.?\b/g, "sitio")
    .replace(/\bpurok\.?\b/g, "purok")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "");
}

/**
 * Levenshtein distance similarity calculation (0 - 100)
 */
export function getFuzzySimilarity(s1: string, s2: string): number {
  const m1 = normalizeText(s1);
  const m2 = normalizeText(s2);
  if (m1 === m2) return 100;
  if (m1.length === 0 || m2.length === 0) return 0;

  const track = Array(m2.length + 1).fill(null).map(() => Array(m1.length + 1).fill(null));
  for (let i = 0; i <= m1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= m2.length; j += 1) track[j][0] = j;
  
  for (let j = 1; j <= m2.length; j += 1) {
    for (let i = 1; i <= m1.length; i += 1) {
      const indicator = m1[i - 1] === m2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j - 1][i] + 1, // deletion
        track[j][i - 1] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  const distance = track[m2.length][m1.length];
  const maxLength = Math.max(m1.length, m2.length);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

/**
 * Weighted duplicate check across existing Firestore users
 */
export async function checkDuplicates(
  name: string,
  birthdate: string,
  idNumber: string,
  address: string,
  mobileNumber: string,
  excludeUid?: string
): Promise<{ maxScore: number; matches: DuplicateMatch[] }> {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    let maxScore = 0;
    const matches: DuplicateMatch[] = [];

    snapshot.forEach((docSnapshot) => {
      if (excludeUid && docSnapshot.id === excludeUid) {
        return;
      }
      const u = docSnapshot.data();
      // Exclude matches with missing fields
      const dbName = u.name || "";
      const dbBirthdate = u.birthdate || "";
      const dbIdNumber = u.idNumber || "";
      const dbAddress = u.address || "";
      const dbMobile = u.mobileNumber || "";

      const nameSim = getFuzzySimilarity(name, dbName);
      const bdateMatch = birthdate === dbBirthdate ? 100 : 0;
      const idMatch = idNumber && dbIdNumber && idNumber.trim().toLowerCase() === dbIdNumber.trim().toLowerCase() ? 100 : 0;
      const addrSim = getFuzzySimilarity(address, dbAddress);
      const mobileMatch = mobileNumber && dbMobile && mobileNumber.trim() === dbMobile.trim() ? 100 : 0;

      const score = Math.round(
        (nameSim * 0.35) +
        (bdateMatch * 0.25) +
        (idMatch * 0.25) +
        (addrSim * 0.10) +
        (mobileMatch * 0.05)
      );

      if (score >= 40) {
        const matchedFields: string[] = [];
        if (nameSim >= 80) matchedFields.push("Name");
        if (bdateMatch === 100) matchedFields.push("Birthdate");
        if (idMatch === 100) matchedFields.push("ID Number");
        if (addrSim >= 80) matchedFields.push("Address");
        if (mobileMatch === 100) matchedFields.push("Mobile");

        matches.push({
          userId: docSnapshot.id,
          name: dbName,
          similarity: score,
          matchedFields
        });
        if (score > maxScore) {
          maxScore = score;
        }
      }
    });

    return { maxScore, matches };
  } catch (err) {
    console.error("Duplicate search failed:", err);
    return { maxScore: 0, matches: [] };
  }
}

/**
 * Gemini Vision API provider implementation
 */
export class GeminiIdentityProvider implements AIIdentityProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  }

  async analyzeIdentity(input: IdentityVerificationRequest): Promise<IdentityVerificationResult> {
    if (!this.apiKey) {
      logger.error("VITE_GEMINI_API_KEY is not configured.", "GEMINI");
      throw new Error("VITE_GEMINI_API_KEY is not configured.");
    }

    const correlationId = `AI-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const startTime = Date.now();

    // Strip base64 headers if present
    const base64Data = input.imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const approxBytes = Math.round((base64Data.length * 3) / 4);

    logger.ai(`Gemini ID analysis request started. Image size: ${(approxBytes / 1024).toFixed(1)} KB`, "GEMINI", {
      correlationId,
      metadata: { name: input.name, idType: input.idType, idNumber: input.idNumber }
    });

    const promptText = `
You are a government-grade identity verification system assisting Barangay Admins.
Analyze the uploaded document image and compare it with the following input registration details:
- Full Name: ${input.name}
- Birthdate: ${input.birthdate}
- Address: ${input.address}
- Barangay Name: ${input.barangayName}
- Municipality: ${input.municipality}
- Province: ${input.province}
- Document ID Type: ${input.idType}
- Document ID Number: ${input.idNumber}
${input.schoolName ? `- School / University Name: ${input.schoolName}` : ""}

Evaluate the document and return a JSON object conforming exactly to this structure:
{
  "documentType": "Detected document type (e.g. Barangay ID, Passport)",
  "confidence": 0-100 overall confidence number,
  "imageQuality": {
    "blurry": true/false,
    "cropped": true/false,
    "rotated": true/false,
    "glare": true/false,
    "lowResolution": true/false,
    "partiallyHidden": true/false,
    "readable": true/false
  },
  "extractedFields": {
    "name": "extracted name text",
    "birthdate": "extracted birthdate (YYYY-MM-DD)",
    "address": "extracted complete address",
    "idNumber": "extracted ID number",
    "barangay": "extracted barangay name",
    "municipality": "extracted municipality",
    "province": "extracted province",
    "schoolName": "extracted school name if visible",
    "studentNumber": "extracted student ID if visible",
    "expiryDate": "extracted expiry if visible"
  },
  "fieldMatches": {
    "name": {
      "status": "PASS/WARNING/FAIL",
      "originalValue": "${input.name}",
      "extractedValue": "extracted name text",
      "confidence": 0-100 field level OCR confidence
    },
    "birthdate": {
      "status": "PASS/WARNING/FAIL",
      "originalValue": "${input.birthdate}",
      "extractedValue": "extracted birthdate text",
      "confidence": 0-100
    },
    "address": {
      "status": "PASS/WARNING/FAIL",
      "originalValue": "${input.address}",
      "extractedValue": "extracted address text",
      "confidence": 0-100
    },
    "barangay": {
      "status": "PASS/WARNING/FAIL",
      "originalValue": "${input.barangayName}",
      "extractedValue": "extracted barangay text",
      "confidence": 0-100
    },
    "idNumber": {
      "status": "PASS/WARNING/FAIL",
      "originalValue": "${input.idNumber}",
      "extractedValue": "extracted ID number text",
      "confidence": 0-100
    }
  },
  "riskScore": 0-100,
  "recommendation": "AUTO_ACCEPT" or "MANUAL_REVIEW" or "AUTO_REJECT",
  "reasons": ["List of risk indicators or mismatch summaries"],
  "faceDetected": true/false,
  "tamperingDetected": true/false,
  "screenshotDetected": true/false,
  "aiGeneratedDetected": true/false
}

Guidelines:
1. "AUTO_ACCEPT" requires confidence >= 99%, riskScore = 0, face detected, clear and readable government/student ID, and matches all registration fields (PASS).
2. "AUTO_REJECT" triggers if ID not found, unreadable, screenshot detected, face completely missing, or extreme tampering.
3. Compare fields fuzzily (ignoring case, minor spelling differences or 'Brgy' prefixes). Highlight mismatches as WARNING or FAIL.
`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;
    logger.network(`POST ${endpoint.replace(/key=([^&]+)/, "key=***")}`, "GEMINI", { correlationId });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        logger.error(`Gemini POST request failed with HTTP status: ${response.status}`, "GEMINI", {
          correlationId,
          durationMs: Date.now() - startTime
        });
        throw new Error(`Gemini API request failed with status: ${response.status}`);
      }

      const resJson = await response.json();
      const textOutput = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) {
        logger.error("Empty response text from Gemini Vision endpoint.", "GEMINI", { correlationId });
        throw new Error("Empty response received from Gemini model.");
      }

      const parsedResult: IdentityVerificationResult = JSON.parse(textOutput);

      // Programmatic Identity Cross-Validation & Scoring
      let nameScore = 0;
      let nameStatus: "PASS" | "WARNING" | "FAIL" = "FAIL";

      const regName = normalizeName(input.name);
      const extName = normalizeName(parsedResult.extractedFields.name || "");
      
      const nameFuzzy = getFuzzySimilarity(regName, extName);

      if (regName.toLowerCase() === extName.toLowerCase()) {
        nameScore = 25;
        nameStatus = "PASS";
      } else {
        // Check for missing middle name
        const regWords = regName.toLowerCase().split(/\s+/);
        const extWords = extName.toLowerCase().split(/\s+/);
        
        const hasFirstAndLastMatch = regWords.length > 1 && extWords.length > 0 &&
          extWords.includes(regWords[0]) && extWords.includes(regWords[regWords.length - 1]);
        
        if (hasFirstAndLastMatch && Math.abs(regWords.length - extWords.length) === 1) {
          nameScore = 22;
          nameStatus = "WARNING";
        } else if (nameFuzzy >= 80) {
          nameScore = 18;
          nameStatus = "WARNING";
        } else {
          nameScore = 0;
          nameStatus = "FAIL";
        }
      }

      // Birthdate scoring (20%)
      let bdateScore = 0;
      let bdateStatus: "PASS" | "WARNING" | "FAIL" = "FAIL";
      const regBdate = input.birthdate;
      const extBdate = parsedResult.extractedFields.birthdate || "";
      if (regBdate === extBdate) {
        bdateScore = 20;
        bdateStatus = "PASS";
      } else {
        bdateScore = 0;
        bdateStatus = "FAIL";
      }

      // Address scoring (20%)
      let addrScore = 0;
      let addrStatus: "PASS" | "WARNING" | "FAIL" = "FAIL";
      const regAddr = normalizeAddress(input.address);
      const extAddr = normalizeAddress(parsedResult.extractedFields.address || "");
      const addrFuzzy = getFuzzySimilarity(regAddr, extAddr);

      if (regAddr.toLowerCase() === extAddr.toLowerCase()) {
        addrScore = 20;
        addrStatus = "PASS";
      } else if (addrFuzzy >= 60) {
        addrScore = 15;
        addrStatus = "WARNING";
      } else {
        addrScore = 0;
        addrStatus = "FAIL";
      }

      // Barangay scoring (15%)
      let bgyScore = 0;
      let bgyStatus: "PASS" | "WARNING" | "FAIL" = "FAIL";
      const regBgy = normalizeAddress(input.barangayName);
      const extBgy = normalizeAddress(parsedResult.extractedFields.barangay || "");
      const bgyFuzzy = getFuzzySimilarity(regBgy, extBgy);
      
      if (regBgy.toLowerCase() === extBgy.toLowerCase() || bgyFuzzy >= 80) {
        bgyScore = 15;
        bgyStatus = "PASS";
      } else if (extBgy === "") {
        // No Barangay Found
        bgyScore = 5;
        bgyStatus = "WARNING";
      } else {
        bgyScore = 0;
        bgyStatus = "FAIL";
      }

      // Document Number scoring (10%)
      let docScore = 0;
      let docStatus: "PASS" | "WARNING" | "FAIL" = "FAIL";
      const regDocNum = input.idNumber.replace(/\s+/g, "").toLowerCase();
      const extDocNum = (parsedResult.extractedFields.idNumber || "").replace(/\s+/g, "").toLowerCase();
      if (regDocNum === extDocNum && regDocNum !== "") {
        docScore = 10;
        docStatus = "PASS";
      } else {
        docScore = 0;
        docStatus = "FAIL";
      }

      // School Info scoring (5%)
      let schoolScore = 0;
      if (input.idType === "student") {
        const regSchool = normalizeAddress(input.schoolName || "");
        const extSchool = normalizeAddress(parsedResult.extractedFields.schoolName || "");
        const schoolFuzzy = getFuzzySimilarity(regSchool, extSchool);
        if (regSchool.toLowerCase() === extSchool.toLowerCase() || schoolFuzzy >= 70) {
          schoolScore = 5;
        } else {
          schoolScore = 0;
        }
      } else {
        schoolScore = 5;
      }

      // Photo Quality scoring (5%)
      let photoScore = 0;
      const isReadable = parsedResult.imageQuality.readable;
      const isBlurry = parsedResult.imageQuality.blurry;
      if (isReadable && !isBlurry) {
        photoScore = 5;
      } else if (isReadable && isBlurry) {
        photoScore = 2;
      } else {
        photoScore = 0;
      }

      // Final Programmatic Confidence calculation
      const calculatedConfidence = nameScore + bdateScore + addrScore + bgyScore + docScore + schoolScore + photoScore;

      // Update parsedResult properties
      parsedResult.confidence = calculatedConfidence;
      parsedResult.riskScore = 100 - calculatedConfidence;

      const regMuni = input.municipality.toLowerCase();
      const extMuni = (parsedResult.extractedFields.municipality || "").toLowerCase();
      const muniScore = regMuni && extMuni && (extMuni.includes(regMuni) || regMuni.includes(extMuni)) ? 100 : 0;

      const regProv = input.province.toLowerCase();
      const extProv = (parsedResult.extractedFields.province || "").toLowerCase();
      const provScore = regProv && extProv && (extProv.includes(regProv) || regProv.includes(extProv)) ? 100 : 0;

      const docAuthenticity = (parsedResult.tamperingDetected || parsedResult.screenshotDetected || parsedResult.aiGeneratedDetected) ? 0 : 100;

      let decision: "AUTO_APPROVE" | "PASS" | "MANUAL_REVIEW" | "HIGH_RISK" | "AUTO_REJECT" = "MANUAL_REVIEW";
      if (calculatedConfidence === 100) {
        decision = "AUTO_APPROVE";
      } else if (calculatedConfidence >= 95 && calculatedConfidence <= 99) {
        decision = "PASS";
      } else if (calculatedConfidence >= 80 && calculatedConfidence <= 94) {
        decision = "MANUAL_REVIEW";
      } else if (calculatedConfidence >= 60 && calculatedConfidence <= 79) {
        decision = "HIGH_RISK";
      } else {
        decision = "AUTO_REJECT";
      }

      parsedResult.decision = decision;
      parsedResult.scores = {
        overallScore: calculatedConfidence,
        nameMatch: Math.round((nameScore / 25) * 100),
        birthdateMatch: Math.round((bdateScore / 20) * 100),
        idNumberMatch: Math.round((docScore / 25) * 100),
        barangayMatch: Math.round((bgyScore / 10) * 100),
        municipalityMatch: muniScore,
        provinceMatch: provScore,
        imageQuality: Math.round((photoScore / 5) * 100),
        documentAuthenticity: docAuthenticity,
        duplicateRisk: 100
      };

      // Re-evaluate Recommendation based on score matrix:
      if (calculatedConfidence === 100) {
        parsedResult.recommendation = "AUTO_ACCEPT"; // Ready for administrative approval
      } else if (calculatedConfidence >= 80 && calculatedConfidence <= 99) {
        parsedResult.recommendation = "MANUAL_REVIEW"; // Administrative review recommended
      } else if (calculatedConfidence >= 40 && calculatedConfidence <= 79) {
        parsedResult.recommendation = "MANUAL_REVIEW"; // Manual investigation required
      } else if (calculatedConfidence >= 1 && calculatedConfidence <= 39) {
        parsedResult.recommendation = "MANUAL_REVIEW"; // Strongly recommend rejection
      } else {
        parsedResult.recommendation = "AUTO_REJECT"; // Auto-reject
      }

      // Map programmatic statuses to fieldMatches object
      parsedResult.fieldMatches = {
        name: {
          status: nameStatus,
          originalValue: input.name,
          extractedValue: parsedResult.extractedFields.name || "N/A",
          confidence: nameFuzzy
        },
        birthdate: {
          status: bdateStatus,
          originalValue: input.birthdate,
          extractedValue: parsedResult.extractedFields.birthdate || "N/A",
          confidence: regBdate === extBdate ? 100 : 0
        },
        address: {
          status: addrStatus,
          originalValue: input.address,
          extractedValue: parsedResult.extractedFields.address || "N/A",
          confidence: addrFuzzy
        },
        barangay: {
          status: bgyStatus,
          originalValue: input.barangayName,
          extractedValue: parsedResult.extractedFields.barangay || "N/A",
          confidence: bgyFuzzy
        },
        idNumber: {
          status: docStatus,
          originalValue: input.idNumber,
          extractedValue: parsedResult.extractedFields.idNumber || "N/A",
          confidence: regDocNum === extDocNum ? 100 : 0
        }
      };

      logger.success(`Gemini ID analysis successfully processed. Calculated Score: ${parsedResult.confidence}/100. Decision: ${parsedResult.recommendation}`, "GEMINI", {
        correlationId,
        durationMs: Date.now() - startTime,
        metadata: {
          confidence: parsedResult.confidence,
          tampering: parsedResult.tamperingDetected,
          screenshot: parsedResult.screenshotDetected,
          extractedFields: parsedResult.extractedFields
        }
      });
      return parsedResult;
    } catch (parseError: any) {
      logger.error(`Gemini ID analysis failed during processing: ${parseError.message}`, "GEMINI", {
        correlationId,
        durationMs: Date.now() - startTime
      });
      throw parseError;
    }
  }
}
