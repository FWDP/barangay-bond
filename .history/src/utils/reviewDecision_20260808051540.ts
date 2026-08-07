export type ResubmissionFieldKey =
    | "idPhotoUrl"
    | "selfiePhotoUrl"
    | "profilePhotoUrl"
    | "idNumber"
    | "name"
    | "address"
    | "barangayProof"
    | "other";

export type ResubmissionPresetKey = "photo_only" | "details_only" | "full_package" | "custom";

export interface ResubmissionFieldOption {
    key: ResubmissionFieldKey;
    label: string;
    suggestedReason: string;
    keywords: string[];
}

export interface ResubmissionPresetOption {
    key: ResubmissionPresetKey;
    label: string;
    description: string;
    fieldKeys: ResubmissionFieldKey[];
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

export const RESUBMISSION_PRESETS: ResubmissionPresetOption[] = [
    {
        key: "photo_only",
        label: "Photo only",
        description: "Only re-upload the flagged photo evidence.",
        fieldKeys: ["idPhotoUrl", "selfiePhotoUrl", "profilePhotoUrl"],
        suggestedReason: "Please re-upload clearer identity photos for the flagged photo evidence.",
        keywords: ["blurred id", "blurred selfie", "photo only", "image quality", "unreadable", "low quality", "face not detected"],
    },
    {
        key: "details_only",
        label: "Details only",
        description: "Correct identity details without redoing the photo set.",
        fieldKeys: ["name", "idNumber", "address"],
        suggestedReason: "Please correct the identity details so they match your submitted records.",
        keywords: ["name mismatch", "id number", "address mismatch", "details only", "spelling", "incomplete address"],
    },
    {
        key: "full_package",
        label: "Full package",
        description: "Update both photos and details, but not email verification.",
        fieldKeys: ["idPhotoUrl", "selfiePhotoUrl", "profilePhotoUrl", "name", "idNumber", "address"],
        suggestedReason: "Please resubmit the full profile details and documents. Email verification is not required.",
        keywords: ["duplicate", "tamper", "authenticity", "full package", "full resubmission", "mismatch", "manual review"],
    },
    {
        key: "custom",
        label: "Custom",
        description: "Let the admin hand-pick only the fields to resubmit.",
        fieldKeys: [],
        suggestedReason: "Please resubmit the specifically flagged fields.",
        keywords: [],
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

export const inferResubmissionPreset = (text: string | undefined): ResubmissionPresetKey => {
    const normalized = normalizeText(text || "");

    if (normalized.includes("duplicate") || normalized.includes("tamper") || normalized.includes("authenticity") || normalized.includes("full profile")) {
        return "full_package";
    }

    if (normalized.includes("name") || normalized.includes("address") || normalized.includes("id number") || normalized.includes("details")) {
        return "details_only";
    }

    if (normalized.includes("photo") || normalized.includes("id") || normalized.includes("selfie") || normalized.includes("image") || normalized.includes("blurred")) {
        return "photo_only";
    }

    return "custom";
};

export const getResubmissionFieldsForPreset = (preset: ResubmissionPresetKey, fallback: ResubmissionFieldKey[] = []): ResubmissionFieldKey[] => {
    const presetOption = RESUBMISSION_PRESETS.find((option) => option.key === preset);
    if (!presetOption) return fallback;
    if (presetOption.key === "custom") return fallback;
    return presetOption.fieldKeys;
};

export const getResubmissionPresetLabel = (preset: ResubmissionPresetKey): string => {
    return RESUBMISSION_PRESETS.find((option) => option.key === preset)?.label || preset;
};

export const getResubmissionPresetDescription = (preset: ResubmissionPresetKey): string => {
    return RESUBMISSION_PRESETS.find((option) => option.key === preset)?.description || "";
};

export const getResubmissionSuggestedReasonForPreset = (
    preset: ResubmissionPresetKey,
    fieldKeys: ResubmissionFieldKey[] = []
): string => {
    if (preset === "custom") {
        return getResubmissionSuggestedReason(fieldKeys);
    }

    return RESUBMISSION_PRESETS.find((option) => option.key === preset)?.suggestedReason || getResubmissionSuggestedReason(fieldKeys);
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
