import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { auth, db } from "../../firebase-config";
import { ref, child, get } from "firebase/database";
import Nav from "../components/Nav";

export default function CollectionPage() {
  const { uid, collectionId } = useParams();
  const [col, setCol] = useState(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setErr("");
      setLoading(true);
      try {
        const me = auth.currentUser;
        if (!me) {
          setErr("You must be logged in.");
          setLoading(false);
          return;
        }

        // 1) Hent collection
        const colSnap = await get(
          child(ref(db), `users/${uid}/collections/${collectionId}`)
        );
        if (!colSnap.exists()) {
          setErr("Collection not found.");
          setLoading(false);
          return;
        }
        const colData = colSnap.val();
        if (!alive) return;
        setCol(colData);

        // 2) Tjek om der er items i samlingen
        const itemsSnap = await get(
          child(ref(db), `users/${uid}/collectionItems/${collectionId}`)
        );
        let empty = true;
        if (itemsSnap.exists()) {
          const obj = itemsSnap.val() || {};
          const keys = Object.keys(obj).filter((k) => k !== "_placeholder");
          empty = keys.length === 0;
        }
        if (alive) setIsEmpty(empty);

        setLoading(false);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setErr(e?.message || "Could not load collection.");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [uid, collectionId]);

  if (loading) {
    return (
      <main className="landing-container">
        <h1 className="page-title">Loading…</h1>
      </main>
    );
  }
  if (err) {
    return (
      <main className="landing-container">
        <h1 className="page-title">{err}</h1>
      </main>
    );
  }

  return (
    <main className="landing-container">
      <div className="landing-text">
        <h1 className="page-title">{col?.title || "Untitled collection"}</h1>
      </div>

      {isEmpty ? (
        <div>
          <h3 className="aftersignup-subtitle">
            Your collection is empty. Get started by adding your first item!
          </h3>
          <Link
            to={`/users/${uid}/collections/${collectionId}/add-item`}
            className="get-started-btn create-collection-btn"
            aria-label="Add items"
          >
            Add items +
          </Link>
        </div>
      ) : (
        <div className="landing-page-btns">
          {/* Her kan du senere vise liste/grid af items eller andre actions */}
          <Link
            to={`/users/${uid}/collections/${collectionId}/add-item`}
            className="get-started-btn"
          >
            Add item +
          </Link>
        </div>
      )}

      <Nav />
    </main>
  );
}
