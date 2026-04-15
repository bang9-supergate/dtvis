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
import "./page.module.css"

const nodeTypes = {
  custom: DTNode
};

export default function Home() {
  const [fbuf, setFbuf] = useState<ArrayBuffer | null>(null);
  const [inProgress, setInProgress] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
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
        setNodes(f.nodes);
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

  const fileName = plainFiles.length > 0 ? plainFiles[0].name : "";

  const pending = loading || inProgress;

  const focusNode = useCallback((node: Node<NodeData>) => {
    setSelectedNode(node);
    flow?.fitView({
      nodes: [node],
      duration: 300,
      padding: 1.2,
      minZoom: 0.35,
      maxZoom: 1.2,
    });
  }, [flow]);

  const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node<NodeData>) => {
    focusNode(node);
  }, [focusNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

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
        </aside>
        <div className="flowCanvas">
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
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          min-height: 100vh;
          overflow: hidden;
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
          background-color: #101212;
          border-radius: 7px;
          border-width: 3px;
          padding: 5px 25px;
          display: flex;
          align-items: center;
          gap: 20px;
          font-size: 22px;
        }
        main {
          width: 100%;
          height: clamp(860px, calc(100vh - 132px), 1240px);
          max-height: calc(100vh - 132px);
          display: grid;
          grid-template-columns: 340px minmax(0, 1fr);
          gap: 16px;
          align-items: stretch;
          overflow: hidden;
        }
        .sidePanel {
          min-width: 0;
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
          min-width: 0;
          height: 100%;
          border: 1px solid #1f2937;
          border-radius: 18px;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 28%),
            linear-gradient(180deg, #081018, #0c1420);
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
          height: clamp(520px, 46vh, 720px);
          max-height: clamp(520px, 46vh, 720px);
          overflow: auto;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: rgba(56, 189, 248, 0.55) rgba(15, 23, 42, 0.7);
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
          background: linear-gradient(180deg, rgba(56, 189, 248, 0.78), rgba(14, 116, 144, 0.92));
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.78);
        }
        .nodeList::-webkit-scrollbar-thumb:hover,
        .detailsSection::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(103, 232, 249, 0.92), rgba(8, 145, 178, 0.98));
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
          border-color: #38bdf8;
          background: rgba(14, 116, 144, 0.2);
          box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.2);
        }
        .nodeListName {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
        }
        .nodeListAddr {
          font-family: "Fira Code", monospace;
          font-size: 11px;
          color: #8ea0b5;
        }
        .detailsSection {
          overflow: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(56, 189, 248, 0.55) rgba(15, 23, 42, 0.7);
        }
        .panelName {
          font-size: 24px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 6px;
        }
        .panelAddr {
          font-family: "Fira Code", monospace;
          font-size: 12px;
          color: #8ea0b5;
          margin-bottom: 18px;
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
          font-family: "Fira Code", monospace;
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
            height: auto;
            max-height: none;
            overflow: visible;
          }
          .sidePanel {
            grid-template-rows: auto auto;
          }
          .flowCanvas {
            height: 70vh;
          }
          .panelSection {
            min-height: 220px;
          }
        }
      `}</style>
    </div>
  )
}
