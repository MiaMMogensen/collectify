import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { auth, db } from "../../firebase-config";
import { signOut, deleteUser } from "firebase/auth";
import { ref as dbRef, get, remove } from "firebase/database";
import Nav from "../components/Nav";
import settingsIcon from "../assets/icons/edit.svg";

export default function ProfilePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [userDb, setUserDb] = useState(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const user = auth.currentUser;
  const uid = user?.uid;

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const snap = await get(dbRef(db, `users/${uid}`));
        if (alive) {
          if (snap.exists()) setUserDb(snap.val());
          else setUserDb(null);
        }
      } catch (err) {
        console.error("Could not load user DB data", err);
        if (alive) setError("Kunne ikke hente profildata.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [uid]);

  async function handleLogout() {
    setProcessing(true);
    setError("");
    try {
      await signOut(auth);
      // optional: clear local storage or other app state
      navigate("/"); // go to landing or login
    } catch (err) {
      console.error("Logout failed", err);
      setError("Kunne ikke logge ud. Prøv igen.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteAccount() {
    if (!uid) return;
    // confirm
    const ok = window.confirm(
      "Er du sikker på at du vil slette din konto? Denne handling fjerner din konto og dine brugerdata permanent."
    );
    if (!ok) return;

    setProcessing(true);
    setError("");

    try {
      // 1) fjern brugerdata i Realtime DB under /users/{uid}
      await remove(dbRef(db, `users/${uid}`));

      // 2) forsøg at slette Auth-brugeren
      // note: deleteUser kræver at brugeren har en "recent login" — ellers kastes en fejl
      await deleteUser(auth.currentUser);

      // hvis vi når hertil er kontoen slettet — redirect til landing
      navigate("/");
    } catch (err) {
      console.error("Delete account error", err);
      // håndter kendt fejl: kræver gen-autentifikation
      // firebase auth fejlnavn: auth/requires-recent-login
      const msg =
        err?.code === "auth/requires-recent-login"
          ? "Af sikkerhedsårsager skal du logge ind igen (reauthenticate) før du kan slette kontoen. Log ind igen og prøv igen."
          : "Kunne ikke slette konto. Prøv igen eller kontakt support.";
      setError(msg);
    } finally {
      setProcessing(false);
    }
  }

  // Data to display: prefer DB username, fallback to auth.displayName
  const displayUsername =
    (userDb && (userDb.username || userDb.displayName)) ||
    user?.displayName ||
    "—";
  const displayEmail = user?.email || (userDb && userDb.email) || "—";

  if (loading) {
    return (
      <main>
        <h1 className="page-title">Profile</h1>
        <p>Loading profile…</p>
        <Nav />
      </main>
    );
  }

  return (
    <main className="page-container" style={{ paddingBottom: 140 }}>
      <div className="profilepage-header">
        <h1 className="page-title profile-page-item-title">Profile</h1>
      </div>

      {error && (
        <p className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      <section className="profile-section">
        <Link to="/account-settings" className="btn account-settings-btn">
          <span className="profilepage-title">Account settings</span>
          <img src={settingsIcon} alt="" aria-hidden="true" />
        </Link>

        <div className="profile-field">
          <label className="field-label">Username:</label>
          <div className="field-value">{displayUsername}</div>
        </div>

        <div className="profile-field">
          <label className="field-label">Email:</label>
          <div className="field-value">{displayEmail}</div>
        </div>

        <div className="profile-field">
          <label className="field-label">Password:</label>
          <div className="field-value">••••••••</div>
        </div>
      </section>

      <section className="profile-section">
        <div className="actions-col">
          {/* wishlist button (moved to bottom visually) */}
          <Link to="/wishlist" className="profilepage-wishlist-link">
            <span>Wishlist</span>
          </Link>

          {/* Log ud */}
          <div className="profile-btns">
            <button
              className="login-btn"
              onClick={handleLogout}
              disabled={processing}
              style={{ marginTop: 12 }}
            >
              {processing ? "Processing…" : "Log ud"}
            </button>

            {/* Delete account */}
            <button
              className="get-started-btn"
              onClick={handleDeleteAccount}
              disabled={processing}
              style={{ marginTop: 8 }}
              title="Slet konto permanent"
            >
              {processing ? "Processing…" : "Slet konto"}
            </button>
          </div>
        </div>
      </section>

      <Nav />
    </main>
  );
}
