import React, { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type LoadingCategory = "ai" | "crud" | "soroban" | "sync" | "auth";

export interface LoadingStep {
  label: string;
  status: "pending" | "active" | "completed" | "failed";
}

export interface LoadingState {
  isLoading: boolean;
  category: LoadingCategory;
  title: string;
  message: string;
  currentStepIndex: number;
  steps: LoadingStep[];
  cancellable?: boolean;
  onCancel?: () => void;
}

interface StartLoadingOptions {
  category: LoadingCategory;
  title: string;
  message: string;
  steps?: string[];
  cancellable?: boolean;
  onCancel?: () => void;
}

interface LoadingContextType {
  loadingState: LoadingState;
  startLoading: (options: StartLoadingOptions) => void;
  updateLoading: (message: string, currentStepIndex?: number) => void;
  nextStep: (stepLabel?: string) => void;
  stopLoading: () => void;
}

const defaultState: LoadingState = {
  isLoading: false,
  category: "crud",
  title: "",
  message: "",
  currentStepIndex: 0,
  steps: [],
  cancellable: false,
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loadingState, setLoadingState] = useState<LoadingState>(defaultState);

  const startLoading = useCallback((options: StartLoadingOptions) => {
    const initialSteps: LoadingStep[] = (options.steps || []).map((label, idx) => ({
      label,
      status: idx === 0 ? "active" : "pending",
    }));

    setLoadingState({
      isLoading: true,
      category: options.category,
      title: options.title,
      message: options.message,
      currentStepIndex: 0,
      steps: initialSteps,
      cancellable: options.cancellable || false,
      onCancel: options.onCancel,
    });
  }, []);

  const updateLoading = useCallback((message: string, currentStepIndex?: number) => {
    setLoadingState((prev) => {
      if (!prev.isLoading) return prev;
      const nextIdx = currentStepIndex !== undefined ? currentStepIndex : prev.currentStepIndex;
      const updatedSteps = prev.steps.map((step, idx) => {
        if (idx < nextIdx) return { ...step, status: "completed" as const };
        if (idx === nextIdx) return { ...step, status: "active" as const };
        return { ...step, status: "pending" as const };
      });

      return {
        ...prev,
        message,
        currentStepIndex: nextIdx,
        steps: updatedSteps,
      };
    });
  }, []);

  const nextStep = useCallback((stepLabel?: string) => {
    setLoadingState((prev) => {
      if (!prev.isLoading) return prev;
      const nextIdx = prev.currentStepIndex + 1;
      const updatedSteps = prev.steps.map((step, idx) => {
        if (idx < nextIdx) return { ...step, status: "completed" as const };
        if (idx === nextIdx) return { ...step, status: "active" as const };
        return { ...step, status: "pending" as const };
      });

      return {
        ...prev,
        currentStepIndex: nextIdx,
        message: stepLabel || (prev.steps[nextIdx]?.label ? `Processing ${prev.steps[nextIdx].label}...` : prev.message),
        steps: updatedSteps,
      };
    });
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingState(defaultState);
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        loadingState,
        startLoading,
        updateLoading,
        nextStep,
        stopLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export function useLoading(): LoadingContextType {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}
