"use client";

import * as React from "react";

export interface LessonPathItem {
  id: string;
  status: "locked" | "current" | "completed";
  /** Optional label shown above the card */
  groupLabel?: string;
}

export interface LessonPathProps<T extends LessonPathItem> {
  items: T[];
  /** Render the card content for each item */
  renderCard: (item: T, index: number) => React.ReactNode;
  /** Called when a non-locked item is clicked */
  onItemClick?: (item: T) => void;
  /** CSS class for the outer wrapper */
  className?: string;
  /** Color of the connector path (default: #1CB0F6) */
  pathColor?: string;
}

export function LessonPath<T extends LessonPathItem>({
  items,
  renderCard,
  onItemClick,
  className,
  pathColor = "#1CB0F6",
}: LessonPathProps<T>) {
  return (
    <div
      className={className}
      style={{ position: "relative", padding: "32px 21px" }}
    >
      <div style={{ position: "relative" }}>
        {items.map((item, index) => {
          const isEven = index % 2 === 0;
          const nextIsEven = (index + 1) % 2 === 0;
          const isLocked = item.status === "locked";

          return (
            <React.Fragment key={item.id}>
              {/* Group label */}
              {item.groupLabel && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "16px 0",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,200,0,0.15)",
                      border: "2px solid #FFC800",
                      borderRadius: 18,
                      padding: "12px 24px",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {item.groupLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* Row: card + connector */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  scrollMarginTop: 10,
                }}
                data-lesson-path-id={item.id}
              >
                {/* Card */}
                <div
                  role={isLocked ? undefined : "button"}
                  tabIndex={isLocked ? undefined : 0}
                  onClick={isLocked ? undefined : () => onItemClick?.(item)}
                  onKeyDown={
                    isLocked
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            onItemClick?.(item);
                          }
                        }
                  }
                  style={{
                    order: isEven ? 1 : 2,
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked ? 0.6 : 1,
                    outline: "none",
                  }}
                >
                  {renderCard(item, index)}
                </div>

                {/* Connector */}
                {index < items.length - 1 && (
                  <div
                    style={{
                      order: isEven ? 2 : 1,
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: "45.3vw",
                        height: "29.3vw",
                        maxWidth: 180,
                        maxHeight: 116,
                        borderRadius: 60,
                        border: `clamp(6px, 2.7vw, 11px) solid ${pathColor}`,
                        opacity: index === 0 ? 1 : 0.2,
                        transform: `translateY(clamp(28px, 10.7vw, 43px)) ${
                          nextIsEven
                            ? "translateX(clamp(56px, 21.3vw, 85px))"
                            : "translateX(clamp(-85px, -21.3vw, -56px))"
                        }`,
                      }}
                    />
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
