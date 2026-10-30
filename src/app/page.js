"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  LockKeyhole,
  UserRound,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Shield,
  ChevronRight,
} from "lucide-react";

const quotes = [
  "Great things are done by a series of small things brought together.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Your future is created by what you do today.",
  "Believe in progress, not perfection.",
  "Stay focused. Stay consistent. Keep building."
];


function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <ShieldCheck size={22} strokeWidth={2} />
      </div>
      <span>AUTH<span className="brand-highlight">FLOW</span></span>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  icon,
  showPassword = false,
  onTogglePassword
}) {
  return (
    <div className="field-group">
      <label htmlFor={name}>{label}</label>

      <div className="input-wrapper">
        <span className="input-icon">{icon}</span>

        <input
          id={name}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          autoComplete={
            name === "password"
              ? "current-password"
              : name === "email"
              ? "email"
              : "name"
          }
        />

        {name === "password" && (
          <button
            type="button"
            className="password-toggle"
            onClick={onTogglePassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <><EyeOff size={16} /> Hide</> : <><Eye size={16} /> Show</>}
          </button>
        )}
      </div>
    </div>
  );
}

function Alert({ message, messageType }) {
  if (!message) return null;

  return (
    <div className={`alert ${messageType}`} role="status" aria-live="polite">
      <span>
        {messageType === "success"
          ? <CheckCircle2 size={17} />
          : <Shield size={17} />}
      </span>
      {message}
    </div>
  );
}

function Button({ children, loading }) {
  return (
    <button
      className="primary-button"
      type="submit"
      disabled={loading}
    >
      {loading ? <span className="loader" /> : children}
      {!loading && <ArrowRight size={19} />}
    </button>
  );
}

export default function Home() {
  const [screen, setScreen] = useState("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    code: ""
  });

  const [user, setUser] = useState(null);

  const [quote, setQuote] = useState(quotes[0]);

  function notify(text, type = "error") {
    setMessage(text);
    setMessageType(type);
  }

  function updateField(e) {
    const { name, value } = e.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  }

  async function requestAPI(url, data, method = "POST") {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      ...(data ? { body: JSON.stringify(data) } : {})
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Something went wrong.");
    }

    return result;
  }

  async function checkSession() {
    try {
      const result = await requestAPI(
        "/api/auth/me",
        null,
        "GET"
      );

      if (result.success) {
        setUser(result.user);
        setScreen("dashboard");
      }
    } catch {
      setScreen("login");
    }
  }

  useEffect(() => {
    checkSession();
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  async function register(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await requestAPI(
        "/api/auth/register",
        {
          fullName: form.fullName,
          email: form.email,
          password: form.password
        }
      );

      notify(result.message, "success");
      setScreen("verify-email");

    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmail(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await requestAPI(
        "/api/auth/verify-email",
        {
          email: form.email,
          code: form.code
        }
      );

      notify(result.message, "success");
      setForm({
        ...form,
        code: "",
        password: ""
      });

      setScreen("login");

    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await requestAPI(
        "/api/auth/login",
        {
          email: form.email,
          password: form.password
        }
      );

      notify(result.message, "success");
      setScreen("verify-login");

    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await requestAPI(
        "/api/auth/verify-login",
        {
          email: form.email,
          code: form.code
        }
      );

      if (result.success) {
        await checkSession();
        notify("Welcome back! Login successful.", "success");
      }

    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);

    try {
      await requestAPI("/api/auth/logout", {});
      setUser(null);

      setForm({
        fullName: "",
        email: "",
        password: "",
        code: ""
      });

      setScreen("login");
      notify("You have logged out successfully.", "success");

    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  function changeScreen(nextScreen) {
    setMessage("");
    setScreen(nextScreen);
  }

  return (
    <main className="app-shell">

      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      <header className="topbar">
        <Brand />

        <div className="topbar-right">
          <span className="secure-indicator">
            <span></span>
            SECURE PLATFORM
          </span>
        </div>
      </header>

      {screen !== "dashboard" ? (

        <section className="auth-layout">

          <div className="hero-panel">

            <div className="hero-badge">
              <span></span> YOUR SECURITY, REIMAGINED
            </div>

            <h1>
              A smarter way
              <br />
              to manage your
              <br />
              <span>digital identity.</span>
            </h1>

            <p>
              Experience seamless authentication,
              advanced account protection and a
              better way to stay connected.
            </p>

            <div className="feature-list">

              <div className="feature-item">
                <div className="feature-icon"><ShieldCheck size={21} /></div>
                <div>
                  <strong>Advanced Security</strong>
                  <small>Protection designed around you.</small>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon"><Mail size={21} /></div>
                <div>
                  <strong>Email Verification</strong>
                  <small>Secure access with one-time codes.</small>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon"><LayoutDashboard size={21} /></div>
                <div>
                  <strong>Personal Dashboard</strong>
                  <small>Your account, beautifully organized.</small>
                </div>
              </div>

            </div>

            <div className="hero-footer">
              AUTHFLOW TECHNOLOGY
              <span>BUILT FOR A BETTER DIGITAL EXPERIENCE</span>
            </div>

          </div>

          <div className="auth-panel">

            <div className="auth-card">

              <Brand />

              {screen === "login" && (
                <>
                  <div className="form-heading">
                    <div className="step-label">WELCOME BACK</div>
                    <h2>Sign in to your account</h2>
                    <p>Enter your details to continue.</p>
                  </div>

                  <Alert message={message} messageType={messageType} />

                  <form onSubmit={login}>

                    <Field
                      label="Email address"
                      name="email"
                      value={form.email}
                      onChange={updateField}
                      type="email"
                      placeholder="name@example.com"
                      icon={<Mail size={18} />}
                    />

                    <Field
                      label="Password"
                      name="password"
                      value={form.password}
                      onChange={updateField}
                      showPassword={showPassword}
                      onTogglePassword={() => setShowPassword((current) => !current)}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      icon={<LockKeyhole size={18} />}
                    />

                    <Button loading={loading}>Continue securely</Button>

                  </form>

                  <div className="form-switch">
                    Don't have an account?
                    <button onClick={() => changeScreen("register")}>
                      Create account
                    </button>
                  </div>
                </>
              )}

              {screen === "register" && (
                <>
                  <div className="form-heading">
                    <div className="step-label">GET STARTED</div>
                    <h2>Create your account</h2>
                    <p>Join us and experience smarter security.</p>
                  </div>

                  <Alert message={message} messageType={messageType} />

                  <form onSubmit={register}>

                    <Field
                      label="Full name"
                      name="fullName"
                      value={form.fullName}
                      onChange={updateField}
                      placeholder="Your full name"
                      icon={<UserRound size={18} />}
                    />

                    <Field
                      label="Email address"
                      name="email"
                      value={form.email}
                      onChange={updateField}
                      type="email"
                      placeholder="name@example.com"
                      icon={<Mail size={18} />}
                    />

                    <Field
                      label="Create password"
                      name="password"
                      value={form.password}
                      onChange={updateField}
                      showPassword={showPassword}
                      onTogglePassword={() => setShowPassword((current) => !current)}
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      icon={<LockKeyhole size={18} />}
                    />

                    <Button loading={loading}>Create account</Button>

                  </form>

                  <div className="form-switch">
                    Already have an account?
                    <button onClick={() => changeScreen("login")}>
                      Sign in
                    </button>
                  </div>
                </>
              )}

              {(screen === "verify-email" ||
                screen === "verify-login") && (

                <>
                  <div className="otp-illustration"><ShieldCheck size={34} /></div>

                  <div className="form-heading">
                    <div className="step-label">SECURITY VERIFICATION</div>

                    <h2>
                      {screen === "verify-email"
                        ? "Verify your email"
                        : "Verify your identity"}
                    </h2>

                    <p>
                      We've sent a six-digit verification
                      code to <strong>{form.email}</strong>.
                      Enter it below to continue.
                    </p>
                  </div>

                  <Alert message={message} messageType={messageType} />

                  <form
                    onSubmit={
                      screen === "verify-email"
                        ? verifyEmail
                        : verifyLogin
                    }
                  >

                    <div className="field-group">
                      <label>Six-digit verification code</label>

                      <input
                        className="otp-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        pattern="[0-9]{6}"
                        name="code"
                        value={form.code}
                        onChange={(e) =>
                          setForm((currentForm) => ({
                            ...currentForm,
                            code: e.target.value.replace(/\D/g, "")
                          }))
                        }
                        placeholder="000000"
                        required
                      />
                    </div>

                    <Button loading={loading}>Verify and continue</Button>

                  </form>

                  <div className="form-switch">
                    Wrong email?
                    <button onClick={() => changeScreen("login")}>
                      Go back
                    </button>
                  </div>

                  <div className="otp-expiry">
                    Your verification code expires after 10 minutes.
                  </div>
                </>
              )}

              <div className="auth-bottom">
                <span> {2026} AUTHFLOW</span>
                <span>Protected connection  HTTPS ready</span>
              </div>

            </div>

          </div>

        </section>

      ) : (

        <section className="dashboard">

          <div className="dashboard-sidebar">

            <Brand />

            <div className="sidebar-label">WORKSPACE</div>

            <div className="sidebar-link active">
              <LayoutDashboard size={18} /> Overview
            </div>

            <div className="sidebar-label">ACCOUNT</div>

            <div className="sidebar-link">
              <UserRound size={18} /> My Profile
            </div>

            <div className="sidebar-link">
              <ShieldCheck size={18} /> Security
            </div>

            <div className="sidebar-bottom">
              <div className="sidebar-user">
                <div className="avatar">
                  {user?.fullName?.charAt(0)?.toUpperCase()}
                </div>

                <div>
                  <strong>{user?.fullName}</strong>
                  <small>Personal Account</small>
                </div>
              </div>

              <button className="logout-button" onClick={logout}>
                 <LogOut size={17} /> Sign out
              </button>
            </div>

          </div>

          <div className="dashboard-main">

            <div className="dashboard-topbar">
              <div>
                <span className="step-label">YOUR WORKSPACE</span>
                <h2>Overview</h2>
              </div>

              <div className="profile-pill">
                <span className="online-dot"></span>
                Account active
              </div>
            </div>

            <div className="welcome-banner">
              <div>
                <div className="step-label">PERSONAL DASHBOARD</div>

                <h1>
                  Welcome back, {user?.fullName?.split(" ")[0]}!
                </h1>

                <p>
                  Your account is secure. Here's your personal overview.
                </p>
              </div>

              <div className="welcome-symbol"><Sparkles size={38} /></div>
            </div>

            <Alert message={message} messageType={messageType} />

            <div className="dashboard-grid">

              <div className="stat-card">
                <div className="stat-top">
                  <span>ACCOUNT STATUS</span>
                  <span className="stat-icon"><CheckCircle2 size={20} /></span>
                </div>

                <h2>Verified</h2>

                <p>Your email has been verified.</p>

                <div className="status-tag">
                  <span></span> ACTIVE
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>ACCOUNT TYPE</span>
                  <span className="stat-icon"><UserRound size={20} /></span>
                </div>

                <h2>Personal</h2>

                <p>Your AUTHFLOW account.</p>

                <div className="status-tag">
                  STANDARD ACCOUNT
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>SECURITY</span>
                  <span className="stat-icon"><Shield size={20} /></span>
                </div>

                <h2>Protected</h2>

                <p>Email OTP authentication enabled.</p>

                <div className="status-tag">
                  SECURITY ENABLED
                </div>
              </div>

            </div>

            <div className="dashboard-content-grid">

              <div className="content-card">
                <div className="card-heading">
                  <div>
                    <span className="step-label">ACCOUNT INFORMATION</span>
                    <h3>Your details</h3>
                  </div>

                  <span className="card-heading-icon"><UserRound size={19} /></span>
                </div>

                <div className="detail-row">
                  <span>Full name</span>
                  <strong>{user?.fullName}</strong>
                </div>

                <div className="detail-row">
                  <span>Email address</span>
                  <strong>{user?.email}</strong>
                </div>

                <div className="detail-row">
                  <span>Email verification</span>
                  <strong className="verified-text">Verified </strong>
                </div>

                <div className="detail-row">
                  <span>Last login</span>
                  <strong>
                    {user?.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : "Not available"}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>Member since</span>
                  <strong>
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "Not available"}
                  </strong>
                </div>

              </div>

              <div className="content-card quote-card">
                <div className="quote-mark"><Sparkles size={22} /></div>

                <span className="step-label">DAILY INSPIRATION</span>

                <h3>A little motivation for today.</h3>

                <p>{quote}</p>

                <div className="quote-footer">
                  KEEP MOVING FORWARD <ChevronRight size={16} />
                </div>
              </div>

            </div>

            <div className="dashboard-footer">
              <span> {2026} AUTHFLOW</span>
              <span>SECURELY CONNECTED</span>
            </div>

          </div>

        </section>

      )}

    </main>
  );
}



