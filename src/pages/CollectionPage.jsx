/* eslint-disable no-unused-vars */
// src/pages/CollectionPage.jsx
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
  return x; // "book" | "album" | "vinyl" | ""
}

async function loadItemsForCollection({ userRoot, collectionId, colType }) {
  const nestedPath = `${userRoot}/collectionItems/${collectionId}`;
  const flatPath = `${userRoot}/collectionItems`;
  let list = [];

  // 1) Nested: collectionItems/{collectionId}
  try {
    const nestedSnap = await get(child(ref(db), nestedPath));
    if (nestedSnap.exists()) {
      const obj = nestedSnap.val() || {};
      for (const [key, val] of Object.entries(obj)) {
        if (key === "_placeholder") continue;
        if (!val || typeof val !== "object") continue;
        list.push({
          id: key,
          title: val.title || val.name || "Untitled",
          author: val.author || val.artist || "",
          coverImage: val.coverImage || val.imageUrl || "",
          type: normType(val.type || colType),
          collectionId: val.collectionId || collectionId,
          createdAt: Number(val.createdAt || 0),
          ...val,
        });
      }
    }
  } catch (_err) {
    // ignore nested read error
  }

  // 2) Fallback: flat collectionItems (filtrér på collectionId/type)
  if (list.length === 0) {
    try {
      const flatSnap = await get(child(ref(db), flatPath));
      if (flatSnap.exists()) {
        const obj = flatSnap.val() || {};
        for (const [key, val] of Object.entries(obj)) {
          if (key === "_placeholder") continue;
          if (!val || typeof val !== "object") continue;
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
    } catch (_err) {
      // ignore flat read error
    }
  }

  // 3) Final type-filter
  const tf = normType(colType);
  if (tf) list = list.filter((it) => it.type === tf);

  // 4) Sort newest first
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list;
}

/* ---------- component ---------- */

export default function CollectionPage() {
  const { collectionId } = useParams(); // vi bruger den indloggede bruger til uid
  const [col, setCol] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // search state (kun synlig når der er items)
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
          if (alive) {
            setErr("You must be logged in.");
            setLoading(false);
          }
          return;
        }

        const userRoot = `users/${me.uid}`;

        // 1) collection
        const colSnap = await get(
          child(ref(db), `${userRoot}/collections/${collectionId}`)
        );
        if (!colSnap.exists()) {
          if (alive) {
            setErr("Collection not found.");
            setLoading(false);
          }
          return;
        }
        const colData = colSnap.val();
        const colType = normType(colData?.type);

        // 2) items
        const list = await loadItemsForCollection({
          userRoot,
          collectionId,
          colType,
        });

        if (!alive) return;
        setCol(colData);
        setItems(list);
        setLoading(false);
      } catch (_err) {
        if (!alive) return;
        console.error(_err);
        setErr(_err?.message || "Could not load collection.");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
      if (debounceRef.current) {
        try {
          clearTimeout(debounceRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [collectionId]);

  // debounced søgning i den nuværende items-liste
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

  const total = items.length;
  const count = visibleItems.length;
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
    ? `/users/${meUid}/collections/${collectionId}/add-category`
    : "#";

  return (
    <main className="landing-container">
      <div className="landing-text">
        <h1 className="page-title">{col?.title || "Untitled collection"}</h1>
      </div>

      {/* Empty state: kun én knap + tekst */}
      {total === 0 ? (
        <div>
          <h3 className="aftersignup-subtitle">
            This {(typeLabel || "collection").toLowerCase()} is empty. Add your
            first item!
          </h3>
          <Link
            to={addItemHref}
            className="get-started-btn create-collection-btn"
            aria-label="Add items"
          >
            Add items +
          </Link>
        </div>
      ) : (
        <>
          <div className="search-container">
            <input
              type="search"
              onChange={onSearchChange}
              placeholder="Search in this collection"
              className="search-input"
              aria-label="Search items"
            />
            {searching && <span className="search-hint">Searching…</span>}
            {q && !searching && (
              <span className="search-hint">
                Showing {count}/{total}
              </span>
            )}
          </div>
          {/* Når der er items: ekstra knap + søgning */}

          {count === 0 ? (
            <p className="aftersignup-subtitle">No items match your search.</p>
          ) : (
            <div className="collection-grid">
              {visibleItems.map((it) => (
                <article
                  key={it.id}
                  className="collection-card"
                  aria-label={it.title}
                >
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
                  <h3 className="item-title">{it.title}</h3>
                  {it.author ? <p className="item-sub">{it.author}</p> : null}
                </article>
              ))}
            </div>
          )}
          <div className="landing-page-btns">
            <Link
              to={addCategoryHref}
              className="login-btn"
              aria-label="Add category"
            >
              Add category +
            </Link>

            <Link
              to="/additem"
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
