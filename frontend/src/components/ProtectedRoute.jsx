import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="brut bg-white p-8 font-mono text-sm uppercase tracking-widest">
          <span className="caret">Authenticating</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
};
