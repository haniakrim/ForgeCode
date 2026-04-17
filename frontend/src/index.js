import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
// StrictMode disabled — its synthetic unmount-remount conflicts with long-lived
// WebSocket/Yjs connections in Project workspace. Prod build already single-mounts.
root.render(<App />);
