import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router";
import { db, auth } from "../../firebase-config";
import { ref as dbRef, onValue, off, get } from "firebase/database";
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

// Hydrér manglende type fra /items og /users/{uid}/collectionItems
async function hydrateTypesForWishlist(list, uid) {
  const typeMap = new Map();

  // 1) Globalt katalog
  try {
    const itemsSnap = await get(dbRef(db, "items"));
    if (itemsSnap.exists()) {
      itemsSnap.forEach((ch) => {
        const v = ch.val();
        const t = normType(v?.type);
        if (t) typeMap.set(ch.key, t);
      });
    }
  } catch (e) {
    console.warn("wishlist hydrate: global items read failed", e);
  }

  // 2) Brugerens egne collectionItems (hvis det findes)
  try {
    const userItemsSnap = await get(dbRef(db, `users/${uid}/collectionItems`));
    if (userItemsSnap.exists()) {
      userItemsSnap.forEach((ch) => {
        const v = ch.val();
        const sourceId = v?.sourceItemId || v?.itemId;
        const t = normType(v?.type);
        if (sourceId && t && !typeMap.has(sourceId)) {
          typeMap.set(sourceId, t);
        }
      });
    }
  } catch (e) {
    console.warn("wishlist hydrate: user collectionItems read failed", e);
  }

  // 3) Returnér ny liste med udfyldt type hvor muligt
  return list.map((it) => {
    const t = normType(it.type);
    if (t) return it; // allerede sat
    const fromMap = typeMap.get(it.itemId);
    return fromMap ? { ...it, type: fromMap } : it;
  });
}

/* ---------- component ---------- */
export default function WishlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // search + filter
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("all");
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

    const listener = async (snap) => {
      if (!alive) return;

      if (!snap.exists()) {
        setItems([]);
        setLoading(false);
        return;
      }

      const base = [];
      snap.forEach((ch) => {
        const val = ch.val();
        if (!val || typeof val !== "object") return;
        base.push({
          id: ch.key,
          itemId: val.itemId || val.sourceItemId || ch.key,
          title: val.title || "Untitled",
          author: val.author || "",
          coverImage: pickImage(val),
          type: normType(val.type || val.itemType || val.kind || ""), // kan være tom
          createdAt: Number(val.createdAt || 0),
        });
      });

      // Hydrér manglende typer
      let list = base;
      try {
        list = await hydrateTypesForWishlist(base, uid);
      } catch (e) {
        console.warn("wishlist hydrate types failed", e);
      }

      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (!alive) return;
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

    return items.filter((it) => {
      const matchesSearch = !term
        ? true
        : `${it.title || ""} ${it.author || ""}`.toLowerCase().includes(term);

      const t = normType(it.type);
      const matchesType = filterType === "all" ? true : t === filterType;

      return matchesSearch && matchesType;
    });
  }, [items, q, filterType]);

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
    <main className="add-item-page" style={{ paddingBottom: 130 }}>
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

      {/* Filter + Search (samme classes som AddItem) */}
      <div className="search-container">
        <div className="filter-buttons" style={{ marginTop: -30 }}>
          {["all", "book", "album", "vinyl"].map((type) => (
            <button
              key={type}
              className={`filter-btn ${filterType === type ? "active" : ""}`}
              onClick={() => setFilterType(type)}
              aria-pressed={filterType === type}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={q}
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
            {items.length === 0
              ? "Your wishlist is empty. Add some favourites!"
              : "No items match this filter."}
          </h3>
        </div>
      ) : (
        <div
          className="hscroll-strip author-page-items"
          style={{ marginTop: 10 }}
        >
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
