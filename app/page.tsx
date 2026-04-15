"use client";
import Image from "next/image"
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  addEdge,
  Background,
  Node,
  ReactFlowInstance,
} from "reactflow";
import { useFilePicker } from "use-file-picker";
import { NodeData, transform, getNodesEdges } from "./lib";
import DTNode from "./DTNode";

const nodeTypes = {
  custom: DTNode
};

export default function Home() {
  const [fbuf, setFbuf] = useState<ArrayBuffer | null>(null);
  const [inProgress, setInProgress] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  const { openFilePicker, filesContent, loading, errors, plainFiles } =
    useFilePicker({
      multiple: false,
      readAs: "ArrayBuffer",
      maxFileSize: 1, // megabytes
    });
  
  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const parseDtb = async(data: Uint8Array) => {
    setInProgress(true);
    setTimeout(async () => {
      try {
        // TODO: only do this once
        const parser = await import("../parser/pkg");
        const res = await parser.parse_dtb([...data]);
        const tree = transform(res.root);
        const f = getNodesEdges(tree);
        const initialNodeId = f.nodes[0]?.id;
        setNodes(
          f.nodes.map((node) => ({
            ...node,
            selected: node.id === initialNodeId,
          }))
        );
        setEdges(f.edges);
        setSelectedNode(f.nodes[0] || null);
      } catch (e) {
        console.error(e);
        // setError((errors || []).concat(e));
      } finally {
        console.info("DONE:", new Date());
        setInProgress(false);
      }
    }, 100);
  };

  /*
  */
  const reanalyze = useCallback(() => {
    if (fbuf) {
      parseDtb(new Uint8Array(fbuf));
    }
  }, [fbuf]);

  useEffect(() => {
      reanalyze();
  }, [reanalyze]);

  useEffect(() => {
    if (filesContent.length) {
      const f = filesContent[0].content;
      setFbuf(f);
    }
  }, [filesContent]);

  useEffect(() => {
    if (!selectedNode) {
      setShowSourcePanel(false);
    }
  }, [selectedNode]);

  const fileName = plainFiles.length > 0 ? plainFiles[0].name : "";

  const pending = loading || inProgress;

  const focusNode = useCallback((node: Node<NodeData>) => {
    setSelectedNode(node);
    setNodes((currentNodes) =>
      currentNodes.map((currentNode) => ({
        ...currentNode,
        selected: currentNode.id === node.id,
      }))
    );
    setEdges((currentEdges) =>
      currentEdges.map((edge) =>
        edge.selected ? { ...edge, selected: false } : edge
      )
    );
    flow?.fitView({
      nodes: [node],
      duration: 300,
      padding: 1.2,
      minZoom: 0.35,
      maxZoom: 1.2,
    });
  }, [flow, setEdges, setNodes]);

  const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node<NodeData>) => {
    focusNode(node);
  }, [focusNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.selected ? { ...node, selected: false } : node
      )
    );
    setEdges((currentEdges) =>
      currentEdges.map((edge) =>
        edge.selected ? { ...edge, selected: false } : edge
      )
    );
  }, [setEdges, setNodes]);

  const filteredNodes = nodes.filter((node) => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) {
      return true;
    }
    const haystack = [
      node.data.title,
      node.data.address,
      ...node.data.detailFields.map((field) => `${field.label} ${field.value}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  return (
    <div className="layout">
      <header>
        <Image
          alt="Device Tree logo"
          src="/dtvis/devicetree-logo.svg"
          width={50}
          height={50}
          style={{ background: "#b0b0b0" }}
        />
        <h1>dtvis</h1>
        <menu>
          <button className="loadButton" disabled={pending} onClick={openFilePicker}>
            {pending ? "..." : "Load DTB"}
          </button>
        </menu>
        {fileName && <span>File: {fileName}</span>}
        {nodes.length > 0 && <span>Nodes: {nodes.length}</span>}
      </header>
      <main>
        <aside className="sidePanel">
          <div className="panelSection">
            <div className="panelTitle">Nodes</div>
            <input
              className="searchInput"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, address, compatible..."
            />
            <div className="nodeListMeta">
              {filteredNodes.length} / {nodes.length}
            </div>
            <div className="nodeList">
              {filteredNodes.map((node) => {
                const active = node.id === selectedNode?.id;
                return (
                  <button
                    key={node.id}
                    className={`nodeListItem ${active ? "active" : ""}`}
                    onClick={() => focusNode(node)}
                  >
                    <span className="nodeListName">{node.data.title}</span>
                    {node.data.address && (
                      <span className="nodeListAddr">{node.data.address}</span>
                    )}
                  </button>
                );
              })}
              {filteredNodes.length === 0 && (
                <div className="panelEmpty">No nodes match this filter.</div>
              )}
            </div>
          </div>
          <div className="panelSection detailsSection">
            <div className="panelTitle">Node Details</div>
            <div className="detailScroll">
              {selectedNode ? (
                <>
                  <div className="panelName">{selectedNode.data.title}</div>
                  {selectedNode.data.address && (
                    <div className="panelAddr">{selectedNode.data.address}</div>
                  )}
                  <div className="panelFields">
                    {selectedNode.data.detailFields.map((field) => (
                      <div key={field.label} className="panelField">
                        <div className="panelFieldLabel">{field.label}</div>
                        <div className="panelFieldValue">{field.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="panelEmpty">
                  Select a node from the graph or the list.
                </div>
              )}
            </div>
          </div>
        </aside>
        <div className="flowCanvas">
          <button
            className="sourceToggle"
            type="button"
            disabled={!selectedNode}
            aria-label="Toggle DTS source panel"
            title="View DTS source"
            onClick={() => setShowSourcePanel((open) => !open)}
          >
            {"</>"}
          </button>
          {showSourcePanel && selectedNode && (
            <div className="sourcePanel">
              <div className="sourcePanelHeader">
                <div>
                  <div className="sourcePanelTitle">DTS Source</div>
                  <div className="sourcePanelNode">{selectedNode.data.title}</div>
                </div>
                <button
                  className="sourceClose"
                  type="button"
                  aria-label="Close DTS source panel"
                  onClick={() => setShowSourcePanel(false)}
                >
                  x
                </button>
              </div>
              <pre className="sourceCode">{selectedNode.data.sourceSnippet}</pre>
            </div>
          )}
          <ReactFlow
            {...{
              nodes,
              edges,
              nodeTypes,
              onNodesChange,
              onEdgesChange,
              onConnect,
              onNodeClick,
              onPaneClick,
              onInit: setFlow,
            }}
            fitView
            minZoom={0.1}
          >
            <Background color="#1e293b" gap={24} size={1} />
            <MiniMap
              pannable
              zoomable
              style={{ background: "#0b1117", border: "1px solid #1f2937" }}
            />
            <Controls />
          </ReactFlow>
        </div>
      </main>
      <style jsx>{`
        .layout {
          --accent: #2b3ddc;
          --accent-rgb: 43, 61, 220;
          --accent-deep: #1f2ea8;
          --accent-soft: #aeb8ff;
          height: 100vh;
          height: 100dvh;
          min-height: 100vh;
          min-height: 100dvh;
          box-sizing: border-box;
          font-family: "Pretendard Variable", "SUIT Variable", "Noto Sans KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          align-items: stretch;
          padding: 20px;
          gap: 16px;
          overflow: hidden;
        }
        button,
        input {
          font: inherit;
        }
        header {
          width: 100%;
          min-height: 72px;
          display: flex;
          justify-content: flex-start;
          align-items: center;
          gap: 15px;
          padding: 0 20px;
          flex-wrap: wrap;
        }
        .loadButton {
          border: 1px solid rgba(var(--accent-rgb), 0.42);
          border-radius: 12px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-width: 140px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #eff6ff;
          background:
            linear-gradient(135deg, rgba(var(--accent-rgb), 0.96), rgba(31, 46, 168, 0.98)),
            linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(8, 15, 24, 0.96));
          box-shadow:
            inset 0 1px 0 rgba(224, 231, 255, 0.18),
            0 10px 24px rgba(var(--accent-rgb), 0.22);
          transition:
            transform 140ms ease,
            box-shadow 140ms ease,
            border-color 140ms ease,
            filter 140ms ease;
        }
        .loadButton:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(var(--accent-rgb), 0.74);
          box-shadow:
            inset 0 1px 0 rgba(224, 231, 255, 0.24),
            0 14px 30px rgba(var(--accent-rgb), 0.28);
          filter: brightness(1.05);
        }
        .loadButton:active:not(:disabled) {
          transform: translateY(0);
          box-shadow:
            inset 0 1px 0 rgba(224, 231, 255, 0.14),
            0 8px 18px rgba(var(--accent-rgb), 0.22);
        }
        .loadButton:disabled {
          cursor: wait;
          color: rgba(226, 232, 240, 0.82);
          border-color: rgba(71, 85, 105, 0.55);
          background:
            linear-gradient(180deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.96));
          box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.08);
          filter: saturate(0.75);
        }
        main {
          width: 100%;
          height: 100%;
          min-height: 0;
          display: grid;
          grid-template-columns: 340px minmax(0, 1fr);
          gap: 16px;
          align-items: stretch;
          overflow: hidden;
        }
        .sidePanel {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
        }
        .panelSection {
          border: 1px solid #1f2937;
          border-radius: 18px;
          background: linear-gradient(180deg, #0c1420, #0b1017);
          padding: 18px;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .flowCanvas {
          position: relative;
          min-width: 0;
          min-height: 0;
          height: 100%;
          border: 1px solid #1f2937;
          border-radius: 18px;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.1), transparent 28%),
            linear-gradient(180deg, #081018, #0c1420);
        }
        .flowCanvas :global(.react-flow) {
          height: 100%;
          border-radius: inherit;
          background: transparent;
        }
        .flowCanvas :global(.react-flow__renderer),
        .flowCanvas :global(.react-flow__pane),
        .flowCanvas :global(.react-flow__viewport) {
          border-radius: inherit;
        }
        .flowCanvas :global(.react-flow__background) {
          border-radius: inherit;
        }
        .flowCanvas :global(.react-flow__edge.selected .react-flow__edge-path),
        .flowCanvas :global(.react-flow__edge:focus .react-flow__edge-path) {
          stroke: #475569;
        }
        .sourceToggle {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 6;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid rgba(var(--accent-rgb), 0.34);
          background: rgba(8, 15, 24, 0.9);
          color: #d9f4ff;
          font-family: ui-monospace, "SFMono-Regular", "Cascadia Code", "JetBrains Mono", monospace;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
          transition:
            transform 140ms ease,
            border-color 140ms ease,
            background 140ms ease,
            color 140ms ease;
        }
        .sourceToggle:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(var(--accent-rgb), 0.72);
          background: rgba(var(--accent-rgb), 0.16);
          color: #f0f9ff;
        }
        .sourceToggle:disabled {
          cursor: not-allowed;
          color: rgba(148, 163, 184, 0.68);
          border-color: rgba(71, 85, 105, 0.42);
          background: rgba(15, 23, 42, 0.88);
          box-shadow: none;
        }
        .sourcePanel {
          position: absolute;
          top: 62px;
          right: 16px;
          z-index: 6;
          width: min(460px, calc(100% - 32px));
          max-height: calc(100% - 78px);
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(var(--accent-rgb), 0.24);
          border-radius: 16px;
          overflow: hidden;
          background: rgba(7, 12, 18, 0.96);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(16px);
        }
        .sourcePanelHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px 12px;
          border-bottom: 1px solid rgba(30, 41, 59, 0.88);
          background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.16), rgba(15, 23, 42, 0.16));
        }
        .sourcePanelTitle {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 4px;
        }
        .sourcePanelNode {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
        }
        .sourceClose {
          width: 28px;
          height: 28px;
          border-radius: 9px;
          border: 1px solid rgba(71, 85, 105, 0.72);
          background: rgba(15, 23, 42, 0.86);
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1;
        }
        .sourceCode {
          margin: 0;
          padding: 16px;
          overflow: auto;
          font-family: ui-monospace, "SFMono-Regular", "Cascadia Code", "JetBrains Mono", monospace;
          font-size: 12px;
          line-height: 1.65;
          color: #dbeafe;
          white-space: pre;
          scrollbar-width: thin;
          scrollbar-color: rgba(var(--accent-rgb), 0.55) rgba(15, 23, 42, 0.7);
        }
        .sourceCode::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .sourceCode::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.72);
        }
        .sourceCode::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.78), rgba(31, 46, 168, 0.92));
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.78);
        }
        .panelTitle {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7f8ea3;
          margin-bottom: 12px;
        }
        .searchInput {
          width: 100%;
          border-radius: 10px;
          border: 1px solid #243041;
          background: rgba(8, 15, 24, 0.9);
          color: #e2e8f0;
          padding: 10px 12px;
          font-size: 13px;
          margin-bottom: 10px;
          outline: none;
        }
        .searchInput::placeholder {
          color: #6b7a90;
        }
        .nodeListMeta {
          font-size: 12px;
          color: #7f8ea3;
          margin-bottom: 10px;
        }
        .nodeList {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 0;
          flex: 1;
          overflow: auto;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(var(--accent-rgb), 0.55) rgba(15, 23, 42, 0.7);
        }
        .nodeList::-webkit-scrollbar,
        .detailsSection::-webkit-scrollbar {
          width: 10px;
        }
        .nodeList::-webkit-scrollbar-track,
        .detailsSection::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.72);
          border-radius: 999px;
        }
        .nodeList::-webkit-scrollbar-thumb,
        .detailsSection::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.78), rgba(31, 46, 168, 0.92));
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.78);
        }
        .nodeList::-webkit-scrollbar-thumb:hover,
        .detailsSection::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(122, 138, 255, 0.92), rgba(43, 61, 220, 0.98));
        }
        .nodeListItem {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(15, 23, 42, 0.55);
          color: inherit;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .nodeListItem.active {
          border-color: var(--accent);
          background: rgba(var(--accent-rgb), 0.16);
          box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), 0.22);
        }
        .nodeListName {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
        }
        .nodeListAddr {
          font-size: 11px;
          color: #8ea0b5;
          letter-spacing: 0.01em;
        }
        .detailsSection {
          min-height: 0;
          overflow: hidden;
        }
        .detailScroll {
          min-height: 0;
          flex: 1;
          overflow: auto;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(var(--accent-rgb), 0.55) rgba(15, 23, 42, 0.7);
        }
        .detailScroll::-webkit-scrollbar {
          width: 10px;
        }
        .detailScroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.72);
          border-radius: 999px;
        }
        .detailScroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.78), rgba(31, 46, 168, 0.92));
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.78);
        }
        .detailScroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(122, 138, 255, 0.92), rgba(43, 61, 220, 0.98));
        }
        .panelName {
          font-size: 24px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 6px;
        }
        .panelAddr {
          font-size: 12px;
          color: #8ea0b5;
          margin-bottom: 18px;
          letter-spacing: 0.01em;
        }
        .panelFields {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .panelField {
          padding: 12px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.12);
        }
        .panelFieldLabel {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #7f8ea3;
          margin-bottom: 6px;
        }
        .panelFieldValue {
          font-size: 12px;
          color: #e2e8f0;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .panelEmpty {
          color: #8ea0b5;
          font-size: 14px;
          line-height: 1.6;
          margin-top: 10px;
        }
        @media (max-width: 1100px) {
          main {
            grid-template-columns: 1fr;
            overflow: auto;
          }
          .sidePanel {
            grid-template-rows: auto auto;
          }
          .flowCanvas {
            min-height: 70vh;
          }
          .panelSection {
            min-height: 220px;
          }
        }
      `}</style>
    </div>
  )
}
