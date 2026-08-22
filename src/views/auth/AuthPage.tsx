import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ErrorValidationModal } from "../../components/ErrorValidationModal";
import { Lock, ShieldCheck, Sun, Moon } from "lucide-react";
import { getResubmissionFieldLabel } from "../../utils/reviewDecision";
import type { ResubmissionFieldKey, ResubmissionPresetKey } from "../../utils/reviewDecision";

// Step views
import { LoginStep } from "./LoginStep";
import { RoleLGUStep } from "./RoleLGUStep";
import { DetailsStep } from "./DetailsStep";
import { AddInfoStep } from "./AddInfoStep";
import { UploadsStep } from "./UploadsStep";
import { SuccessStep } from "./SuccessStep";

type ViewState = "landing" | "auth" | "dashboard";

interface AuthEntryContext {
  preset: ResubmissionPresetKey;
  fields: ResubmissionFieldKey[];
  startStep?: number;
}

interface AuthPageProps {
  setViewState: (state: ViewState) => void;
  authEntryContext?: AuthEntryContext | null;
  setAuthEntryContext?: (val: AuthEntryContext | null) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ setViewState, authEntryContext, setAuthEntryContext }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [signUpStep, setSignUpStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [desiredRole, setDesiredRole] = useState<"resident" | "barangay_admin" | "system_admin">("resident");
  const [error, setError] = useState<string | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Identity Verification States
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState("barangay");
  const [idNumber, setIdNumber] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [professionalInfo, setProfessionalInfo] = useState("");
  const [adminReason, setAdminReason] = useState("");

  // Dynamic Barangay list state
  const [approvedBarangays, setApprovedBarangays] = useState<any[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [resRegion, setResRegion] = useState("");
  const [resProvince, setResProvince] = useState("");
  const [resMunicipality, setResMunicipality] = useState("");

  // Barangay Admin Requested Location State
  const [adminReqRegion, setAdminReqRegion] = useState("REGION IV-A (CALABARZON)");
  const [adminReqProvince, setAdminReqProvince] = useState("Cavite");
  const [adminReqMunicipality, setAdminReqMunicipality] = useState("Imus City");
  const [adminReqBarangayName, setAdminReqBarangayName] = useState("");

  // PSGC Cloud API live dataset state for Barangay Admin
  const [psgcRegions, setPsgcRegions] = useState<Array<{ code: string; name: string }>>([]);
  const [psgcProvinces, setPsgcProvinces] = useState<Array<{ code: string; name: string }>>([]);
  const [psgcMunicipalities, setPsgcMunicipalities] = useState<Array<{ code: string; name: string }>>([]);
  const [psgcBarangays, setPsgcBarangays] = useState<Array<{ code: string; name: string }>>([]);

  const [selectedPsgcRegionCode, setSelectedPsgcRegionCode] = useState("");
  const [selectedPsgcProvinceCode, setSelectedPsgcProvinceCode] = useState("");
  const [selectedPsgcMunicipalityCode, setSelectedPsgcMunicipalityCode] = useState("");
  const [psgcLoading, setPsgcLoading] = useState(false);

  const [idPhoto, setIdPhoto] = useState("");
  const [selfiePhoto, setSelfiePhoto] = useState("N/A");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [initialPrefillDone, setInitialPrefillDone] = useState(false);

  const { signIn, signUp, signUpEmailPassword, getApprovedBarangays, user, profile, executeAIVerification, signOut, authError, clearAuthError } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const resubmissionMode = Boolean(authEntryContext);
  const resubmissionPreset = (authEntryContext?.preset || "custom") as ResubmissionPresetKey;
  const resubmissionFields = authEntryContext?.fields || [];

  const stepIncludesFields = (step: number) => {
    if (!resubmissionMode) return true;
    if (resubmissionPreset === "full_package") return true;

    const fields = resubmissionFields;
    if (step === 3) {
      return fields.some((field) => ["requestedRole", "barangayId", "requestedBarangayId", "requestedBarangayName", "requestedProvinceName", "requestedMunicipalityName", "requestedRegionName"].includes(field));
    }
    if (step === 4) {
      return fields.some((field) => ["name", "firstName", "middleName", "lastName", "suffix", "birthdate", "mobileNumber", "address"].includes(field));
    }
    if (step === 5) {
      return fields.some((field) => ["schoolName", "professionalInfo", "adminReason"].includes(field));
    }
    if (step === 6) {
      return fields.some((field) => ["idType", "idNumber", "profilePhotoUrl", "idPhotoUrl", "selfiePhotoUrl"].includes(field));
    }
    return false;
  };

  const getNextActiveStep = (currentStep: number) => {
    if (!resubmissionMode) {
      if (currentStep === 3) return 4;
      if (currentStep === 4) return 5;
      if (currentStep === 5) return 6;
      return 7;
    }
    const steps = [3, 4, 5, 6];
    const index = steps.indexOf(currentStep);
    for (let i = index + 1; i < steps.length; i += 1) {
      if (stepIncludesFields(steps[i])) return steps[i];
    }
    return 7;
  };

  const getPrevActiveStep = (currentStep: number) => {
    if (!resubmissionMode) {
      return Math.max(currentStep - 1, 1);
    }
    const steps = [3, 4, 5, 6];
    const index = steps.indexOf(currentStep);
    for (let i = index - 1; i >= 0; i -= 1) {
      if (stepIncludesFields(steps[i])) return steps[i];
    }
    return 3;
  };

  type AuthFormFieldKey = ResubmissionFieldKey | "firstName" | "middleName" | "lastName" | "birthdate" | "mobileNumber" | "schoolName" | "professionalInfo" | "adminReason";

  const shouldRequireField = (field: AuthFormFieldKey) => {
    if (!resubmissionMode) return true;
    if (resubmissionPreset === "full_package") return true;

    if (["firstName", "middleName", "lastName", "birthdate", "mobileNumber"].includes(field)) {
      return resubmissionFields.includes("name");
    }

    if (field === "address") {
      return resubmissionFields.includes("address");
    }

    if (field === "schoolName") {
      return resubmissionFields.includes("idNumber") || resubmissionFields.includes("name");
    }

    if (field === "professionalInfo" || field === "adminReason") {
      return false;
    }

    return resubmissionFields.includes(field as ResubmissionFieldKey);
  };

  const isRejectedUser = !!user && (profile?.status === "inactive" || profile?.verificationStatus === "auto_rejected");
  const rejectionReason = rejectionMessage || authError || undefined;

  const toTitleCase = (str: string): string => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
      .join(" ");
  };

  const extractStreetOnlyAddress = (
    rawAddress: string,
    lguTerms: string[]
  ): string => {
    if (!rawAddress) return "";
    let cleaned = rawAddress;

    // Filter valid non-placeholder terms and sort by length descending to match multi-word terms first (e.g. "San Pascual" before "San")
    const terms = lguTerms
      .filter((t): t is string => !!t && t !== "N/A" && t !== "Unassigned" && t.trim().length > 1)
      .map((t) => t.trim())
      .sort((a, b) => b.length - a.length);

    // Unique terms
    const uniqueTerms = Array.from(new Set(terms));

    uniqueTerms.forEach((term) => {
      const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`,?\\s*\\b${escaped}\\b`, "gi");
      cleaned = cleaned.replace(regex, "");
    });

    cleaned = cleaned
      .trim()
      .replace(/^[,-\s]+|[,-\s]+$/g, "")
      .trim();

    return toTitleCase(cleaned);
  };

  useEffect(() => {
    if (user && profile && (!initialPrefillDone || authEntryContext)) {
      setIsLogin(false);
      if (profile.status === "onboarding" || profile.status === "inactive" || profile.verificationStatus === "auto_rejected" || authEntryContext) {
        setSignUpStep(authEntryContext?.startStep ?? 3);
      }
      setEmail(user.email || "");
      setDesiredRole((profile?.requestedRole || profile?.role || "resident") as any);

      const profileName = profile.name || profile.displayName || "";
      const profileParts = profileName.split(" ");
      setFirstName(profile.firstName || profileParts[0] || "");
      setMiddleName(profile.middleName || (profileParts.length > 2 ? profileParts.slice(1, -1).join(" ") : ""));
      setLastName(profile.lastName || (profileParts.length > 1 ? profileParts[profileParts.length - 1] : ""));
      setSuffix(profile.suffix || "");
      setBirthdate(profile.birthdate || "");
      setMobileNumber(profile.mobileNumber || "");

      const targetBgyId = profile.requestedBarangayId || profile.barangayId || selectedBarangayId;
      const selectedBgy = approvedBarangays.find((b) => b.id === targetBgyId);

      const lguTerms: string[] = [];

      if (profile.requestedBarangayName) lguTerms.push(profile.requestedBarangayName);
      if (profile.barangayName) lguTerms.push(profile.barangayName);
      if (profile.requestedMunicipalityName) lguTerms.push(profile.requestedMunicipalityName);
      if (profile.barangayMunicipality) lguTerms.push(profile.barangayMunicipality);
      if (profile.requestedProvinceName) lguTerms.push(profile.requestedProvinceName);
      if (profile.barangayProvince) lguTerms.push(profile.barangayProvince);

      if (selectedBgy) {
        if (selectedBgy.name) lguTerms.push(selectedBgy.name);
        if (selectedBgy.barangayName) lguTerms.push(selectedBgy.barangayName);
        if (selectedBgy.municipality) lguTerms.push(selectedBgy.municipality);
        if (selectedBgy.municipalityName) lguTerms.push(selectedBgy.municipalityName);
        if (selectedBgy.province) lguTerms.push(selectedBgy.province);
        if (selectedBgy.provinceName) lguTerms.push(selectedBgy.provinceName);
      }

      if (resMunicipality) lguTerms.push(resMunicipality);
      if (resProvince) lguTerms.push(resProvince);
      if (adminReqBarangayName) lguTerms.push(adminReqBarangayName);
      if (adminReqMunicipality) lguTerms.push(adminReqMunicipality);
      if (adminReqProvince) lguTerms.push(adminReqProvince);

      approvedBarangays.forEach((b) => {
        if (b.name) lguTerms.push(b.name);
        if (b.barangayName) lguTerms.push(b.barangayName);
        if (b.municipality) lguTerms.push(b.municipality);
        if (b.municipalityName) lguTerms.push(b.municipalityName);
        if (b.province) lguTerms.push(b.province);
        if (b.provinceName) lguTerms.push(b.provinceName);
      });

      const streetOnlyAddress = extractStreetOnlyAddress(profile.address || "", lguTerms);
      setAddress(streetOnlyAddress);

      setIdType(profile.idType || "barangay");
      setIdNumber(profile.idNumber || "");
      setSchoolName(profile.schoolName || "");
      setProfessionalInfo(profile.professionalInfo || "");
      setAdminReason(profile.adminReason || profile.resubmissionReason || "");
      const resolvedRegion = (profile.requestedRegionName && profile.requestedRegionName !== "N/A" ? profile.requestedRegionName : "") ||
                             (profile.barangayRegion && profile.barangayRegion !== "N/A" ? profile.barangayRegion : "") ||
                             (selectedBgy?.regionName || "") ||
                             resRegion;

      const resolvedProvince = (profile.requestedProvinceName && profile.requestedProvinceName !== "N/A" ? profile.requestedProvinceName : "") ||
                               (profile.barangayProvince && profile.barangayProvince !== "N/A" ? profile.barangayProvince : "") ||
                               (selectedBgy ? (selectedBgy.province || selectedBgy.provinceName) : "") ||
                               (resProvince !== "N/A" ? resProvince : "");

      const resolvedMunicipality = (profile.requestedMunicipalityName && profile.requestedMunicipalityName !== "N/A" ? profile.requestedMunicipalityName : "") ||
                                   (profile.barangayMunicipality && profile.barangayMunicipality !== "N/A" ? profile.barangayMunicipality : "") ||
                                   (selectedBgy ? (selectedBgy.municipality || selectedBgy.municipalityName) : "") ||
                                   (resMunicipality !== "N/A" ? resMunicipality : "");

      if (targetBgyId && targetBgyId !== selectedBarangayId) setSelectedBarangayId(targetBgyId);
      if (resolvedRegion && resolvedRegion !== resRegion) setResRegion(resolvedRegion);
      if (resolvedProvince && resolvedProvince !== resProvince) setResProvince(resolvedProvince);
      if (resolvedMunicipality && resolvedMunicipality !== resMunicipality) setResMunicipality(resolvedMunicipality);
      setProfilePhoto(profile.profilePhotoUrl || profile.photoURL || "");
      setIdPhoto(profile.idPhotoUrl || "");
      setSelfiePhoto(profile.selfiePhotoUrl || "N/A");

      setInitialPrefillDone(true);
    }
  }, [user, profile, authEntryContext, approvedBarangays]);

  useEffect(() => {
    if (!user && !isLogin) {
      setSignUpStep(1);
    }
  }, [user, isLogin]);

  useEffect(() => {
    if (authError && user && profile?.status === "inactive") {
      setIsLogin(false);
      setSignUpStep(3);
    }
  }, [authError, user, profile]);

  useEffect(() => {
    if (!isLogin && desiredRole === "barangay_admin") {
      setPsgcLoading(true);
      fetch("https://psgc.cloud/api/regions")
        .then((res) => res.json())
        .then((data: Array<{ code: string; name: string }>) => {
          setPsgcRegions(data);
          if (data.length > 0) {
            const calabarzon = data.find((r) => r.code === "0400000000") || data[0];
            setSelectedPsgcRegionCode(calabarzon.code);
            setAdminReqRegion(calabarzon.name);
          }
          setPsgcLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching regions from PSGC API:", err);
          setPsgcLoading(false);
        });
    }
  }, [isLogin, desiredRole]);

  useEffect(() => {
    if (desiredRole === "barangay_admin" && selectedPsgcRegionCode) {
      setPsgcLoading(true);
      const regObj = psgcRegions.find((r) => r.code === selectedPsgcRegionCode);
      if (regObj) setAdminReqRegion(regObj.name);

      fetch(`https://psgc.cloud/api/regions/${selectedPsgcRegionCode}/provinces`)
        .then((res) => res.json())
        .then((provinces: Array<{ code: string; name: string }>) => {
          if (provinces.length > 0) {
            setPsgcProvinces(provinces);
            const defaultProv = provinces.find((p) => p.name.toLowerCase().includes("cavite")) || provinces[0];
            setSelectedPsgcProvinceCode(defaultProv.code);
            setAdminReqProvince(defaultProv.name);
          } else {
            setPsgcProvinces([{ code: "NCR", name: "Metro Manila" }]);
            setSelectedPsgcProvinceCode("NCR");
            setAdminReqProvince("Metro Manila");

            fetch(`https://psgc.cloud/api/regions/${selectedPsgcRegionCode}/cities-municipalities`)
              .then((res) => res.json())
              .then((cities: Array<{ code: string; name: string }>) => {
                setPsgcMunicipalities(cities);
                if (cities.length > 0) {
                  const defaultCity = cities.find((c) => c.name.toLowerCase().includes("manila")) || cities[0];
                  setSelectedPsgcMunicipalityCode(defaultCity.code);
                  setAdminReqMunicipality(defaultCity.name);
                }
              });
          }
          setPsgcLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching provinces from PSGC API:", err);
          setPsgcLoading(false);
        });
    }
  }, [selectedPsgcRegionCode, desiredRole, psgcRegions]);

  useEffect(() => {
    if (desiredRole === "barangay_admin" && selectedPsgcProvinceCode && selectedPsgcProvinceCode !== "NCR") {
      setPsgcLoading(true);
      const provObj = psgcProvinces.find((p) => p.code === selectedPsgcProvinceCode);
      if (provObj) setAdminReqProvince(provObj.name);

      fetch(`https://psgc.cloud/api/provinces/${selectedPsgcProvinceCode}/cities-municipalities`)
        .then((res) => res.json())
        .then((munis: Array<{ code: string; name: string }>) => {
          setPsgcMunicipalities(munis);
          if (munis.length > 0) {
            const defaultMuni = munis.find((m) => m.name.toLowerCase().includes("imus")) || munis[0];
            setSelectedPsgcMunicipalityCode(defaultMuni.code);
            setAdminReqMunicipality(defaultMuni.name);
          } else {
            setSelectedPsgcMunicipalityCode("");
            setAdminReqMunicipality("");
          }
          setPsgcLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching municipalities from PSGC API:", err);
          setPsgcLoading(false);
        });
    }
  }, [selectedPsgcProvinceCode, desiredRole, psgcProvinces]);

  useEffect(() => {
    if (desiredRole === "barangay_admin" && selectedPsgcMunicipalityCode) {
      setPsgcLoading(true);
      const muniObj = psgcMunicipalities.find((m) => m.code === selectedPsgcMunicipalityCode);
      if (muniObj) setAdminReqMunicipality(muniObj.name);

      fetch(`https://psgc.cloud/api/cities-municipalities/${selectedPsgcMunicipalityCode}/barangays`)
        .then((res) => res.json())
        .then((bgys: Array<{ code: string; name: string }>) => {
          setPsgcBarangays(bgys);
          if (bgys.length > 0 && !adminReqBarangayName) {
            setAdminReqBarangayName(bgys[0].name);
          }
          setPsgcLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching barangays from PSGC API:", err);
          setPsgcLoading(false);
        });
    }
  }, [selectedPsgcMunicipalityCode, desiredRole, psgcMunicipalities]);

  useEffect(() => {
    if (!isLogin && desiredRole === "resident") {
      setLoadingBarangays(true);
      getApprovedBarangays()
        .then((list) => {
          setApprovedBarangays(list);
          const regs = Array.from(new Set(list.map((b) => b.regionName || "REGION IV-A (CALABARZON)").filter(Boolean))) as string[];
          if (regs.length > 0) {
            const defaultReg = regs[0];
            setResRegion(defaultReg);
            const provs = Array.from(new Set(list.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === defaultReg).map((b) => b.province || b.provinceName).filter(Boolean))) as string[];
            if (provs.length > 0) {
              const defaultProv = provs[0];
              setResProvince(defaultProv);
              const munis = Array.from(new Set(list.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === defaultReg && (b.province || b.provinceName) === defaultProv).map((b) => b.municipality || b.municipalityName).filter(Boolean))) as string[];
              if (munis.length > 0) {
                const defaultMuni = munis[0];
                setResMunicipality(defaultMuni);
                const bgyMatches = list.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === defaultReg && (b.province || b.provinceName) === defaultProv && (b.municipality || b.municipalityName) === defaultMuni);
                setSelectedBarangayId(bgyMatches[0]?.id || "");
              } else {
                setResMunicipality("");
                setSelectedBarangayId("");
              }
            } else {
              setResProvince("");
              setResMunicipality("");
              setSelectedBarangayId("");
            }
          } else {
            setResRegion("");
            setResProvince("");
            setResMunicipality("");
            setSelectedBarangayId("");
          }
          setLoadingBarangays(false);
        })
        .catch((err) => {
          console.error("Failed to fetch participating barangays:", err);
          setError("Failed to load participating barangays. Please refresh the page.");
          setLoadingBarangays(false);
        });
    }
  }, [isLogin, desiredRole]);

  useEffect(() => {
    if (desiredRole === "resident" && approvedBarangays.length > 0 && resRegion) {
      const provs = Array.from(new Set(approvedBarangays.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion).map((b) => b.province || b.provinceName).filter(Boolean))) as string[];
      if (provs.length > 0 && !provs.includes(resProvince)) {
        setResProvince(provs[0]);
      }
    }
  }, [resRegion, approvedBarangays]);

  useEffect(() => {
    if (desiredRole === "resident" && approvedBarangays.length > 0 && resRegion && resProvince) {
      const munis = Array.from(new Set(approvedBarangays.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion && (b.province || b.provinceName) === resProvince).map((b) => b.municipality || b.municipalityName).filter(Boolean))) as string[];
      if (munis.length > 0 && !munis.includes(resMunicipality)) {
        setResMunicipality(munis[0]);
      }
    }
  }, [resProvince, resRegion, approvedBarangays]);

  useEffect(() => {
    if (desiredRole === "resident" && approvedBarangays.length > 0) {
      const matchStr = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
      const currentValid = approvedBarangays.find((b) => b.id === selectedBarangayId);
      if (!currentValid) {
        const matching = approvedBarangays.find(
          (b) =>
            (matchStr(b.regionName, resRegion) || !resRegion) &&
            (matchStr(b.province || b.provinceName, resProvince) || !resProvince) &&
            (matchStr(b.municipality || b.municipalityName, resMunicipality) || !resMunicipality)
        ) || approvedBarangays[0];

        if (matching) {
          setSelectedBarangayId(matching.id);
        }
      }
    }
  }, [resMunicipality, resProvince, resRegion, approvedBarangays, desiredRole, selectedBarangayId]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      setError(null);
      setRejectionMessage(null);
      setLoading(true);
      try {
        await signIn(email, password);
      } catch (err: any) {
        console.error(err);
        const msg = err?.message || "Login failed. Please check credentials.";
        const normalized = msg.toLowerCase();

        if (
          normalized.includes("invalid-credential") ||
          normalized.includes("invalid credential") ||
          normalized.includes("user-not-found") ||
          normalized.includes("wrong-password")
        ) {
          setError("Invalid email address or password. Please check your login credentials and try again.");
        } else if (
          normalized.includes("inactive") ||
          normalized.includes("rejected")
        ) {
          setRejectionMessage(msg);
          setIsLogin(false);
          setSignUpStep(3);
        } else if (normalized.includes("suspended")) {
          setRejectionMessage(msg);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAuthSubmit = async () => {
    setError(null);

    if (!user && !password.trim()) {
      setError("You must complete Account Setup before submitting verification documents. Please return to step 1 and enter a password.");
      setIsLogin(false);
      setSignUpStep(1);
      return;
    }

    setLoading(true);

    try {
      let registeredProfile: any = null;
      if (desiredRole === "barangay_admin") {
        if (!adminReqBarangayName.trim() || !adminReqMunicipality.trim() || !adminReqProvince.trim()) {
          throw new Error("Please enter your target Barangay Name, Municipality, and Province.");
        }

        const formattedStreet = toTitleCase(address.trim().replace(/,\s*$/, ""));
        const fullAddress = formattedStreet
          ? `${formattedStreet}, ${toTitleCase(adminReqBarangayName.trim())}, ${toTitleCase(adminReqMunicipality.trim())}, ${toTitleCase(adminReqProvince.trim())}`
          : `${toTitleCase(adminReqBarangayName.trim())}, ${toTitleCase(adminReqMunicipality.trim())}, ${toTitleCase(adminReqProvince.trim())}`;

        registeredProfile = await signUp(
          email,
          password,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          "unassigned",
          adminReqBarangayName.trim(),
          adminReqMunicipality.trim(),
          adminReqProvince.trim(),
          desiredRole,
          mobileNumber,
          fullAddress,
          idType,
          idNumber,
          "N/A",
          professionalInfo,
          adminReason,
          adminReqRegion.trim() || "CALABARZON"
        );
      } else {
        let targetBgy = approvedBarangays.find((b) => b.id === selectedBarangayId);
        if (!targetBgy && approvedBarangays.length > 0) {
          const matchStr = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
          targetBgy = approvedBarangays.find(
            (b) =>
              (matchStr(b.regionName, resRegion) || !resRegion) &&
              (matchStr(b.province || b.provinceName, resProvince) || !resProvince) &&
              (matchStr(b.municipality || b.municipalityName, resMunicipality) || !resMunicipality)
          ) || approvedBarangays[0];
        }

        if (!targetBgy) {
          throw new Error("Please select an active Barangay Bond community before submitting.");
        }

        const bgyId = targetBgy.id;
        const bgyName = targetBgy.name || targetBgy.barangayName;
        const muniName = targetBgy.municipality || targetBgy.municipalityName || resMunicipality;
        const provName = targetBgy.province || targetBgy.provinceName || resProvince;

        const formattedStreet = toTitleCase(address.trim().replace(/,\s*$/, ""));
        const fullAddress = formattedStreet
          ? `${formattedStreet}, ${bgyName}, ${muniName}, ${provName}`
          : `${bgyName}, ${muniName}, ${provName}`;

        registeredProfile = await signUp(
          email,
          password,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          bgyId,
          bgyName,
          muniName || "N/A",
          provName || "N/A",
          desiredRole as "resident",
          mobileNumber,
          fullAddress,
          idType,
          idNumber,
          schoolName.trim() || "N/A",
          undefined,
          undefined,
          targetBgy.regionName || "CALABARZON"
        );
      }

      if (desiredRole === "resident" || desiredRole === "barangay_admin") {
        await executeAIVerification(idPhoto, selfiePhoto, profilePhoto, registeredProfile);
      }

      if (setAuthEntryContext) {
        setAuthEntryContext(null);
      }
      setSignUpStep(7);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Registration failed. Please check details.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setError(null);
    if (signUpStep === 1) {
      if (!email.trim() || !password.trim()) {
        setError("Please enter your email and password.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      setLoading(true);
      signUpEmailPassword(email, password)
        .then(() => {
          setLoading(false);
        })
        .catch((err: any) => {
          setError(err.message || "Failed to initiate registration. Please check credentials.");
          setLoading(false);
        });
      return;
    }

    if (signUpStep === 3) {
      if (desiredRole === "resident" && !selectedBarangayId) {
        setError("Barangay Bond is not yet available in your municipality. Please contact your Barangay Office or System Administrator.");
        return;
      }
      setSignUpStep(getNextActiveStep(3));
      return;
    }

    if (signUpStep === 4) {
      if (shouldRequireField("firstName") && !firstName.trim()) {
        setError("Please enter your first name.");
        return;
      }
      if (shouldRequireField("lastName") && !lastName.trim()) {
        setError("Please enter your last name.");
        return;
      }
      if (shouldRequireField("birthdate") && !birthdate) {
        setError("Please select your date of birth.");
        return;
      }
      if (shouldRequireField("mobileNumber") && !mobileNumber.trim()) {
        setError("Please enter your mobile number.");
        return;
      }
      if (shouldRequireField("address") && !address.trim()) {
        setError("Please enter your house/street address.");
        return;
      }
      setSignUpStep(getNextActiveStep(4));
      return;
    }

    if (signUpStep === 5) {
      if (desiredRole === "barangay_admin") {
        if (shouldRequireField("professionalInfo") && !professionalInfo.trim()) {
          setError("Please enter your professional title or current occupation.");
          return;
        }
        if (shouldRequireField("adminReason") && !adminReason.trim()) {
          setError("Please explain your reason for applying as Barangay Administrator.");
          return;
        }
      }
      setSignUpStep(getNextActiveStep(5));
      return;
    }

    if (signUpStep === 6) {
      if (shouldRequireField("idNumber") && !idNumber.trim()) {
        setError("Please enter your Document ID Number.");
        return;
      }
      if (shouldRequireField("profilePhotoUrl") && !profilePhoto) {
        setError("Please upload your profile photo.");
        return;
      }
      if (shouldRequireField("idPhotoUrl") && !idPhoto) {
        setError("Please upload your government ID photo.");
        return;
      }
      if (desiredRole === "barangay_admin" && shouldRequireField("selfiePhotoUrl") && (!selfiePhoto || selfiePhoto === "N/A")) {
        setError("Please upload a selfie holding your ID card.");
        return;
      }
      handleAuthSubmit();
      return;
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (!resubmissionMode) {
      if (signUpStep === 3) {
        return;
      }
      setSignUpStep((prev) => Math.max(prev - 1, 1));
      return;
    }
    if (signUpStep === 3) {
      return;
    }
    setSignUpStep(getPrevActiveStep(signUpStep));
  };

  const isRegistrationDisabled = !isLogin && signUpStep === 3 && desiredRole === "resident" && approvedBarangays.length === 0 && !loadingBarangays;

  const renderSignupWizard = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="wizard-progress-bar">
          <span className={`step-dot ${signUpStep === 1 ? "active" : ""}`}>1. Account Setup</span>
          <span className={`step-dot ${signUpStep === 3 ? "active" : ""}`}>2. Role / LGU</span>
          <span className={`step-dot ${signUpStep === 4 ? "active" : ""}`}>3. Identity Details</span>
          <span className={`step-dot ${signUpStep === 5 ? "active" : ""}`}>4. Additional Info</span>
          <span className={`step-dot ${signUpStep === 6 ? "active" : ""}`}>5. Verification Docs</span>
        </div>

        {signUpStep === 1 && (
          <LoginStep
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            onNext={handleNextStep}
          />
        )}

        {signUpStep === 3 && (
          <RoleLGUStep
            desiredRole={desiredRole}
            setDesiredRole={setDesiredRole}
            loadingBarangays={loadingBarangays}
            approvedBarangays={approvedBarangays}
            resRegion={resRegion}
            setResRegion={setResRegion}
            resProvince={resProvince}
            setResProvince={setResProvince}
            resMunicipality={resMunicipality}
            setResMunicipality={setResMunicipality}
            selectedBarangayId={selectedBarangayId}
            setSelectedBarangayId={setSelectedBarangayId}
            psgcLoading={psgcLoading}
            psgcRegions={psgcRegions}
            selectedPsgcRegionCode={selectedPsgcRegionCode}
            setSelectedPsgcRegionCode={setSelectedPsgcRegionCode}
            psgcProvinces={psgcProvinces}
            selectedPsgcProvinceCode={selectedPsgcProvinceCode}
            setSelectedPsgcProvinceCode={setSelectedPsgcProvinceCode}
            psgcMunicipalities={psgcMunicipalities}
            selectedPsgcMunicipalityCode={selectedPsgcMunicipalityCode}
            setSelectedPsgcMunicipalityCode={setSelectedPsgcMunicipalityCode}
            psgcBarangays={psgcBarangays}
            adminReqBarangayName={adminReqBarangayName}
            setAdminReqBarangayName={setAdminReqBarangayName}
            isRegistrationDisabled={isRegistrationDisabled}
            user={user}
            signOut={signOut}
            setViewState={setViewState}
            onNext={handleNextStep}
          />
        )}

        {signUpStep === 4 && (
          <DetailsStep
            firstName={firstName}
            setFirstName={setFirstName}
            middleName={middleName}
            setMiddleName={setMiddleName}
            lastName={lastName}
            setLastName={setLastName}
            suffix={suffix}
            setSuffix={setSuffix}
            birthdate={birthdate}
            setBirthdate={setBirthdate}
            mobileNumber={mobileNumber}
            setMobileNumber={setMobileNumber}
            address={address}
            setAddress={setAddress}
            desiredRole={desiredRole}
            approvedBarangays={approvedBarangays}
            selectedBarangayId={selectedBarangayId}
            resMunicipality={resMunicipality}
            resProvince={resProvince}
            adminReqBarangayName={adminReqBarangayName}
            adminReqMunicipality={adminReqMunicipality}
            adminReqProvince={adminReqProvince}
            onPrev={handlePrevStep}
            onNext={handleNextStep}
          />
        )}

        {signUpStep === 5 && (
          <AddInfoStep
            desiredRole={desiredRole}
            professionalInfo={professionalInfo}
            setProfessionalInfo={setProfessionalInfo}
            adminReason={adminReason}
            setAdminReason={setAdminReason}
            schoolName={schoolName}
            setSchoolName={setSchoolName}
            onPrev={handlePrevStep}
            onNext={handleNextStep}
          />
        )}

        {signUpStep === 6 && (
          <UploadsStep
            idType={idType}
            setIdType={setIdType}
            idNumber={idNumber}
            setIdNumber={setIdNumber}
            profilePhoto={profilePhoto}
            setProfilePhoto={setProfilePhoto}
            idPhoto={idPhoto}
            setIdPhoto={setIdPhoto}
            selfiePhoto={selfiePhoto}
            setSelfiePhoto={setSelfiePhoto}
            desiredRole={desiredRole}
            compressing={compressing}
            setCompressing={setCompressing}
            loading={loading}
            onPrev={handlePrevStep}
            onNext={handleNextStep}
          />
        )}

        {signUpStep === 7 && (
          <SuccessStep
            desiredRole={desiredRole}
            resubmissionMode={resubmissionMode}
            setViewState={setViewState}
            setSignUpStep={setSignUpStep}
            setEmail={setEmail}
            setPassword={setPassword}
            setFirstName={setFirstName}
            setMiddleName={setMiddleName}
            setLastName={setLastName}
            setSuffix={setSuffix}
            setBirthdate={setBirthdate}
            setMobileNumber={setMobileNumber}
            setAddress={setAddress}
            setIdNumber={setIdNumber}
            setSchoolName={setSchoolName}
            setIdPhoto={setIdPhoto}
            setSelfiePhoto={setSelfiePhoto}
            setProfilePhoto={setProfilePhoto}
            setIsLogin={setIsLogin}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexWrap: "wrap", width: "100%", backgroundColor: "var(--bg-base)" }}>
        {/* Left 40% Visual Branding Section */}
        <div
          style={{
            flex: "1 1 360px",
            maxWidth: "100%",
            minHeight: "220px",
            background: "var(--role-card-gradient)",
            borderRight: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
            padding: "2.5rem 2rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🇵🇭</span>
                <span style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
                  Barangay Bond
                </span>
              </div>
              <button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>

            <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.5rem)", fontWeight: 900, lineHeight: 1.2, color: "var(--text-primary)", marginBottom: "1.25rem", letterSpacing: "-0.03em" }}>
              Secure Local Budgets.<br />
              <span style={{ color: "var(--role-accent)" }}>Empower Youth Builders.</span>
            </h1>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.6, maxWidth: "420px", marginBottom: "2rem" }}>
              Decentralized municipal treasury portal powered by Stellar Soroban smart contracts.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
                  <Lock size={18} />
                </div>
                <div style={{ fontSize: "0.85rem" }}>
                  <strong style={{ color: "var(--text-primary)" }}>Milestone Escrow Contracts</strong>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>Budgets unlocked upon verified citizen audit</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
                  <ShieldCheck size={18} />
                </div>
                <div style={{ fontSize: "0.85rem" }}>
                  <strong style={{ color: "var(--text-primary)" }}>Civic Identity Verification</strong>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.78rem" }}>15–30 year-old verified youth voter consensus</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Stellar Soroban Testnet Portal
          </div>
        </div>

        {/* Right 60% Form Section */}
        <div
          style={{
            flex: "1 1 480px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1.25rem",
            minHeight: "100%",
            background: "transparent",
          }}
        >
          <div
            className="bank-card"
            style={{
              maxWidth: "520px",
              width: "100%",
              padding: "2.5rem 2rem",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-primary)",
              boxShadow: "var(--shadow-floating)",
            }}
          >
            <h2 style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: "0.3rem", letterSpacing: "-0.02em" }}>
              {isLogin ? "Sign In to Portal" : resubmissionMode ? "Resubmit Your Profile" : "Register Resident Profile"}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.75rem" }}>
              {isLogin
                ? "Access your transparency governance dashboard"
                : resubmissionMode
                  ? "Update required fields to finalize your identity verification."
                  : "Join your local barangay community portal"}
            </p>

            <ErrorValidationModal
              isOpen={error !== null || rejectionMessage !== null || authError !== null}
              error={rejectionMessage || error || authError}
              onClose={() => {
                setError(null);
                setRejectionMessage(null);
                clearAuthError();
              }}
              actionText={
                (error || rejectionMessage)?.includes("already-in-use") ||
                  (error || rejectionMessage)?.includes("already in use")
                  ? "Switch to Sign In"
                  : (error || rejectionMessage || authError)?.toLowerCase().includes("inactive") ||
                    (error || rejectionMessage || authError)?.toLowerCase().includes("rejected")
                    ? "Continue Registration"
                    : undefined
              }
              onAction={
                (error || rejectionMessage)?.includes("already-in-use") ||
                  (error || rejectionMessage)?.includes("already in use")
                  ? () => {
                    setIsLogin(true);
                    setSignUpStep(1);
                  }
                  : (error || rejectionMessage || authError)?.toLowerCase().includes("inactive") ||
                    (error || rejectionMessage || authError)?.toLowerCase().includes("rejected")
                    ? () => {
                      setIsLogin(false);
                      setSignUpStep(3);
                      setError(null);
                      setRejectionMessage(null);
                      clearAuthError();
                    }
                    : undefined
              }
            />

            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {isRejectedUser && (
                <div style={{ border: "1px solid var(--accent-danger)", background: "var(--accent-danger-soft)", borderRadius: "18px", padding: "1.25rem", marginBottom: "0.5rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--accent-danger)", fontWeight: 700 }}>Application Review Status</h3>
                  <p style={{ margin: "0.5rem 0 0", color: "var(--text-primary)", fontSize: "0.88rem", lineHeight: 1.4 }}>
                    Your profile was flagged for resubmission. Please update the requested fields to proceed.
                  </p>
                  {rejectionReason && (
                    <p style={{ margin: "0.5rem 0 0", color: "var(--accent-danger)", fontSize: "0.82rem" }}>
                      <strong>Note:</strong> {rejectionReason}
                    </p>
                  )}
                  {profile?.resubmissionFields?.length ? (
                    <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {profile.resubmissionFields.map((fieldKey: any) => (
                        <span key={fieldKey} className="badge badge-warning">
                          {getResubmissionFieldLabel(fieldKey)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline-danger w-100"
                    style={{ marginTop: "0.75rem" }}
                    onClick={() => {
                      setIsLogin(false);
                      setSignUpStep(3);
                      setError(null);
                      setRejectionMessage(null);
                      clearAuthError();
                    }}
                  >
                    Resume Application
                  </button>
                </div>
              )}

              {isLogin ? (
                <>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      inputMode="email"
                      className="form-control"
                      placeholder="your.email@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg w-100" style={{ width: "100%", height: "52px", marginTop: "0.5rem" }} disabled={loading}>
                    {loading ? "Signing in..." : "Login to Portal"}
                  </button>
                </>
              ) : (
                renderSignupWizard()
              )}
            </form>

            {!resubmissionMode && (
              <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                <button
                  type="button"
                  className="btn btn-outline w-100"
                  onClick={() => { setIsLogin(!isLogin); setSignUpStep(1); setError(null); }}
                >
                  {isLogin ? "Need a new profile? Register here" : "Already registered? Sign in"}
                </button>
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ border: "none", color: "var(--text-muted)" }}
                onClick={() => setViewState("landing")}
              >
                ← Return to Landing Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

export default AuthPage;

