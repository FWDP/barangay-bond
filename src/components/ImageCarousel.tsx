import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut, Image as ImageIcon } from "lucide-react";
import { createPortal } from "react-dom";

interface ImageCarouselProps {
  images?: string[];
  alt?: string;
  height?: string | number;
  rounded?: string;
  showLightboxOnClick?: boolean;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images = [],
  alt = "Project photo",
  height = "200px",
  rounded = "12px",
  showLightboxOnClick = true,
}) => {
  const validImages = images.filter((img) => typeof img === "string" && img.trim().length > 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  if (validImages.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height,
          borderRadius: rounded,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          color: "var(--text-muted)",
        }}
      >
        <ImageIcon size={28} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>No photos available</span>
      </div>
    );
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  const handleOpenLightbox = () => {
    if (showLightboxOnClick) {
      setLightboxOpen(true);
      setLightboxZoom(1);
    }
  };

  return (
    <>
      <div
        style={{
          position: "relative",
          width: "100%",
          height,
          borderRadius: rounded,
          overflow: "hidden",
          background: "#000000",
          border: "1px solid var(--border-subtle)",
          cursor: showLightboxOnClick ? "pointer" : "default",
          userSelect: "none",
        }}
        onClick={handleOpenLightbox}
      >
        {/* Main Active Image */}
        <img
          src={validImages[currentIndex]}
          alt={`${alt} (${currentIndex + 1}/${validImages.length})`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            transition: "opacity 0.25s ease",
          }}
          onError={(e) => {
            (e.target as any).src = "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80";
          }}
        />

        {/* Multi-Image Overlay Controls */}
        {validImages.length > 1 && (
          <>
            {/* Left Nav Arrow */}
            <button
              type="button"
              onClick={handlePrev}
              style={{
                position: "absolute",
                top: "50%",
                left: "8px",
                transform: "translateY(-50%)",
                background: "rgba(0, 0, 0, 0.55)",
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 2,
                transition: "background 0.2s ease",
              }}
              aria-label="Previous photo"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Right Nav Arrow */}
            <button
              type="button"
              onClick={handleNext}
              style={{
                position: "absolute",
                top: "50%",
                right: "8px",
                transform: "translateY(-50%)",
                background: "rgba(0, 0, 0, 0.55)",
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 2,
                transition: "background 0.2s ease",
              }}
              aria-label="Next photo"
            >
              <ChevronRight size={16} />
            </button>

            {/* Dot Indicators */}
            <div
              style={{
                position: "absolute",
                bottom: "8px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "5px",
                background: "rgba(0, 0, 0, 0.45)",
                backdropFilter: "blur(4px)",
                padding: "3px 8px",
                borderRadius: "12px",
                zIndex: 2,
              }}
            >
              {validImages.map((_, idx) => (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  style={{
                    width: currentIndex === idx ? "16px" : "6px",
                    height: "6px",
                    borderRadius: "3px",
                    background: currentIndex === idx ? "var(--role-accent, #6366f1)" : "rgba(255, 255, 255, 0.5)",
                    transition: "all 0.25s ease",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>

            {/* Photo Counter Pill */}
            <div
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(4px)",
                color: "#ffffff",
                fontSize: "0.68rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: "8px",
                zIndex: 2,
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
            >
              {currentIndex + 1} / {validImages.length}
            </div>
          </>
        )}

        {/* Maximize Icon */}
        {showLightboxOnClick && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              color: "#ffffff",
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              opacity: 0.8,
            }}
          >
            <Maximize2 size={12} />
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(8px)",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setLightboxOpen(false)}
        >
          {/* Lightbox Top Header */}
          <div
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ color: "#ffffff", borderColor: "rgba(255, 255, 255, 0.3)" }}
              onClick={() => setLightboxZoom((z) => Math.min(z + 0.25, 2.5))}
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ color: "#ffffff", borderColor: "rgba(255, 255, 255, 0.3)" }}
              onClick={() => setLightboxZoom((z) => Math.max(z - 0.25, 0.75))}
            >
              <ZoomOut size={15} />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => setLightboxOpen(false)}
            >
              <X size={16} /> Close
            </button>
          </div>

          {/* Lightbox Center Image */}
          <div
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              overflow: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={validImages[currentIndex]}
              alt={alt}
              style={{
                maxWidth: "85vw",
                maxHeight: "75vh",
                objectFit: "contain",
                borderRadius: "10px",
                transform: `scale(${lightboxZoom})`,
                transition: "transform 0.2s ease",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
              }}
            />
          </div>

          {/* Lightbox Footer Navigation */}
          {validImages.length > 1 && (
            <div
              style={{
                position: "absolute",
                bottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                background: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(6px)",
                padding: "0.4rem 1rem",
                borderRadius: "20px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handlePrev}
                style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ color: "#ffffff", fontSize: "0.82rem", fontWeight: 700 }}>
                {currentIndex + 1} of {validImages.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};
