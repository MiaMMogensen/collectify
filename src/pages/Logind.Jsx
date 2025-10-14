import { useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../../firebase-config";

export default function LogInd() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw);
      navigate("/"); // Skift til forsiden eller dine samlinger
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Indtast din email for at nulstille adgangskoden.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError("🔐 Tjek din indbakke for nulstillingslink.");
    } catch (err) {
      setError(mapFirebaseError(err));
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <h2 className="login-title">Login</h2>
      <p className="login-subtitle">
        Don&lsquo;t have an account? <Link to="/signup">Sign up</Link>
      </p>
      <form className="login-form" onSubmit={handleLogin} noValidate>
        <div className="login-inputs">
          <p>Email*</p>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p>Password*</p>
          <input
            type="password"
            placeholder="Enter your password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
        </div>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Logger ind..." : "Log ind"}
        </button>

        <button
          type="button"
          className="google-login"
          onClick={handleGoogle}
          disabled={loading}
        >
          <img
            src="/assets/icons/google.svg"
            alt="Google ikon"
            className="google-icon"
          />
          Log ind med Google
        </button>

        <a href="#" onClick={handleForgot} className="forgot-link">
          Glemt adgangskode?
        </a>
      </form>
    </div>
  );
}

function mapFirebaseError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-email")) return "Ugyldig email.";
  if (code.includes("user-not-found")) return "Bruger findes ikke.";
  if (code.includes("wrong-password")) return "Forkert adgangskode.";
  if (code.includes("too-many-requests"))
    return "For mange forsøg – prøv igen senere.";
  if (code.includes("popup-closed-by-user")) return "Login afbrudt.";
  return "Noget gik galt. Prøv igen.";
}
