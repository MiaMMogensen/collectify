import { useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
  signInWithPopup,
} from "firebase/auth";
import {
  ref,
  runTransaction,
  set,
  get,
  child,
  serverTimestamp,
} from "firebase/database";
import { auth, db, googleProvider } from "../../firebase-config";
import Google from "../assets/icons/google.svg";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const sanitizeUsername = (raw) =>
    raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20);

  function validate() {
    const u = sanitizeUsername(username);
    if (!u || u.length < 3)
      return "Choose a username with at least 3 characters (a-z, 0-9 or _).";
    if (!email.trim()) return "Please enter a valid email.";
    if (pw.length < 6) return "Password must be at least 6 characters.";
    return null;
  }

  async function reserveUsernameTx(usernameNorm, uid) {
    const unameRef = ref(db, `usernames/${usernameNorm}`);
    const res = await runTransaction(unameRef, (current) => {
      if (current === null) return uid; // reserve if available
      return; // conflict: no change
    });
    return res.committed && res.snapshot.val() === uid;
  }

  async function linkUidToUsername(uid, usernameNorm) {
    await set(ref(db, `uidUsername/${uid}`), usernameNorm);
  }

  async function createUserDoc(uid, { username, email }) {
    await set(ref(db, `users/${uid}`), {
      uid,
      username,
      email,
      settings: {
        language: "en",
        theme: "system", // "light" | "dark" | "system"
        privacy: "friends", // "public" | "friends" | "private"
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");

    const v = validate();
    if (v) return setError(v);

    const usernameNorm = sanitizeUsername(username);
    setLoading(true);

    try {
      // 1) Create auth user
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      const uid = cred.user.uid;

      // 2) Reserve username atomically
      const ok = await reserveUsernameTx(usernameNorm, uid);
      if (!ok) {
        try {
          await deleteUser(auth.currentUser);
        } catch (delErr) {
          console.error(
            "Cleanup failed (could not delete temporary user):",
            delErr
          );
        }
        throw { code: "username-already-in-use" };
      }

      // 3) Optional: put username in auth profile for convenience
      try {
        await updateProfile(auth.currentUser, { displayName: usernameNorm });
      } catch (updErr) {
        console.warn("Could not update displayName:", updErr);
      }

      // 4) Reverse lookup (uid -> username)
      await linkUidToUsername(uid, usernameNorm);

      await createUserDoc(uid, { username: usernameNorm, email: email.trim() });

      navigate("/");
    } catch (err) {
      console.error("Signup error:", err);
      setError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      const uid = user.uid;

      // If this user doesn't have a username yet, generate + reserve one
      const uidUserSnap = await get(child(ref(db), `uidUsername/${uid}`));
      if (!uidUserSnap.exists()) {
        const base =
          sanitizeUsername(
            user.displayName || user.email?.split("@")[0] || "user"
          ) || "user";
        let candidate = base;
        let tries = 0;
        let reserved = false;

        while (tries < 8 && !reserved) {
          reserved = await reserveUsernameTx(candidate, uid);
          if (!reserved) {
            tries++;
            candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
          }
        }

        if (!reserved) {
          // Fallback: uid prefix to guarantee uniqueness
          candidate = uid.slice(0, 8);
          const finalOk = await reserveUsernameTx(candidate, uid);
          if (!finalOk) {
            throw new Error(
              "Could not reserve any username for this Google account."
            );
          }
        }

        try {
          await updateProfile(auth.currentUser, { displayName: candidate });
        } catch (updErr) {
          console.warn("Could not update displayName:", updErr);
        }

        await linkUidToUsername(uid, candidate);
        await createUserDoc(uid, {
          username: candidate,
          email: user.email || "",
        });
      } else {
        // Ensure /users/{uid} exists (for old accounts that may be missing it)
        const usersSnap = await get(child(ref(db), `users/${uid}`));
        if (!usersSnap.exists()) {
          const existingUsername = uidUserSnap.val();
          await createUserDoc(uid, {
            username: existingUsername,
            email: user.email || "",
          });
        }
      }

      navigate("/");
    } catch (err) {
      console.error("Google signup error:", err);
      setError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <h2 className="login-title">Sign up</h2>
      <p className="login-subtitle">
        Already have an account? <Link to="/login">Login</Link>
      </p>

      <form className="login-form" onSubmit={handleSignup} noValidate>
        <div className="login-inputs">
          <p>
            Username <span className="gradient-text">*</span>
          </p>
          <input
            type="text"
            placeholder="Enter a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="^[a-z0-9_]{3,20}$"
            required
          />

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
            placeholder="At least 6 characters"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
        </div>

        {error && <p className="login-error">{error}</p>}

        <button
          className="get-started-btn create-btn"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <button
          type="button"
          className="login-btn google-btn"
          onClick={handleGoogleSignup}
          disabled={loading}
        >
          Sign up with Google
          <img src={Google} alt="Google icon" className="google-icon" />
        </button>
      </form>
    </div>
  );
}

function mapFirebaseError(error) {
  const code = String(error?.code || "");
  if (code.includes("username-already-in-use"))
    return "That username is taken. Please try another.";
  if (code.includes("auth/email-already-in-use"))
    return "This email is already in use.";
  if (code.includes("auth/invalid-email")) return "Invalid email address.";
  if (code.includes("auth/weak-password")) return "Your password is too weak.";
  if (code.includes("auth/popup-closed-by-user"))
    return "Sign up was cancelled.";
  return "Something went wrong. Please try again.";
}
