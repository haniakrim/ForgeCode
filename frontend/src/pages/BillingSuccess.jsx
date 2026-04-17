import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Navbar } from "../components/Navbar";
import { CheckCircle2, XCircle, Loader2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("polling"); // polling | paid | failed | expired
  const [creditsAdded, setCreditsAdded] = useState(0);
  const { refresh } = useAuth();
  const attemptsRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) { navigate("/billing"); return; }

    const poll = async () => {
      if (attemptsRef.current >= 8) {
        setStatus("expired");
        toast.error("Payment verification timed out");
        return;
      }
      attemptsRef.current += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") {
          setStatus("paid");
          setCreditsAdded(data.credits_added || 0);
          refresh();
          return;
        }
        if (data.status === "expired") { setStatus("expired"); return; }
        setTimeout(poll, 2000);
      } catch {
        setTimeout(poll, 2500);
      }
    };
    poll();
    // eslint-disable-next-line
  }, [sessionId]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-[700px] px-6 md:px-10 py-20 text-center">
        {status === "polling" && (
          <div className="glass rounded-3xl p-12" data-testid="billing-success-polling">
            <Loader2 className="mx-auto h-10 w-10 text-[var(--brand)] animate-spin" strokeWidth={1.5} />
            <div className="overline mt-6">Verifying</div>
            <h1 className="serif mt-3 text-4xl italic-serif">Confirming your payment<span className="caret"></span></h1>
            <p className="mt-3 text-[var(--text-2)]">This usually takes a few seconds.</p>
          </div>
        )}
        {status === "paid" && (
          <div className="glass rounded-3xl p-12" data-testid="billing-success-paid">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--emerald)]" strokeWidth={1.3} />
            <div className="overline mt-6">Confirmed</div>
            <h1 className="serif mt-3 text-5xl" style={{ fontWeight: 500 }}>
              Thank you. <span className="italic-serif gradient-text">Welcome aboard.</span>
            </h1>
            {creditsAdded > 0 && (
              <p className="mt-4 text-[var(--text-2)]">
                <span className="serif text-3xl text-[var(--brand)]">{creditsAdded}</span> credits have been added to your account.
              </p>
            )}
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link to="/dashboard" className="btn btn-primary">Back to studio <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} /></Link>
              <Link to="/settings" className="btn btn-ghost">View settings</Link>
            </div>
          </div>
        )}
        {(status === "expired" || status === "failed") && (
          <div className="glass rounded-3xl p-12" data-testid="billing-success-failed">
            <XCircle className="mx-auto h-12 w-12 text-[var(--brand)]" strokeWidth={1.3} />
            <div className="overline mt-6">Incomplete</div>
            <h1 className="serif mt-3 text-4xl italic-serif">We couldn&apos;t verify your payment.</h1>
            <p className="mt-3 text-[var(--text-2)]">No charge was applied. Try again or contact support if this persists.</p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link to="/billing" className="btn btn-primary">Back to billing</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
