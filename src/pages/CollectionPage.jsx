import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router";
import { auth, db } from "../../firebase-config";
import { ref, child, get } from "firebase/database";
import Nav from "../components/Nav";

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
  // håndter nested felter + et par almindelige aliaser
  const candidates = [
    val?.images?.cover,
    val?.coverImage,
    val?.imageUrl,
    val?.image,
    val?.thumbnail,
  ];
  let u = (candidates.find(Boolean) || "").trim();
  // fjern evt. omgivende quotes
  u = u.replace(/^["']|["']$/g, "");
  return u;
}

async function loadItemsForCollection({ userRoot, collectionId, colType }) {
  const nestedPath = `${userRoot}/collectionItems/${collectionId}`;
  const flatPath = `${userRoot}/collectionItems`;
  let list = [];

  // 1) Nested under collectionId
  try {
    const nestedSnap = await get(child(ref(db), nestedPath));
    if (nestedSnap.exists()) {
      const obj = nestedSnap.val() || {};
      for (const [key, val] of Object.entries(obj)) {
        if (key === "_placeholder") continue;
        list.push({
          id: key,
          title: val.title || val.name || "Untitled",
          author: val.author || val.artist || "",
          coverImage: val.coverImage || val.imageUrl || "",
          type: normType(val.type || colType),
          collectionId,
          createdAt: Number(val.createdAt || 0),
          ...val,
        });
      }
    }
  } catch (err) {
    console.warn("⚠️ loadItemsForCollection (nested) error:", err);
  }

  // 2) Fallback: flat user items
  if (list.length === 0) {
    try {
      const flatSnap = await get(child(ref(db), flatPath));
      if (flatSnap.exists()) {
        const obj = flatSnap.val() || {};
        for (const [key, val] of Object.entries(obj)) {
          if (key === "_placeholder") continue;
          const it = {
            id: key,
            title: val.title || val.name || "Untitled",
            author: val.author || val.artist || "",
            coverImage: val.coverImage || val.imageUrl || "",
            type: normType(val.type || colType),
            collectionId: val.collectionId,
            createdAt: Number(val.createdAt || 0),
            ...val,
          };
          const wantType = normType(colType);
          const okById = it.collectionId
            ? it.collectionId === collectionId
            : false;
          const okByType = wantType ? it.type === wantType : true;
          if (okById || okByType) list.push(it);
        }
      }
    } catch (err) {
      console.warn("⚠️ loadItemsForCollection (flat) error:", err);
    }
  }

  const tf = normType(colType);
  if (tf) list = list.filter((it) => it.type === tf);
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list;
}

async function loadCategories({ userRoot, collectionId }) {
  const catPath = `${userRoot}/collections/${collectionId}/categories`;
  const list = [];
  try {
    const snap = await get(child(ref(db), catPath));
    if (snap.exists()) {
      const obj = snap.val() || {};
      for (const [key, val] of Object.entries(obj)) {
        if (key === "_placeholder") continue;
        if (!val || typeof val !== "object") continue;
        list.push({
          id: val.id || key,
          title: val.title || "Untitled",
          coverImage: val.coverImage || "",
          createdAt: Number(val.createdAt || 0),
          ...val,
        });
      }
    }
  } catch (err) {
    console.warn("⚠️ loadCategories error:", err);
  }
  // nyeste først (valgfrit)
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list;
}

async function loadDiscoverForType({ colType, userItemIdsSet }) {
  const tf = normType(colType);
  if (!tf) return [];

  try {
    const snap = await get(child(ref(db), "items")); // <- ingen leading slash
    if (!snap.exists()) return [];

    const obj = snap.val() || {};
    const pool = [];
    for (const [key, val] of Object.entries(obj)) {
      if (!val || typeof val !== "object" || key === "_placeholder") continue;

      // match kun samme type
      const itemType = normType(val.type);
      if (itemType !== tf) continue;

      // skip ting brugeren har
      if (userItemIdsSet.has(key)) continue;

      const title = String(val.title || val.name || "").trim();
      const author = String(val.author || val.artist || "").trim();

      // undgå dubletter via "titel|forfatter" signatur
      const sig = `${title.toLowerCase()}|${author.toLowerCase()}`;
      if (userItemIdsSet.__sigs && userItemIdsSet.__sigs.has(sig)) continue;

      pool.push({
        id: val.id || key,
        title: title || "Untitled",
        author,
        coverImage: pickImage(val), // <-- her!
        type: itemType,
        popularity: Number(val.popularity || 0),
        createdAt: Number(val.createdAt || 0),
        ...val,
      });
    }

    // sortér: mest populære → nyeste → alfabetisk
    pool.sort((a, b) => {
      const p = (b.popularity || 0) - (a.popularity || 0);
      if (p) return p;
      const c = (b.createdAt || 0) - (a.createdAt || 0);
      if (c) return c;
      return (a.title || "").localeCompare(b.title || "");
    });

    return pool.slice(0, 7);
  } catch (err) {
    console.warn("⚠️ loadDiscoverForType(items) error:", err);
    return [];
  }
}

/* ---------- component ---------- */
export default function CollectionPage() {
  const { collectionId } = useParams();
  const [col, setCol] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // søgning
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

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
        const userRoot = `users/${me.uid}`;

        // 1) collection
        const colSnap = await get(
          child(ref(db), `${userRoot}/collections/${collectionId}`)
        );
        if (!colSnap.exists()) {
          setErr("Collection not found.");
          setLoading(false);
          return;
        }
        const colData = colSnap.val() || {};
        const colType = normType(colData?.type);

        // 2) items (i den aktuelle collection / type)
        const list = await loadItemsForCollection({
          userRoot,
          collectionId,
          colType,
        });

        // 3) categories (under collectionen)
        const cats = await loadCategories({ userRoot, collectionId });

        // 4) discover (populære items af samme type, som brugeren ikke har)
        const userItemIdsSet = new Set(list.map((x) => x.id));
        userItemIdsSet.__sigs = new Set(
          list.map(
            (x) =>
              `${(x.title || "").toLowerCase()}|${(
                x.author || ""
              ).toLowerCase()}`
          )
        );
        const dis = await loadDiscoverForType({ colType, userItemIdsSet });

        if (!alive) return;
        setCol(colData);
        setItems(list);
        setCategories(cats);
        setDiscover(dis);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setErr("Could not load collection.");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // <-- vigtig: ingen ekstra } eller ) efter denne linje!
  }, [collectionId]); // <-- slut på useEffect

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

  const typeLabel =
    (col?.type === "books" && "Books") ||
    (col?.type === "albums" && "Albums") ||
    (col?.type === "vinyl" && "Vinyl") ||
    col?.type ||
    "";

  const meUid = auth.currentUser?.uid;
  const addItemHref = meUid
    ? `/users/${meUid}/collections/${collectionId}/add-item`
    : "#";
  const addCategoryHref = meUid
    ? `/users/${meUid}/collections/${collectionId}/createcategory`
    : "#";

  return (
    <main className="landing-container" style={{ paddingBottom: 130 }}>
      <div className="landing-text">
        <h1 className="page-title">{col?.title || "Untitled collection"}</h1>
      </div>

      {items.length === 0 ? (
        <div>
          <h3 className="aftersignup-subtitle">
            This {(typeLabel || "collection").toLowerCase()} is empty. Add your
            first item!
          </h3>
          <Link
            to={addItemHref}
            className="get-started-btn create-collection-btn"
          >
            Add items +
          </Link>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="search-container">
            <input
              type="search"
              onChange={onSearchChange}
              placeholder="Search in this collection"
              className="search-input"
              aria-label="Search items"
            />
            {searching && <span className="search-hint">Searching…</span>}
          </div>

          {/* ---------- CATEGORIES (øverst) ---------- */}
          {categories.length > 0 && (
            <>
              <h3 className="aftersignup-subtitle-collection">Categories</h3>
              <div className="hscroll-strip no-scrollbar categories-strip">
                {categories.map((cat) => (
                  <article
                    key={cat.id}
                    className="category-card"
                    aria-label={cat.title}
                  >
                    {cat.coverImage && (
                      <img
                        src={cat.coverImage}
                        alt={cat.title}
                        className="category-cover"
                        loading="lazy"
                      />
                    )}
                    <h3 className="category-title">{cat.title}</h3>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* ---------- ALL [TYPE] ---------- */}
          <h3 className="aftersignup-subtitle-collection">
            All {typeLabel.toLowerCase()}
          </h3>
          <div className="hscroll-strip no-scrollbar">
            {visibleItems.map((it) => (
              <article
                key={it.id}
                className="collection-card"
                aria-label={it.title}
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
              </article>
            ))}
          </div>

          {/* ---------- DISCOVER ---------- */}
          {discover.length > 0 && (
            <>
              <h3 className="aftersignup-subtitle-collection">Discover</h3>
              <div className="hscroll-strip no-scrollbar">
                {discover.map((it) => (
                  <article
                    key={it.id}
                    className="collection-card"
                    aria-label={it.title}
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
                  </article>
                ))}
              </div>
            </>
          )}

          {/* ---------- CTA buttons ---------- */}
          <div className="landing-page-btns">
            <Link
              to={addCategoryHref}
              className="login-btn"
              aria-label="Add category"
            >
              Add category +
            </Link>
            <Link
              to={addItemHref}
              className="get-started-btn"
              aria-label="Add item"
            >
              Add item +
            </Link>
          </div>
        </>
      )}

      <Nav />
    </main>
  );
}
