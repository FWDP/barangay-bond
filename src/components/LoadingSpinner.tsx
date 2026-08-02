import React from "react";

export const LoadingSpinner: React.FC<{ size?: "sm" | "md" | "lg"; label?: string }> = ({
  size = "md",
  label,
}) => {
  const sizeClass = size === "sm" ? "spinner-sm" : size === "lg" ? "spinner-lg" : "spinner-md";

  return (
    <div className="spinner-container">
      <div className={`spinner ${sizeClass}`}></div>
      {label && <p className="spinner-label">{label}</p>}
    </div>
  );
};
