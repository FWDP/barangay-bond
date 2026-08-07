export type ResubmissionFieldKey =
    | "idPhotoUrl"
    | "selfiePhotoUrl"
    | "profilePhotoUrl"
    | "idNumber"
    | "name"
    | "address"
    | "barangayProof"
    | "other";

export interface ResubmissionFieldOption {
    key: ResubmissionFieldKey;
    label: string;
    suggestedReason: string;
    keywords: string[];
}

export const RESUBMISSION_FIELD_OPTIONS: ResubmissionFieldOption[] = [
    {
        key: "idPhotoUrl",
        label: "Blurred or unreadable ID photo",
        suggestedReason: "Please upload a clearer copy of your government ID.",
        keywords: ["blurred id", "blurred id photo", "id unreadable", "id image", "government id", "document quality", "unclear id", "low quality id"],
    },
    {
        key: "selfiePhotoUrl",
        label: "Blurred selfie or holding-ID photo",
        suggestedReason: "Please re-upload a clearer selfie holding your ID.",
        keywords: ["blurred selfie", "selfie unclear", "selfie photo", "face not detected", "holding id", "selfie id"],
    },
    {
        key: "profilePhotoUrl",
        label: "Profile photo needs replacement",
        suggestedReason: "Please submit a clearer profile photo for identity matching.",
        keywords: ["profile photo", "avatar", "portrait", "photo mismatch"],
    },
    {
        key: "idNumber",
        label: "ID number mismatch or unreadable",
        suggestedReason: "Please correct the ID number and ensure it matches the document exactly.",
        keywords: ["id number", "id no", "id mismatch", "id number mismatch", "number unreadable"],
    },
    {
        key: "name",
        label: "Name mismatch",
        suggestedReason: "Please correct the name details to match your government ID.",
        keywords: ["name mismatch", "wrong name", "spelling", "first name", "last name"],
    },
    {
        key: "address",
        label: "Address mismatch or incomplete address",
        suggestedReason: "Please correct the residential address to match supporting records.",
        keywords: ["address mismatch", "incomplete address", "barangay address", "residential address"],
    },
    {
        key: "barangayProof",
        label: "Missing barangay residency proof",
        suggestedReason: "Please upload a document that proves residency in the barangay.",
        keywords: ["residency proof", "barangay proof", "utility bill", "proof of address"],
    },
    {
        key: "other",
        label: "Other documentary issue",
        suggestedReason: "Please correct the flagged issue and upload supporting details.",
        keywords: ["duplicate", "tamper", "authenticity", "mismatch", "other"],
    },
];

const normalizeText = (value: string) => value.toLowerCase();

export const inferResubmissionFields = (text: string | undefined, fallback: ResubmissionFieldKey[] = []): ResubmissionFieldKey[] => {
    const normalized = normalizeText(text || "");
    const matched = new Set<ResubmissionFieldKey>();

    RESUBMISSION_FIELD_OPTIONS.forEach((option) => {
        if (option.key === "other") return;
        if (option.key === "idPhotoUrl") {
            if (option.keywords.some((keyword) => normalized.includes(keyword))) matched.add(option.key);
        } else if (option.key === "selfiePhotoUrl") {
            if (option.keywords.some((keyword) => normalized.includes(keyword))) matched.add(option.key);
        } else if (option.key === "profilePhotoUrl") {
            if (option.keywords.some((keyword) => normalized.includes(keyword))) matched.add(option.key);
        } else if (option.key === "idNumber") {
            if (option.keywords.some((keyword) => normalized.includes(keyword))) matched.add(option.key);
        } else if (option.key === "name") {
            if (option.keywords.some((keyword) => normalized.includes(keyword))) matched.add(option.key);
        } else if (option.key === "address") {
            if (option.keywords.some((keyword) => normalized.includes(keyword))) matched.add(option.key);
        } else if (option.key === "barangayProof") {
            if (option.keywords.some((keyword) => normalized.includes(keyword))) matched.add(option.key);
        }
    });

    if (normalized.includes("duplicate") || normalized.includes("tamper") || normalized.includes("authenticity")) {
        matched.add("other");
    }

    if (matched.size === 0) {
        fallback.forEach((fieldKey) => matched.add(fieldKey));
    }

    return Array.from(matched);
};

export const getResubmissionFieldLabel = (fieldKey: ResubmissionFieldKey): string => {
    return RESUBMISSION_FIELD_OPTIONS.find((option) => option.key === fieldKey)?.label || fieldKey;
};

export const getResubmissionSuggestedReason = (fieldKeys: ResubmissionFieldKey[]): string => {
    if (fieldKeys.length === 0) return "Please review the flagged issue and resubmit the corrected details.";
    if (fieldKeys.length === 1) {
        return RESUBMISSION_FIELD_OPTIONS.find((option) => option.key === fieldKeys[0])?.suggestedReason || "Please resubmit the corrected detail.";
    }

    return fieldKeys
        .map((fieldKey) => RESUBMISSION_FIELD_OPTIONS.find((option) => option.key === fieldKey)?.suggestedReason)
        .filter(Boolean)
        .join(" ");
};
