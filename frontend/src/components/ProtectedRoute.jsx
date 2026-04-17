import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div className="glass rounded-2xl px-8 py-6 mono text-sm text-[var(--text-2)]">
          <span className="caret">Authenticating</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
};
