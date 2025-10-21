import { useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider, db } from "../../firebase-config";
import { ref, child, get } from "firebase/database";
import Google from "../assets/icons/google.svg";

export default function LogInd() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function redirectToFirstCollection(uid) {
    try {
      const colSnap = await get(child(ref(db), `users/${uid}/collections`));
      if (!colSnap.exists()) {
        console.warn("Ingen collections fundet for bruger:", uid);
        navigate("/"); // fallback til forside
        return;
      }

      const collections = colSnap.val();
      const firstId = Object.keys(collections)[0];
      if (!firstId) {
        navigate("/");
        return;
      }

      navigate(`/users/${uid}/collections/${firstId}`);
    } catch (err) {
      console.error("Kunne ikke hente collections:", err);
      navigate("/");
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pw);
      const uid = cred.user?.uid;
      if (uid) await redirectToFirstCollection(uid);
      else navigate("/");
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const uid = cred.user?.uid;
      if (uid) await redirectToFirstCollection(uid);
      else navigate("/");
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

  return (
    <div className="login-page">
      <h2 className="login-title">Login</h2>
      <p className="login-subtitle">
        Don&lsquo;t have an account? <Link to="/signup">Sign up</Link>
      </p>
      <form className="login-form" onSubmit={handleLogin} noValidate>
        <div className="login-inputs">
          <p>
            Email <span className="gradient-text">*</span>
          </p>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p>
            Password <span className="gradient-text">*</span>
          </p>
          <input
            type="password"
            placeholder="Enter your password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
        </div>
        <a href="#" onClick={handleForgot} className="forgot-link">
          Forgot password?
        </a>
        {error && <p className="login-error">{error}</p>}

        <button className="get-started-btn" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>

        <button
          type="button"
          className="login-btn"
          onClick={handleGoogle}
          disabled={loading}
        >
          Log ind med Google
          <img src={Google} alt="Google ikon" className="google-icon" />
        </button>
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
