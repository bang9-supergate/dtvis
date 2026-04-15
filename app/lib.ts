type DTProp = any; // TODO
// TODO
type DTNode = any & {
  name: string;
  props: DTProp[];
  children?: DTNode;
  addr?: string;
};

// TODO: Differentiate?
enum NodeType {
  custom = "custom",
}

type TransformedNode = {
  id: string;
  type: NodeType;
  position: {
    x: number;
    y: number;
  };
  data: NodeData;
};
type TransformedEdge = any; // TODO

export type NodeField = {
  label: string;
  value: string;
};

export type NodeData = {
  title: string;
  address?: string;
  summaryFields: NodeField[];
  detailFields: NodeField[];
  sourceSnippet: string;
  tone: "root" | "cpu" | "memory" | "bus" | "device";
};

const fourU8ToU32 = (f: number[]): number =>
  (((f[0] << 24) | (f[1] << 16) | (f[2] << 8) | f[3]) >>> 0);

const u8ArrToU32Arr = (u8a: number[]): number[] => {
    let res = [];
    for (let i = 0; i < u8a.length/4; i++) {
        const c = u8a.slice(i*4, (i+1)*4);
        res.push(fourU8ToU32(c));
    }
    return res;
};

const u8ArrToStr = (u8a: number[]): string => u8a.reduce((a,c,i) => {
  if (i === u8a.length -1) {
    return a;
  }
  const n = (c === 0) ? ";" : String.fromCharCode(c);
  return `${a}${n}`;
}, "");

// some props are simple strings
const getStringProp = (n: DTNode, pname: string): string | undefined => {
  const p = n.props.find((p: DTProp) => p[0] === pname);
  if (p) {
    return u8ArrToStr(p[1]);
  }
};

// many props are just numbers
const getProp = (n: DTNode, pname: string): number[] | null => {
  const p = n.props.find((p: DTProp) => p[0] === pname);
  return p ? u8ArrToU32Arr(p[1]) : null;
};

// strings representation of lists of numbers for pretty-printing
const getPropStr = (n: DTNode, pname: string): string | null => {
  const p = getProp(n, pname);
  return p ? p.join(", ") : null;
};

const formatU32Hex = (v: number): string =>
  `0x${v.toString(16).padStart(8, "0")}`;

const formatU8Hex = (v: number): string =>
  `0x${v.toString(16).padStart(2, "0")}`;

const formatHexList = (values: number[], groupSize: number = values.length): string =>
  values
    .map(formatU32Hex)
    .reduce((groups, value, index) => {
      const groupIndex = Math.floor(index / groupSize);
      groups[groupIndex] = groups[groupIndex] || [];
      groups[groupIndex].push(value);
      return groups;
    }, [] as string[][])
    .map((group) => group.join(", "))
    .join("\n");

const getHexPropStr = (n: DTNode, pname: string): string | null => {
  const p = getProp(n, pname);
  return p ? formatHexList(p) : null;
};

const formatStringList = (value: string | undefined): string | undefined =>
  value ? value.split(";").filter(Boolean).join(", ") : undefined;

const looksLikeStringProp = (bytes: number[]): boolean => {
  if (bytes.length === 0) {
    return false;
  }
  return bytes.every((byte) =>
    byte === 0 ||
    byte === 9 ||
    byte === 10 ||
    byte === 13 ||
    (byte >= 32 && byte <= 126)
  );
};

const formatPropValue = (label: string, bytes: number[]): string => {
  if (bytes.length === 0) {
    return "(present)";
  }
  if (looksLikeStringProp(bytes)) {
    const stringValue = formatStringList(u8ArrToStr(bytes));
    if (stringValue) {
      return stringValue;
    }
  }
  if (bytes.length % 4 === 0) {
    const values = u8ArrToU32Arr(bytes);
    const groupSize = label === "reg" ? 2 : values.length;
    return formatHexList(values, groupSize);
  }
  return bytes.map(formatU8Hex).join(", ");
};

const indent = (level: number): string => "  ".repeat(level);

const formatDtsCellValue = (label: string, values: number[], level: number): string => {
  const groupSize = label === "reg" ? 2 : values.length;
  const groups = values.reduce((acc, value, index) => {
    const groupIndex = Math.floor(index / groupSize);
    acc[groupIndex] = acc[groupIndex] || [];
    acc[groupIndex].push(formatU32Hex(value));
    return acc;
  }, [] as string[][]);

  if (groups.length === 1) {
    return `<${groups[0].join(" ")}>`;
  }

  const continuationIndent = `${indent(level)}  `;
  return `<${groups[0].join(" ")}\n${groups
    .slice(1)
    .map((group) => `${continuationIndent}${group.join(" ")}`)
    .join("\n")}>`;
};

const formatDtsPropLine = (label: string, bytes: number[], level: number): string => {
  const prefix = `${indent(level)}${label}`;
  if (bytes.length === 0) {
    return `${prefix};`;
  }

  if (looksLikeStringProp(bytes)) {
    const stringValues = u8ArrToStr(bytes).split(";").filter(Boolean);
    if (stringValues.length > 0) {
      return `${prefix} = ${stringValues.map((value) => JSON.stringify(value)).join(", ")};`;
    }
  }

  if (bytes.length % 4 === 0) {
    return `${prefix} = ${formatDtsCellValue(label, u8ArrToU32Arr(bytes), level + 1)};`;
  }

  return `${prefix} = [${bytes.map((value) => value.toString(16).padStart(2, "0")).join(" ")}];`;
};

const renderDtsSnippet = (node: DTNode, level: number = 0): string => {
  const nodeName = node.name === "root" ? "/" : node.name;
  const lines = [`${indent(level)}${nodeName} {`];

  node.props.forEach(([label, bytes]: DTProp) => {
    lines.push(formatDtsPropLine(label, bytes, level + 1));
  });

  (node.children || []).forEach((child: DTNode) => {
    lines.push(renderDtsSnippet(child, level + 1));
  });

  lines.push(`${indent(level)}};`);
  return lines.join("\n");
};

const inferTone = (name: string, compat?: string): NodeData["tone"] => {
  const nameLc = name.toLowerCase();
  const compatLc = compat?.toLowerCase() || "";

  if (nameLc === "root") {
    return "root";
  }
  if (nameLc.startsWith("cpu") || compatLc.includes("cpu")) {
    return "cpu";
  }
  if (nameLc.includes("memory") || compatLc.includes("memory")) {
    return "memory";
  }
  if (
    nameLc.includes("bus") ||
    compatLc.includes("bus") ||
    compatLc.includes("simple-bus")
  ) {
    return "bus";
  }
  return "device";
};

const toField = (label: string, value?: string): NodeField | null =>
  value ? { label, value } : null;

const buildNodeData = (n: DTNode): NodeData => {
  const [name, addr] = n.name.split("@");
  const address = transformAddr(addr);
  const detailFields = [
    ...(n.rawDetailFields || []),
    toField("children", n.children?.length !== undefined ? String(n.children.length) : undefined),
  ].filter(Boolean) as NodeField[];

  const summaryFields = [
    toField("compatible", n.compat),
    toField("reg", n.reg),
    toField("clock-names", n.cnames),
  ].filter(Boolean) as NodeField[];

  return {
    title: name,
    ...(address ? { address } : null),
    summaryFields,
    detailFields,
    sourceSnippet: n.sourceSnippet || "",
    tone: inferTone(name, n.compat),
  };
};

// transform a node's props into numbers and strings, omitting many
const transformNode = (n: DTNode): DTNode => {
  const name = n.name || "root";
  const rawDetailFields = n.props.map(([label, bytes]: DTProp) => ({
    label,
    value: formatPropValue(label, bytes),
  }));
  const sourceSnippet = renderDtsSnippet(n);
  // phandle is an identifier to the node
  const phandle = getProp(n, "phandle");
  // phy-handle is a ref to another node
  // TODO: make list of props that are refs
  const phyHandle = getProp(n, "phy-handle");
  const phySupply = getProp(n, "phy-supply");
  const resets = getProp(n, "resets");
  const dmas = getProp(n, "dmas");
  const clks = getProp(n, "clocks");
  const cnames = formatStringList(getStringProp(n, "clock-names"));
  const compat = formatStringList(getStringProp(n, "compatible"));
  const regProp = getProp(n, "reg");
  const reg = regProp ? formatHexList(regProp, 2) : null;
  return {
    name,
    ...(phandle ? { phandle: phandle[0] } : null),
    ...(phySupply ? { phySupply: phySupply[0] } : null),
    ...(phyHandle ? { phyHandle: phyHandle[0] } : null),
    ...(resets ? { resets } : null),
    ...(dmas ? { dmas } : null),
    ...(clks ? { clks } : null),
    ...(cnames ? { cnames } : null),
    ...(compat ? { compat } : null),
    ...(reg ? { reg } : null),
    rawDetailFields,
    sourceSnippet,
  };
};

export const transform = (n: DTNode, id: string = "10000") => {
  return {
    ...transformNode(n),
    id,
    children: n.children.map((c: DTNode, i: number) => transform(c, `${id}_${i}`)),
  }
};

const NODE_WIDTH = 300;
const NODE_HEIGHT = 190;

const weightedNode = (node: DTNode): DTNode => {
  if (node.children && node.children.length > 0) {
    let size = 0;
    const cs = node.children.map((c: DTNode) => {
      const wc = weightedNode(c);
      size += wc.size;
      return wc;
    });
    return { ...node, children: cs, size };
  }
  return { ...node, size: 1 };
};

/**
 * Format to hex with leading 0x, padded with zeroes to groups of four digits.
 * At least print 8 digits, but omit the first 4 of 12 if they are all 0.
 */
const transformAddr = (addr: string): string => {
  if (addr === undefined) {
    return "";
  }
  const padded = addr.padStart(12, "0");
  const p1 = padded.substr(0, 4);
  const p2 = padded.substr(4, 4);
  const p3 = padded.substr(8, 4);
  if (p1 === "0000") {
    return `0x${p2}_${p3}`;
  }
  return `0x${p1}_${p2}_${p3}`;
};

// flatten tree to list of nodes, use IDs to define ReactFlow edges
export const getNodesEdges = (tree: DTNode) => {
  const nodes: TransformedNode[] = [];
  const edges: TransformedEdge[] = [];
  const rec = (n: DTNode, d: number = 1, baseX: number = 0, baseY: number = 0) => {
    nodes.push({
      id: n.id,
      type: NodeType.custom,
      position: {
        x: baseX + n.size * NODE_WIDTH / 2,
        y: baseY + d * NODE_HEIGHT,
      },
      data: buildNodeData(n),
    });
    let offset = baseX;
    n.children.forEach((c: DTNode, i: number) => {
      edges.push({
        id: `${n.id}${c.id}`,
        source: n.id,
        target: c.id,
      });
      rec(c, d+1, offset, baseY + n.children.length * 10);
      offset += c.size * NODE_WIDTH;
    });
  };
  const t = weightedNode(tree);
  rec(t);
  return { nodes, edges };
};
