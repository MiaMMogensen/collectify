import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router";
import { db, auth } from "../../firebase-config";
import { ref as dbRef, onValue, off } from "firebase/database";
import Nav from "../components/Nav";
import backArrow from "../assets/icons/backarrow.svg";

/* ---------- helper ---------- */
function pickImage(val) {
  if (!val || typeof val !== "object") return "";
  const candidates = [
    val.coverImage,
    val.cover,
    val.imageUrl,
    val.image,
    val.thumbnail,
  ];
  let u = (
    candidates.find((x) => typeof x === "string" && x.trim()) || ""
  ).trim();
  return u.replace(/^["']|["']$/g, "");
}

/* ---------- component ---------- */
export default function WishlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setErr("");
    setLoading(true);

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setErr("You must be logged in.");
      setLoading(false);
      return;
    }

    const ref = dbRef(db, `users/${uid}/wishlist`);

    const listener = (snap) => {
      if (!alive) return;
      if (!snap.exists()) {
        setItems([]);
        setLoading(false);
        return;
      }

      const list = [];
      snap.forEach((ch) => {
        const val = ch.val();
        if (!val || typeof val !== "object") return;
        list.push({
          id: ch.key,
          itemId: val.itemId || val.sourceItemId || ch.key,
          title: val.title || "Untitled",
          author: val.author || "",
          coverImage: pickImage(val),
          createdAt: Number(val.createdAt || 0),
        });
      });

      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(list);
      setLoading(false);
    };

    onValue(ref, listener);
    return () => {
      alive = false;
      off(ref, "value", listener);
    };
  }, []);

  const visibleItems = useMemo(() => {
    const term = (q || "").trim().toLowerCase();
    if (!term) return items;
    return items.filter((it) =>
      `${it.title || ""} ${it.author || ""}`.toLowerCase().includes(term)
    );
  }, [items, q]);

  function onSearchChange(e) {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      setQ(val);
      setSearching(false);
    }, 250);
  }

  if (loading) {
    return (
      <main className="landing-container">
        <h1 className="page-title">Loading wishlist…</h1>
      </main>
    );
  }

  if (err) {
    return (
      <main className="landing-container">
        <h1 className="page-title">{err}</h1>
        <Nav />
      </main>
    );
  }

  return (
    <main style={{ paddingBottom: 130 }}>
      {/* Topbar */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="back-arrow-link"
          aria-label="Go back"
        >
          <img src={backArrow} alt="Back" className="back-arrow" />
        </button>
        <h1 className="page-title">Wishlist</h1>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="search"
          onChange={onSearchChange}
          placeholder="Search in wishlist"
          className="search-input"
          aria-label="Search wishlist items"
        />
        {searching && <span className="search-hint">Searching…</span>}
      </div>

      {/* Items */}
      {visibleItems.length === 0 ? (
        <div>
          <h3 className="aftersignup-subtitle">
            Your wishlist is empty. Add some favourites!
          </h3>
        </div>
      ) : (
        <div className="category-grid">
          {visibleItems.map((it) => (
            <article
              key={it.id}
              className="collection-card"
              aria-label={it.title}
            >
              <Link to={`/items/${it.itemId}`} aria-label={`View ${it.title}`}>
                <div className="cover-frame">
                  <div className="cover-wrap">
                    {it.coverImage ? (
                      <img
                        src={it.coverImage}
                        alt={it.title}
                        className="cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="cover placeholder" />
                    )}
                  </div>
                </div>
              </Link>
              <h3 className="item-title" title={it.title}>
                {it.title}
              </h3>
              {it.author ? <p className="item-sub">{it.author}</p> : null}
            </article>
          ))}
        </div>
      )}

      <Nav />
    </main>
  );
}
