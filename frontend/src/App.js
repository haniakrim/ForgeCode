import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Toaster } from "sonner";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Project from "./pages/Project";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";
import AuthCallback from "./pages/AuthCallback";

function AppRouter() {
  const location = useLocation();
  // Detect session_id synchronously before routing
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><Project /></ProtectedRoute>} />
      <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    document.title = "FORGE — AI Full-Stack Engineer";
  }, []);
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                border: "2px solid #0A0A0A",
                borderRadius: 0,
                boxShadow: "4px 4px 0px #0A0A0A",
                fontFamily: "JetBrains Mono, monospace",
                background: "#fff",
                color: "#0A0A0A",
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
