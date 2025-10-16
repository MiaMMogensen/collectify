import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router";
import { auth, db } from "../../firebase-config";
import { ref, child, get } from "firebase/database";
import Nav from "../components/Nav";
import backArrow from "../assets/icons/backarrow.svg";

/* ---------- helpers (samme stil som CollectionPage) ---------- */
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
    val?.images?.cover,
    val?.coverImage,
    val?.imageUrl,
    val?.image,
    val?.thumbnail,
    val?.volumeInfo?.imageLinks?.thumbnail,
    val?.volumeInfo?.imageLinks?.smallThumbnail,
    Array.isArray(val?.images) ? val.images[0] : "",
  ];

  // fold objekter ud (nogle API'er returnerer { url: "..."} osv.)
  const extract = (x) => {
    if (typeof x === "string") return x;
    if (x && typeof x === "object") {
      return x.url || x.src || x.href || x.thumbnail || "";
    }
    return "";
  };

  let u =
    candidates
      .map(extract)
      .find((s) => typeof s === "string" && s.trim().length > 0) || "";

  return u.trim().replace(/^["']|["']$/g, "");
}

function itemMatchesCategory(item, categoryId, categoryTitle) {
  // fleksibel matching: støtter flere mulige felter/strukturer
  const id = String(categoryId || "").trim();
  const title = String(categoryTitle || "")
    .trim()
    .toLowerCase();

  const catId = String(item?.categoryId || item?.categoryID || "").trim();
  const catKey = String(item?.categoryKey || "").trim();

  const cat = (item?.category || item?.Category || "").toString().toLowerCase();
  const catName = (item?.categoryName || "").toString().toLowerCase();

  const catIds = Array.isArray(item?.categoryIds) ? item.categoryIds : [];
  const cats = Array.isArray(item?.categories)
    ? item.categories.map((c) => (c?.title || c)?.toString().toLowerCase())
    : [];

  // match via id
  if (id && (catId === id || catKey === id || catIds.includes(id))) return true;

  // match via titler/navne
  if (title) {
    if (cat === title || catName === title) return true;
    if (cats.includes(title)) return true;
  }

  return false;
}

async function loadCollection({ userRoot, collectionId }) {
  const snap = await get(
    child(ref(db), `${userRoot}/collections/${collectionId}`)
  );
  if (!snap.exists()) return null;
  return snap.val() || null;
}

async function loadCategory({ userRoot, collectionId, categoryId }) {
  const path = `${userRoot}/collections/${collectionId}/categories/${categoryId}`;
  const snap = await get(child(ref(db), path));
  if (!snap.exists()) return null;
  const val = snap.val() || {};
  return {
    id: val.id || categoryId,
    title: val.title || "Untitled",
    coverImage: pickImage(val),
    createdAt: Number(val.createdAt || 0),
    ...val,
  };
}

async function loadItemsForCollection({ userRoot, collectionId, colType }) {
  const nestedPath = `${userRoot}/collectionItems/${collectionId}`;
  const flatPath = `${userRoot}/collectionItems`;
  let list = [];
  let mode = "flat"; // hvis du vil gemme den

  const getCover = (val) => {
    const candidates = [
      val?.images?.cover,
      val?.coverImage,
      val?.imageUrl,
      val?.image,
      val?.thumbnail,
    ];
    let u = (
      candidates.find((x) => typeof x === "string" && x.trim()) || ""
    ).trim();
    return u.replace(/^["']|["']$/g, "");
  };

  // 1) PRØV NESTED FØRST, men IGNORÉR tomme noder
  try {
    const snap = await get(child(ref(db), nestedPath));
    if (snap.exists()) {
      const obj = snap.val() || {};
      for (const [key, val] of Object.entries(obj)) {
        if (!val || typeof val !== "object" || key === "_placeholder") continue;

        const title = String(val.title || val.name || "").trim();
        const cover = getCover(val);
        // Skip “spøgelsesnoder” som kun indeholder kategori-felter
        if (!title && !cover) continue;

        list.push({
          id: key,
          title: title || "Untitled",
          author: val.author || val.artist || "",
          coverImage: cover,
          type: normType(val.type || colType),
          collectionId,
          createdAt: Number(val.createdAt || 0),
          ...val,
        });
      }
      if (list.length > 0) mode = "nested";
    }
  } catch (err) {
    console.warn("loadItemsForCollection (nested) error:", err);
  }

  // 2) Fallback til FLAT hvis nested ikke gav rigtige items
  if (mode !== "nested") {
    list = [];
    try {
      const snap = await get(child(ref(db), flatPath));
      if (snap.exists()) {
        const obj = snap.val() || {};
        for (const [key, val] of Object.entries(obj)) {
          if (!val || typeof val !== "object" || key === "_placeholder")
            continue;
          const title = String(val.title || val.name || "").trim();
          const cover = getCover(val);
          if (!title && !cover) continue;

          list.push({
            id: key,
            title: title || "Untitled",
            author: val.author || val.artist || "",
            coverImage: cover,
            type: normType(val.type || colType),
            collectionId: val.collectionId,
            createdAt: Number(val.createdAt || 0),
            ...val,
          });
        }
        mode = "flat";
      }
    } catch (err) {
      console.warn("loadItemsForCollection (flat) error:", err);
    }
  }

  // eventuelt filter på type
  const tf = normType(colType);
  if (tf) list = list.filter((it) => it.type === tf);

  // nyeste først
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return list; // hvis du vil bruge mode, returnér { list, mode }
}

/* ---------- component ---------- */
export default function CategoryPage() {
  const { uid, collectionId, categoryId } = useParams();
  const [cat, setCat] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // søgning (valgfrit – matcher CollectionPage UX)
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setErr("");
      setLoading(true);
      try {
        // tillad både route-uid og auth.currentUser
        const me = auth.currentUser;
        const myUid = uid || me?.uid;
        if (!myUid) {
          setErr("You must be logged in.");
          setLoading(false);
          return;
        }
        const userRoot = `users/${myUid}`;

        // 1) collection (for type + topbar titel-stil)
        const colData = await loadCollection({ userRoot, collectionId });
        if (!colData) {
          setErr("Collection not found.");
          setLoading(false);
          return;
        }

        // 2) category (for kategoriens titel/cover)
        const catData = await loadCategory({
          userRoot,
          collectionId,
          categoryId,
        });
        if (!catData) {
          setErr("Category not found.");
          setLoading(false);
          return;
        }

        // 3) hent ALLE items for collection/type
        const colType = normType(colData?.type);
        const list = await loadItemsForCollection({
          userRoot,
          collectionId,
          colType,
        });

        // 4) filtrér til kun items i denne kategori (robust match)
        const filtered = list.filter((it) =>
          itemMatchesCategory(it, catData.id, catData.title)
        );

        if (!alive) return;
        setCat(catData);
        setItems(filtered);
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr("Could not load category.");
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
  }, [uid, collectionId, categoryId]);

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

  return (
    <main className="landing-container" style={{ paddingBottom: 130 }}>
      {/* Top – samme stil som CollectionPage */}
      <div className="landing-text">
        <Link
          to={`/users/${
            uid || auth.currentUser?.uid
          }/collections/${collectionId}`}
          className="back-arrow-link"
          aria-label="Go back to collection"
        >
          <img src={backArrow} alt="Back" className="back-arrow" />
        </Link>
        <h1 className="page-title">{cat?.title || "Untitled category"}</h1>
      </div>

      {/* Søgning (valgfri – matcher din UX) */}
      <div className="search-container">
        <input
          type="search"
          onChange={onSearchChange}
          placeholder={`Search in ${cat?.title || "category"}`}
          className="search-input"
          aria-label="Search items in category"
        />
        {searching && <span className="search-hint">Searching…</span>}
      </div>

      {/* Items som GRID (2 kolonner) */}
      {visibleItems.length === 0 ? (
        <div>
          <h3 className="aftersignup-subtitle">
            No items in this category yet. Add your first item!
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
      )}
      {/* Bottom CTA – always visible */}
      <div className="get-started-btn create-collection-btn">
        <Link
          to={`/users/${
            uid || auth.currentUser?.uid
          }/collections/${collectionId}/categories/${cat?.id}/add-items`}
          aria-label="Add items to this category"
        >
          Add items to this category
        </Link>
      </div>

      <Nav />
    </main>
  );
}
