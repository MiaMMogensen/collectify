// DetailPage.jsx
import { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router";
import { db, auth } from "../../firebase-config";
import {
  ref as dbRef,
  get,
  push,
  update,
  remove,
  onValue,
  off,
} from "firebase/database";
import Nav from "../components/Nav";
import backArrow from "../assets/icons/backarrow.svg";

export default function DetailPage() {
  const { id, uid: routeUid, collectionId } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [processing, setProcessing] = useState(false);
  const [isInUserCollection, setIsInUserCollection] = useState(false);
  const [userCollectionItemId, setUserCollectionItemId] = useState(null);

  // wishlist state (true <=> findes i den LOGGEDE brugers wishlist)
  const [isInWishlist, setIsInWishlist] = useState(false);

  // ref til at holde nuværende snapshot-compare-id (sourceItemId eller id)
  const comparableIdRef = useRef(null);

  // --- helper fetch functions ---
  async function fetchGlobalItem(globalId) {
    if (!globalId) return null;
    const snap = await get(dbRef(db, `items/${globalId}`));
    return snap.exists() ? { id: snap.key, ...snap.val() } : null;
  }

  async function fetchUserCollectionItem(userId, collItemId) {
    const snap = await get(
      dbRef(db, `users/${userId}/collectionItems/${collItemId}`)
    );
    return snap.exists() ? { id: snap.key, ...snap.val() } : null;
  }

  async function findUserCollectionItemBySource(userId, globalId) {
    const snap = await get(dbRef(db, `users/${userId}/collectionItems`));
    if (!snap.exists()) return null;
    let found = null;
    snap.forEach((ch) => {
      const val = ch.val();
      if (val?.sourceItemId === globalId || ch.key === globalId) {
        found = { id: ch.key, ...val };
        return true;
      }
    });
    return found;
  }

  // --- load item and compute comparableId ---
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setItem(null);
    setIsInUserCollection(false);
    setUserCollectionItemId(null);
    setIsInWishlist(false);
    comparableIdRef.current = null;

    (async () => {
      try {
        const currentUid = auth.currentUser?.uid;

        // 1) hvis routeUid er angivet, tjek users/{routeUid}/collectionItems/{id}
        if (routeUid) {
          const userItem = await fetchUserCollectionItem(routeUid, id);
          if (userItem) {
            if (mounted) {
              setIsInUserCollection(currentUid === routeUid);
              setUserCollectionItemId(userItem.id);
            }
            const global = userItem.sourceItemId
              ? await fetchGlobalItem(userItem.sourceItemId)
              : null;
            const merged = {
              ...global,
              ...userItem,
              images: {
                ...(global?.images || {}),
                ...(userItem?.images || {}),
              },
              external: {
                ...(global?.external || {}),
                ...(userItem?.external || {}),
              },
            };
            if (mounted) setItem(merged);
            // set comparable id used for wishlist matching
            comparableIdRef.current =
              userItem.sourceItemId || userItem.id || null;
            if (mounted) setLoading(false);
            return;
          }

          // 1b) find by sourceItemId i user's collection
          const foundBySource = await findUserCollectionItemBySource(
            routeUid,
            id
          );
          if (foundBySource) {
            if (mounted) {
              setIsInUserCollection(currentUid === routeUid);
              setUserCollectionItemId(foundBySource.id);
            }
            const global = await fetchGlobalItem(foundBySource.sourceItemId);
            const merged = {
              ...global,
              ...foundBySource,
              images: {
                ...(global?.images || {}),
                ...(foundBySource?.images || {}),
              },
              external: {
                ...(global?.external || {}),
                ...(foundBySource?.external || {}),
              },
            };
            if (mounted) setItem(merged);
            comparableIdRef.current =
              foundBySource.sourceItemId || foundBySource.id || null;
            if (mounted) setLoading(false);
            return;
          }
        }

        // 2) fallback: global item
        const globalItem = await fetchGlobalItem(id);
        if (globalItem) {
          if (mounted) setItem(globalItem);
          comparableIdRef.current =
            globalItem.sourceItemId || globalItem.id || null;
          if (mounted) setLoading(false);

          // tjek om current user har en kopi i sin collection (for delete-knap)
          if (currentUid) {
            const userCopy = await findUserCollectionItemBySource(
              currentUid,
              id
            );
            if (userCopy && mounted) {
              setIsInUserCollection(true);
              setUserCollectionItemId(userCopy.id);
            }
          }
          return;
        }

        // 3) fallback via collections/categories mapping (som tidligere)
        if (routeUid && collectionId) {
          try {
            const categoriesSnap = await get(
              dbRef(
                db,
                `users/${routeUid}/collections/${collectionId}/categories`
              )
            );
            if (categoriesSnap.exists()) {
              let possibleCollItemId = null;
              categoriesSnap.forEach((catCh) => {
                const catVal = catCh.val();
                if (catVal?.items && typeof catVal.items === "object") {
                  if (catVal.items[id]) {
                    possibleCollItemId = id;
                    return true;
                  }
                }
              });
              if (possibleCollItemId) {
                const found = await fetchUserCollectionItem(
                  routeUid,
                  possibleCollItemId
                );
                if (found) {
                  if (mounted) {
                    setIsInUserCollection(auth.currentUser?.uid === routeUid);
                    setUserCollectionItemId(found.id);
                  }
                  const global = await fetchGlobalItem(found.sourceItemId);
                  const merged = {
                    ...global,
                    ...found,
                    images: {
                      ...(global?.images || {}),
                      ...(found?.images || {}),
                    },
                    external: {
                      ...(global?.external || {}),
                      ...(found?.external || {}),
                    },
                  };
                  if (mounted) setItem(merged);
                  comparableIdRef.current =
                    found.sourceItemId || found.id || null;
                  if (mounted) setLoading(false);
                  return;
                }
              }
            }
          } catch {
            // ignore
          }
        }

        if (mounted) {
          setError("Item ikke fundet.");
          setLoading(false);
        }
      } catch (err) {
        console.error("DetailPage fetch error:", err);
        if (mounted) {
          setError("Der skete en fejl ved hentning af item.");
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, routeUid, collectionId]);

  // --- live wishlist listener for den loggede bruger ---
  useEffect(
    () => {
      // vi sætter listener på users/{uid}/wishlist og opdaterer isInWishlist når snapshot ændrer sig
      const unsubscribeRefs = [];
      function attachWishlistListener(uid) {
        const ref = dbRef(db, `users/${uid}/wishlist`);
        const listener = (snap) => {
          // compute whether any entry matches comparableIdRef.current
          const compId = comparableIdRef.current;
          if (!compId) {
            setIsInWishlist(false);
            return;
          }
          if (!snap.exists()) {
            setIsInWishlist(false);
            return;
          }
          let found = false;
          snap.forEach((ch) => {
            const val = ch.val();
            if (val?.sourceItemId === compId || val?.itemId === compId) {
              found = true;
              return true;
            }
          });
          setIsInWishlist(found);
        };
        onValue(ref, listener);
        unsubscribeRefs.push(() => off(ref, "value", listener));
      }

      const user = auth.currentUser;
      if (user && user.uid) {
        attachWishlistListener(user.uid);
      } else {
        // hvis bruger endnu ikke logged in, vent på auth-change
        // du kan evt. lytte på auth state change i dit auth-setup; her antager vi auth.currentUser kan ændre sig —
        // hvis du har et auth state listener centralt, overvej at flytte denne logic dertil.
      }

      return () => {
        unsubscribeRefs.forEach((fn) => fn());
      };
    },
    [
      /* kun kør én gang; leverer updates via comparableIdRef og onValue callback */
    ]
  );

  // --- Add to wishlist (venter på DB-skrivning før state opdateres) ---
  async function handleAddToWishlist() {
    setError("");
    setProcessing(true);
    try {
      const user = auth.currentUser;
      if (!user?.uid)
        throw new Error("Du skal være logget ind for at tilføje til wishlist.");
      const uid = user.uid;

      // compute comp id for matching
      const compId = comparableIdRef.current || item?.id || item?.sourceItemId;
      if (!compId) throw new Error("Kunne ikke bestemme item-id.");

      // check duplicates precisely
      const wishlistSnap = await get(dbRef(db, `users/${uid}/wishlist`));
      if (wishlistSnap.exists()) {
        let already = false;
        wishlistSnap.forEach((ch) => {
          const val = ch.val();
          if (val?.sourceItemId === compId || val?.itemId === compId) {
            already = true;
            return true;
          }
        });
        if (already) {
          setIsInWishlist(true);
          setProcessing(false);
          return;
        }
      }

      // push new wishlist entry
      const newRef = push(dbRef(db, `users/${uid}/wishlist`));
      const payload = {
        id: newRef.key,
        itemId: compId,
        sourceItemId: compId,
        title: item?.title || "",
        author: item?.author || "",
        coverImage: item?.images?.cover || item?.coverImage || null,
        createdAt: Date.now(),
      };

      // write (opdater parent path, så placeholder ikke overskrives)
      await update(dbRef(db), {
        [`users/${uid}/wishlist/${newRef.key}`]: payload,
      });

      // kun når DB-skriv lykkes sætter vi UI-state; live-listener vil også opfange ændringen
      setIsInWishlist(true);
      setProcessing(false);
    } catch (err) {
      console.error("Add to wishlist error:", err);
      setError(err?.message || "Kunne ikke tilføje til wishlist.");
      setProcessing(false);
    }
  }

  // --- Delete from collection (uændret logik bortset fra opsætning af state) ---
  async function handleDeleteFromCollection() {
    setProcessing(true);
    try {
      const user = auth.currentUser;
      if (!user?.uid) throw new Error("Du skal være logget ind.");
      const uid = user.uid;
      if (!userCollectionItemId) throw new Error("Intet item-id fundet.");

      // fjern node
      await remove(
        dbRef(db, `users/${uid}/collectionItems/${userCollectionItemId}`)
      );

      // forsøg også at fjerne mapping i collections/categories/*/items hvis relevant
      const collectionsSnap = await get(dbRef(db, `users/${uid}/collections`));
      if (collectionsSnap.exists()) {
        const updates = {};
        collectionsSnap.forEach((collCh) => {
          const collVal = collCh.val();
          if (collVal?.categories) {
            Object.entries(collVal.categories).forEach(([catKey, catVal]) => {
              if (catVal?.items && catVal.items[userCollectionItemId]) {
                updates[
                  `users/${uid}/collections/${collCh.key}/categories/${catKey}/items/${userCollectionItemId}`
                ] = null;
              }
            });
          }
        });
        if (Object.keys(updates).length > 0) {
          await update(dbRef(db), updates);
        }
      }

      setIsInUserCollection(false);
      setUserCollectionItemId(null);
      setProcessing(false);
    } catch (err) {
      console.error("Delete from collection error:", err);
      setError(err?.message || "Kunne ikke slette item fra collection.");
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <main className="item-page">
        <p className="loading-text">Henter item…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="item-page">
        <p className="error-text">{error}</p>
        <Nav />
      </main>
    );
  }

  // render
  const title = item?.title || "Untitled";
  const author = item?.author || "Unknown";
  const cover = item?.images?.cover || item?.coverImage || "/placeholder.png";
  const tags = item?.tags || [];
  const description = item?.description || item?.summary || "";

  const currentUid = auth.currentUser?.uid;
  const canDelete =
    isInUserCollection &&
    currentUid &&
    (routeUid ? routeUid === currentUid : true);

  return (
    <main className="item-page">
      <Link
        to={`/users/${
          routeUid || auth.currentUser?.uid
        }/collections/${collectionId}`}
        className="back-arrow-link"
      >
        <img src={backArrow} alt="Back" className="back-arrow" />
      </Link>

      <div className="item-card">
        <div className="item-body">
          <h1 className="page-title item-title">{title}</h1>
          <div className="item-author">{author}</div>

          {tags.length > 0 && (
            <ul className="item-tags">
              {tags.map((t, i) => (
                <li key={i} className="tag">
                  {t}
                </li>
              ))}
            </ul>
          )}

          <div className="media-row">
            <div className="media-left">
              {cover ? (
                <img
                  className="item-cover gradient-frame"
                  src={cover}
                  alt={title}
                />
              ) : (
                <div className="item-cover placeholder">No image</div>
              )}
            </div>

            <div className="media-right">
              <p className="item-description">{description}</p>

              <div className="item-actions">
                {canDelete ? (
                  <button
                    className="wishlist-btn delete-btn login-btn"
                    onClick={handleDeleteFromCollection}
                    disabled={processing}
                  >
                    {processing ? "Sletter…" : "Delete"}
                  </button>
                ) : (
                  <button
                    className={`wishlist-btn login-btn ${
                      isInWishlist ? "added" : ""
                    }`}
                    onClick={!isInWishlist ? handleAddToWishlist : undefined}
                    disabled={processing || isInWishlist}
                  >
                    {isInWishlist
                      ? "Added to wishlist"
                      : processing
                      ? "Tilføjer…"
                      : "Add to wishlist"}
                  </button>
                )}

                {item?.external?.link ? (
                  <a
                    className="getit-btn get-started-btn"
                    href={item.external.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get it here
                  </a>
                ) : (
                  <button className="getit-btn disabled" disabled>
                    Get it here
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Nav />
    </main>
  );
}
