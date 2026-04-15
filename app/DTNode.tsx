import { memo, useState } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { NodeData } from "./lib";

const style = {
  padding: 0,
  border: "1px solid",
  background: "#10161d",
  color: "#e7eef7",
  width: 260,
  lineHeight: 1.4,
  fontFamily: "inherit",
  borderRadius: 12,
  overflow: "hidden" as "hidden",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
};

const toneStyles: Record<NodeData["tone"], { accent: string; chip: string }> = {
  root: { accent: "#f59e0b", chip: "rgba(245, 158, 11, 0.16)" },
  cpu: { accent: "#38bdf8", chip: "rgba(56, 189, 248, 0.16)" },
  memory: { accent: "#a78bfa", chip: "rgba(167, 139, 250, 0.16)" },
  bus: { accent: "#34d399", chip: "rgba(52, 211, 153, 0.16)" },
  device: { accent: "#94a3b8", chip: "rgba(148, 163, 184, 0.14)" },
};

const DTNode = ({
  data,
  isConnectable,
  selected,
  targetPosition = Position.Top,
  sourcePosition = Position.Bottom
}: NodeProps<NodeData>) => {
  const [hovered, setHovered] = useState(false);

  const hoverOn = () => setHovered(true);
  const hoverOff = () => setHovered(false);

  const tone = toneStyles[data?.tone || "device"];
  const borderColor = selected ? tone.accent : hovered ? "#7dd3fc" : "#425466";
  const boxShadow = selected
    ? `0 0 0 1px ${tone.accent}, 0 14px 34px rgba(0, 0, 0, 0.4), 0 0 28px ${tone.chip}`
    : hovered
      ? "0 10px 28px rgba(0, 0, 0, 0.34)"
      : style.boxShadow;
  return (
    <>
      <Handle
        type="target"
        position={targetPosition}
        isConnectable={isConnectable}
      />
        <div
          style={{
            ...style,
            borderColor,
            boxShadow,
            transform: selected ? "translateY(-2px)" : "translateY(0)",
            transition: "border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
          }}
          onMouseEnter={hoverOn}
          onMouseLeave={hoverOff}
        >
          <div
            style={{
              padding: "10px 12px 8px",
              background: `linear-gradient(135deg, ${selected ? tone.chip.replace("0.16", "0.28").replace("0.14", "0.24") : tone.chip}, rgba(15, 23, 42, 0.08))`,
              borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#f8fafc",
                marginBottom: 4,
              }}
            >
              {data?.title}
            </div>
            {data?.address && (
              <div
                style={{
                  fontSize: 10.5,
                  color: "#93a4b8",
                }}
              >
                {data.address}
              </div>
            )}
          </div>
          <div style={{ padding: "10px 12px 12px" }}>
            {data?.summaryFields?.length ? (
              data.summaryFields.map((field) => (
                <div key={field.label} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: "#7f8ea3",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 2,
                    }}
                  >
                    {field.label}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "#d9e2ec",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {field.value}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 10.5, color: "#7f8ea3" }}>
                No key properties
              </div>
            )}
          </div>
        </div>
      <Handle
        type="source"
        position={sourcePosition}
        isConnectable={isConnectable}
      />
    </>
  );
};

DTNode.displayName = "DTNode";

export default memo(DTNode);
