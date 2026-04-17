import { Sandpack } from "@codesandbox/sandpack-react";
import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * Multi-file Sandpack preview. Only mounts JS/JSX/TS/TSX/CSS/JSON/HTML files.
 * Editor is hidden via CSS; only the preview pane is shown.
 */
export const SandpackPreview = ({ codeBlocks = [] }) => {
  const { theme } = useTheme();

  const files = useMemo(() => {
    const out = {};
    let hasApp = false;
    codeBlocks.forEach((b, i) => {
      const lang = (b.lang || "").toLowerCase();
      if (["jsx", "tsx", "js", "ts", "css", "json", "html"].indexOf(lang) === -1) return;
      let path = b.file || "";
      if (!path) {
        const ext = { jsx: "jsx", tsx: "tsx", js: "js", ts: "ts", css: "css", json: "json", html: "html" }[lang] || "js";
        path = `snippet-${i + 1}.${ext}`;
      }
      if (!path.startsWith("/")) path = "/" + path;
      path = path.replace(/\/frontend\/src\//, "/src/");
      if (!path.startsWith("/src/") && !path.startsWith("/public/") && path !== "/package.json") {
        path = "/src/" + path.replace(/^\//, "");
      }
      out[path] = { code: b.value };
      if (/^\/src\/App\.(jsx|tsx|js|ts)$/.test(path)) hasApp = true;
    });

    if (!Object.keys(out).some((p) => p.startsWith("/src/index."))) {
      out["/src/index.js"] = {
        code: `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
createRoot(document.getElementById("root")).render(<App />);`,
        hidden: true,
      };
    }
    if (!Object.keys(out).some((p) => p === "/src/styles.css")) {
      out["/src/styles.css"] = {
        code: `body{margin:0;font-family:ui-sans-serif,system-ui;background:#fafafa;color:#0a0a0a}`,
        hidden: true,
      };
    }
    if (!hasApp) {
      out["/src/App.js"] = {
        code: `export default function App(){return <div style={{padding:24,fontFamily:'ui-monospace',lineHeight:1.6}}><h2 style={{marginBottom:8}}>Awaiting files.</h2><p>Ask Forge to generate a React component — it'll render live here.</p></div>;}`,
        hidden: true,
      };
    }
    return out;
  }, [codeBlocks]);

  const hasUserFiles = Object.values(files).some((f) => !f.hidden);

  if (!hasUserFiles) {
    return (
      <div className="flex items-center justify-center h-full p-10 bg-[var(--ide-bg)]">
        <div className="max-w-sm text-center">
          <div className="overline">idle</div>
          <div className="serif mt-3 text-3xl italic-serif text-[var(--ide-text)]">Awaiting files</div>
          <div className="mt-3 text-sm text-[var(--text-2)]">Describe your app — Forge will generate React code and mount it here live.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sandpack-preview-wrap h-full w-full" data-testid="sandpack-preview">
      <Sandpack
        template="react"
        files={files}
        theme={theme === "daylight" ? "light" : "dark"}
        options={{
          showTabs: false,
          showLineNumbers: false,
          showNavigator: false,
          showInlineErrors: true,
          editorWidthPercentage: 0,
          editorHeight: "100%",
        }}
        customSetup={{
          dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        }}
      />
    </div>
  );
};
