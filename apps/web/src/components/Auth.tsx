import { useState, useEffect } from "react";
import type { Session } from "@compiler-companion/shared";
import { call } from "../api";

interface AuthProps {
  onSession: (session: Session, remember?: boolean) => void;
  cachedSession?: Session | null;
  onClearCachedSession?: () => void;
}

type AuthMode = "login" | "register" | "forgot-email" | "forgot-code";

export function Auth({ onSession, cachedSession, onClearCachedSession }: AuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [switchingAccount, setSwitchingAccount] = useState(false);

  // Forgot Password / OTP states
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  // Google Sign-In helper modal state
  const [showGoogleDevModal, setShowGoogleDevModal] = useState(false);
  const [googleDevEmail, setGoogleDevEmail] = useState("");
  const [hasGoogleGisBtn, setHasGoogleGisBtn] = useState(false);

  // Countdown timer for code resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Initialize official Google Identity Services button
  useEffect(() => {
    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      "912068008108-25lp4b2cpa64u4e2knblhaui5dhr94tv.apps.googleusercontent.com";

    const interval = setInterval(() => {
      const google = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (cfg: unknown) => void;
              renderButton: (el: HTMLElement, opts: unknown) => void;
            };
          };
        };
      })?.google;

      if (google?.accounts?.id && clientId) {
        clearInterval(interval);
        try {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: { credential?: string }) => {
              if (!response.credential) return;
              setLoading(true);
              try {
                const res = await call<Session>("/auth/google", {
                  method: "POST",
                  body: JSON.stringify({ credential: response.credential }),
                });
                onSession(res, rememberMe);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Google authentication failed.");
              } finally {
                setLoading(false);
              }
            },
          });

          const btnEl = document.getElementById("g-btn-container");
          if (btnEl) {
            btnEl.innerHTML = "";
            google.accounts.id.renderButton(btnEl, {
              theme: "outline",
              size: "large",
              text: "continue_with",
              shape: "rectangular",
              width: 380,
            });
            setHasGoogleGisBtn(true);
          }
        } catch (err) {
          console.warn("[Google GIS Init]", err);
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [mode, rememberMe]);

  // If user has an active/cached session and hasn't clicked "Switch Account"
  if (cachedSession && !switchingAccount) {
    return (
      <main className="auth-shell">
        <div className="auth-glow" />
        <div className="auth-card signed-in-card">
          <div className="auth-mark">◈</div>
          <div className="signed-in-pill">✓ Active Session Detected</div>
          <h2>Welcome Back!</h2>
          <p className="signed-in-lead">You are currently signed in as:</p>
          <div className="user-email-badge">
            <span className="user-avatar">👤</span>
            <span className="email-text">{cachedSession.user.email}</span>
          </div>

          <div className="auth-feature-pills">
            <span>🐳 Docker Sandbox</span>
            <span>🧠 GOAT AI Mentor</span>
            <span>⚡ Monaco Editor</span>
          </div>

          <div className="signed-in-actions">
            <button
              type="button"
              className="run continue-workspace-btn"
              onClick={() => onSession(cachedSession, true)}
            >
              🚀 Continue to Workspace
            </button>
            <button
              type="button"
              className="ghost switch-account-btn"
              onClick={() => {
                setSwitchingAccount(true);
                if (onClearCachedSession) onClearCachedSession();
              }}
            >
              Switch Account / Sign In
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Handle standard Login or Registration
  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const res = await call<Session>(endpoint, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onSession(res, rememberMe);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Step 1: Send verification code to email
  async function handleSendResetCode(event?: React.FormEvent) {
    if (event) event.preventDefault();
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const res = await call<{ ok: boolean; message: string; devPreview?: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setSuccessMessage(res.message);
      if (res.devPreview) {
        setDevCodeHint(res.devPreview);
      }
      setResendCooldown(60);
      setMode("forgot-code");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Step 2: Verify code and set new password
  async function handleVerifyResetCode(event: React.FormEvent) {
    event.preventDefault();
    if (verificationCode.trim().length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }
    if (password.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const res = await call<Session & { message?: string }>("/auth/verify-reset-code", {
        method: "POST",
        body: JSON.stringify({
          email,
          code: verificationCode.trim(),
          newPassword: password,
        }),
      });
      onSession(res, rememberMe);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Google OAuth Sign-In
  async function handleGoogleLogin() {
    setError("");
    setSuccessMessage("");

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    // Check if Google Identity Services script is available and client ID configured
    const googleId = (window as unknown as { google?: { accounts?: { id?: { initialize: (cfg: unknown) => void; prompt: () => void } } } })?.google?.accounts?.id;

    if (clientId && googleId) {
      try {
        googleId.initialize({
          client_id: clientId,
          callback: async (response: { credential?: string }) => {
            if (!response.credential) return;
            setLoading(true);
            try {
              const res = await call<Session>("/auth/google", {
                method: "POST",
                body: JSON.stringify({ credential: response.credential }),
              });
              onSession(res, rememberMe);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Google authentication failed.");
            } finally {
              setLoading(false);
            }
          },
        });
        googleId.prompt();
        return;
      } catch (e) {
        console.warn("[Google Sign-In] GIS prompt error:", e);
      }
    }

    // If client ID is not configured yet, open the interactive Google dev testing modal
    setGoogleDevEmail(email || "skt.surajkumartiwari@gmail.com");
    setShowGoogleDevModal(true);
  }

  // Complete Google Test Sign-In
  async function completeGoogleDevLogin() {
    if (!googleDevEmail) return;
    setLoading(true);
    setError("");
    try {
      const res = await call<Session>("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          devProfile: {
            email: googleDevEmail.trim().toLowerCase(),
            name: googleDevEmail.split("@")[0],
          },
        }),
      });
      setShowGoogleDevModal(false);
      onSession(res, rememberMe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed.");
    } finally {
      setLoading(false);
    }
  }

  // 1-Click Demo Guest Access
  async function handleDemoLogin() {
    setError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      const res = await call<Session>("/auth/demo", { method: "POST" });
      onSession(res, rememberMe);
    } catch {
      try {
        const res = await call<Session>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "demo@compiler.local", password: "DemoPassword2026!" }),
        });
        onSession(res, rememberMe);
      } catch {
        try {
          const res = await call<Session>("/auth/register", {
            method: "POST",
            body: JSON.stringify({ email: "demo@compiler.local", password: "DemoPassword2026!" }),
          });
          onSession(res, rememberMe);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Demo login failed.");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-glow" />
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-mark">◈</div>
          <h1>Compiler Companion</h1>
          <p className="auth-subtitle">
            Next-Generation Coding Studio with GOAT AI & Isolated Docker Environments
          </p>

          <div className="auth-feature-pills">
            <span>🐳 Docker Isolated</span>
            <span>🧠 GOAT AI</span>
            <span>⚡ Big-O & Diff</span>
            <span>🧪 Test Suite</span>
          </div>
        </div>

        {/* Tab Switcher - Only Sign In and Create Account (No open reset) */}
        {(mode === "login" || mode === "register") && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessMessage("");
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => {
                setMode("register");
                setError("");
                setSuccessMessage("");
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* 1. Standard Login / Register Forms */}
        {(mode === "login" || mode === "register") && (
          <form onSubmit={submitAuth} className="auth-form">
            {/* Official Google GIS Button Container */}
            <div
              id="g-btn-container"
              style={{
                display: hasGoogleGisBtn ? "flex" : "none",
                justifyContent: "center",
                width: "100%",
                minHeight: "44px",
                marginBottom: "4px",
              }}
            />

            {/* Fallback / Instant Click Button */}
            {!hasGoogleGisBtn && (
              <button
                type="button"
                className="google-btn"
                onClick={handleGoogleLogin}
                disabled={loading}
                title="Sign in securely with your Google account"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}

            <div className="auth-divider">
              <span>OR WITH EMAIL</span>
            </div>

            <div className="form-group">
              <label htmlFor="auth-email">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">✉</span>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="auth-password">Password</label>
                <span className="char-hint">{mode === "login" ? "" : "Min 8 characters"}</span>
              </div>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  minLength={8}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="show-pwd-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? "👁" : "🙈"}
                </button>
              </div>
            </div>

            <div className="form-options-row">
              <label className="remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              {mode === "login" && (
                <button
                  type="button"
                  className="text-link-btn"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-blue, #60a5fa)",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                  onClick={() => {
                    setMode("forgot-email");
                    setError("");
                    setSuccessMessage("");
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>

            {error && <div className="auth-error-box">⚠ {error}</div>}
            {successMessage && (
              <div className="auth-success-box" style={{ color: "#34d399", fontSize: "13px" }}>
                ✓ {successMessage}
              </div>
            )}

            <button type="submit" className="run auth-submit-btn" disabled={loading}>
              {loading ? (
                <span>⋯ {mode === "login" ? "Signing in…" : "Creating workspace…"}</span>
              ) : mode === "login" ? (
                "Sign In →"
              ) : (
                "Create Free Account →"
              )}
            </button>
          </form>
        )}

        {/* 2. Forgot Password - Step 1: Request Verification Code */}
        {mode === "forgot-email" && (
          <form onSubmit={handleSendResetCode} className="auth-form">
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <h2 style={{ fontSize: "18px", margin: "0 0 6px 0", color: "#f8fafc" }}>
                Reset Your Password
              </h2>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
                Enter your account email to receive a secure 6-digit verification code.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="reset-email">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">✉</span>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {error && <div className="auth-error-box">⚠ {error}</div>}
            {successMessage && (
              <div className="auth-success-box" style={{ color: "#34d399", fontSize: "13px" }}>
                ✓ {successMessage}
              </div>
            )}

            <button type="submit" className="run auth-submit-btn" disabled={loading}>
              {loading ? "⋯ Sending Code…" : "Send Verification Code →"}
            </button>

            <button
              type="button"
              className="ghost"
              style={{ padding: "8px", fontSize: "13px", marginTop: "4px" }}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessMessage("");
              }}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* 3. Forgot Password - Step 2: Enter Code & New Password */}
        {mode === "forgot-code" && (
          <form onSubmit={handleVerifyResetCode} className="auth-form">
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <h2 style={{ fontSize: "18px", margin: "0 0 6px 0", color: "#f8fafc" }}>
                Verify & Reset Password
              </h2>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
                We sent a 6-digit code to <strong>{email}</strong>.
              </p>
            </div>

            {devCodeHint && (
              <div className="auth-hint-pill">
                <span>💡 Dev Code Hint: <strong>{devCodeHint}</strong></span>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#6ee7b7", cursor: "pointer", textDecoration: "underline", fontSize: "11px" }}
                  onClick={() => setVerificationCode(devCodeHint)}
                >
                  Auto-fill
                </button>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="reset-code">6-Digit Verification Code</label>
              <input
                id="reset-code"
                type="text"
                className="otp-input"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="new-password">New Password</label>
                <span className="char-hint">Min 8 characters</span>
              </div>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="show-pwd-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? "👁" : "🙈"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <button
                type="button"
                className="resend-btn"
                disabled={resendCooldown > 0 || loading}
                onClick={() => handleSendResetCode()}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px" }}
                onClick={() => {
                  setMode("forgot-email");
                  setError("");
                }}
              >
                Change email
              </button>
            </div>

            {error && <div className="auth-error-box">⚠ {error}</div>}
            {successMessage && (
              <div className="auth-success-box" style={{ color: "#34d399", fontSize: "13px" }}>
                ✓ {successMessage}
              </div>
            )}

            <button type="submit" className="run auth-submit-btn" disabled={loading}>
              {loading ? "⋯ Verifying…" : "Reset Password & Sign In →"}
            </button>

            <button
              type="button"
              className="ghost"
              style={{ padding: "8px", fontSize: "13px", marginTop: "4px" }}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessMessage("");
              }}
            >
              ← Cancel & Back to Sign In
            </button>
          </form>
        )}

        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* 1-Click Demo Guest Access */}
        <button
          type="button"
          className="demo-guest-btn"
          onClick={handleDemoLogin}
          disabled={loading}
          title="Jump directly into the workspace with a pre-configured guest account"
        >
          🚀 Quick Guest Demo (1-Click Instant Access)
        </button>
      </div>

      {/* Google Sign-In Setup & Test Modal */}
      {showGoogleDevModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#151a26",
              border: "1px solid #273147",
              borderRadius: "14px",
              padding: "26px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <svg width="22" height="22" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
              </svg>
              <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "18px" }}>Google Sign-In</h3>
            </div>

            <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.5", marginBottom: "16px" }}>
              To enable live Google OAuth in production, add your Google OAuth Client ID to your <code>.env</code> file:
              <br />
              <code style={{ display: "block", background: "#090d16", padding: "6px 10px", borderRadius: "6px", marginTop: "6px", color: "#38bdf8" }}>
                VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
              </code>
            </p>

            <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "#c7d2fe", fontWeight: 600, marginBottom: "4px" }}>
                ⚡ Instant Dev Google Login:
              </div>
              <div style={{ fontSize: "12px", color: "#a5b4fc", marginBottom: "8px" }}>
                Test your application right now by signing in as a Google user:
              </div>
              <input
                type="email"
                value={googleDevEmail}
                onChange={(e) => setGoogleDevEmail(e.target.value)}
                placeholder="developer@gmail.com"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "#090d16",
                  border: "1px solid #374151",
                  color: "#ffffff",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="ghost"
                style={{ padding: "8px 14px", fontSize: "13px" }}
                onClick={() => setShowGoogleDevModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="run"
                style={{ padding: "8px 16px", fontSize: "13px" }}
                onClick={completeGoogleDevLogin}
                disabled={loading}
              >
                {loading ? "⋯ Signing in…" : "🚀 Continue as Google User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
