import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { auth, db } from "../../firebase-config";
import { ref as dbRef, get, onValue, off } from "firebase/database";
import Nav from "../components/Nav";
import backArrow from "../assets/icons/backarrow.svg";

/* ---------- helpers ---------- */
function normType(t) {
  const x = (t || "").toLowerCase();
  if (x === "books") return "book";
  if (x === "albums") return "album";
  if (x === "vinyl") return "vinyl";
  if (x === "book") return "book";
  if (x === "album") return "album";
  return x;
}
function labelForType(t) {
  const n = normType(t);
  if (n === "book") return "Books";
  if (n === "album") return "Albums";
  if (n === "vinyl") return "Vinyl";
  return (t || "").charAt(0).toUpperCase() + (t || "").slice(1);
}
function pickImage(val) {
  if (!val || typeof val !== "object") return "";
  const candidates = [
    val?.images?.cover,
    val?.coverImage,
    val?.imageUrl,
    val?.image,
    val?.thumbnail,
    val?.volumeInfo?.imageLinks?.thumbnail,
    val?.volumeInfo?.imageLinks?.smallThumbnail,
  ];
  const u = (
    candidates.find((x) => typeof x === "string" && x.trim()) || ""
  ).trim();
  return u.replace(/^["']|["']$/g, "");
}

/* ---------- component ---------- */
export default function Favourites() {
  const navigate = useNavigate();

  // Favourite items (hydrated)
  const [items, setItems] = useState([]);
  // Favourite authors (KUN fra DB — ingen auto fra items)
  const [favAuthors, setFavAuthors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // søgning
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  // filter via author-tags
  const [authorFilter, setAuthorFilter] = useState(null);

  // ---- Load favourite ITEMS (IDs -> hydrate) ----
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

    const favItemsRef = dbRef(db, `users/${uid}/favourites/items`);

    const listener = async (snap) => {
      if (!alive) return;

      if (!snap.exists()) {
        setItems([]);
        setLoading(false);
        return;
      }

      const ids = [];
      const createdAtById = {};
      snap.forEach((ch) => {
        ids.push(ch.key);
        const v = ch.val();
        if (v && typeof v === "object" && v.createdAt) {
          createdAtById[ch.key] = Number(v.createdAt) || 0;
        }
      });

      const results = await Promise.all(
        ids.map(async (itemId) => {
          try {
            const userSnap = await get(
              dbRef(db, `users/${uid}/collectionItems/${itemId}`)
            );
            if (userSnap.exists()) {
              const v = userSnap.val() || {};
              return {
                id: itemId,
                title: v.title || v.name || "Untitled",
                author: v.author || v.artist || "",
                coverImage: pickImage(v),
                type: normType(v.type),
                createdAt:
                  createdAtById[itemId] ||
                  Number(v.createdAt || v.addedAt || 0) ||
                  0,
              };
            }
            const globalSnap = await get(dbRef(db, `items/${itemId}`));
            if (globalSnap.exists()) {
              const v = globalSnap.val() || {};
              return {
                id: itemId,
                title: v.title || v.name || "Untitled",
                author: v.author || v.artist || "",
                coverImage: pickImage(v),
                type: normType(v.type),
                createdAt:
                  createdAtById[itemId] ||
                  Number(v.createdAt || v.addedAt || 0) ||
                  0,
              };
            }
          } catch (e) {
            console.warn("hydrate favourite item error", itemId, e);
          }
          return {
            id: itemId,
            title: "Untitled",
            author: "",
            coverImage: "",
            type: "",
            createdAt: createdAtById[itemId] || 0,
          };
        })
      );

      results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(results);
      setLoading(false);
    };

    onValue(favItemsRef, listener);
    return () => {
      alive = false;
      off(favItemsRef, "value", listener);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---- Load favourite AUTHORS (KUN fra DB) ----
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const authorsRef = dbRef(db, `users/${uid}/favourites/authors`);

    const listener = (snap) => {
      if (!snap.exists()) {
        setFavAuthors([]);
        return;
      }
      const names = new Set();
      snap.forEach((ch) => {
        const val = ch.val();
        // Accept shapes: true | "Name" | { name/title/displayName/author: "Name" }
        if (val === true) {
          names.add(ch.key);
        } else if (typeof val === "string") {
          names.add(val);
        } else if (val && typeof val === "object") {
          const n =
            val.name ||
            val.title ||
            val.author ||
            val.displayName ||
            val.slug ||
            "";
          if (n && typeof n === "string") names.add(n);
        }
      });
      setFavAuthors(
        Array.from(names).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        )
      );
    };

    onValue(authorsRef, listener);
    return () => off(authorsRef, "value", listener);
  }, []);

  // ---- Search + filter ----
  const onSearchChange = (e) => {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      setQ(val);
      setSearching(false);
    }, 250);
  };

  const filteredBySearch = useMemo(() => {
    const term = (q || "").trim().toLowerCase();
    if (!term) return items;
    return items.filter((it) =>
      `${it.title || ""} ${it.author || ""}`.toLowerCase().includes(term)
    );
  }, [items, q]);

  const filtered = useMemo(() => {
    if (!authorFilter) return filteredBySearch;
    const af = authorFilter.toLowerCase();
    return filteredBySearch.filter(
      (it) => (it.author || "").toLowerCase() === af
    );
  }, [filteredBySearch, authorFilter]);

  // grupper pr. type
  const itemsByType = useMemo(() => {
    const map = new Map();
    for (const it of filtered) {
      const t = normType(it.type || "") || "other";
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(it);
    }
    return map;
  }, [filtered]);

  if (loading) {
    return (
      <main className="landing-container">
        <h1 className="page-title">Loading favourites…</h1>
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

  const searchActive = (q || "").trim().length > 0;
  const typeOrder = ["book", "album", "vinyl", "other"];
  const rows = [...itemsByType.entries()].sort(
    ([a], [b]) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  return (
    <main style={{ paddingBottom: 130 }}>
      {/* Top */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="back-arrow-link"
          aria-label="Go back"
        >
          <img src={backArrow} alt="Back" className="back-arrow" />
        </button>
        <h1 className="page-title">Favourites</h1>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="search"
          onChange={onSearchChange}
          placeholder="Search your favourites"
          className="search-input"
          aria-label="Search favourites"
        />
        {searching && <span className="search-hint">Searching…</span>}
      </div>

      {/* Favourite authors as tags (DB only) */}
      {favAuthors.length > 0 && (
        <>
          <h3 className="aftersignup-subtitle-collection">
            My favourite authors
          </h3>
          <ul className="item-tags item-tags-wrap">
            {favAuthors.map((a) => (
              <li
                key={a}
                className={`tag ${authorFilter === a ? "active" : ""}`}
                role="button"
                tabIndex={0}
                title={a}
                onClick={() => setAuthorFilter(authorFilter === a ? null : a)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") &&
                  setAuthorFilter(authorFilter === a ? null : a)
                }
                aria-pressed={authorFilter === a}
              >
                {a}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Items by type */}
      {rows.length === 0 ? (
        <div>
          <h3 className="aftersignup-subtitle">No favourite items yet.</h3>
        </div>
      ) : (
        rows.map(([t, list]) => (
          <section key={t}>
            <h3 className="aftersignup-subtitle-collection">
              My favourite {labelForType(t).toLowerCase()}
            </h3>
            <div className="hscroll-strip no-scrollbar">
              {list.map((it) => (
                <Link
                  key={`${t}-${it.id}`}
                  to={`/items/${it.id}`}
                  className="collection-card"
                  aria-label={`Open ${it.title}`}
                  title={it.title}
                >
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
                  <h3 className="item-title">{it.title}</h3>
                  {it.author ? <p className="item-sub">{it.author}</p> : null}
                </Link>
              ))}
            </div>
            {searchActive && list.length === 0 && (
              <p style={{ opacity: 0.8, padding: "0 15px" }}>
                No matches found.
              </p>
            )}
          </section>
        ))
      )}

      <Nav />
    </main>
  );
}
