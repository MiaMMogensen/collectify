// AdminPendingItems.jsx
import { useEffect, useState } from "react";
import {
  ref as dbRef,
  onValue,
  update,
  serverTimestamp,
  get,
  set,
} from "firebase/database";
import { db, auth } from "../../firebase-config";

const VALID_TYPES = ["book", "album", "vinyl"];

export default function AdminPendingItems() {
  const [pendingItems, setPendingItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState({});

  // Hent alle pending items
  useEffect(() => {
    const pendingRef = dbRef(db, "pendingItems");
    const unsubscribe = onValue(pendingRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.entries(data)
        .filter(([, val]) => val && VALID_TYPES.includes(val.type)) // filtrer _placeholder
        .map(([key, val]) => ({ ...val, id: key }));
      setPendingItems(arr);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // DEBUG: tjek om user er admin
  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) return console.warn("Ikke logget ind");
      const snap = await get(dbRef(db, `admins/${user.uid}`));
      console.log(
        "DEBUG: admins/<uid> value:",
        snap.exists() ? snap.val() : null
      );
    })();
  }, []);

  const approveItem = async (item) => {
    if (!item?.id) return alert("Item mangler ID!");
    if (!VALID_TYPES.includes(item.type)) {
      return alert("Kan ikke approve items i placeholder collection");
    }

    setLoadingItems((prev) => ({ ...prev, [item.id]: true }));

    try {
      const itemPath = `users/${item.createdBy}/collections/${item.type}/items/${item.id}`;
      // 1️⃣ skriv item til brugerens collection
      await set(dbRef(db, itemPath), {
        ...item,
        status: "approved",
        approvedAt: serverTimestamp(),
      });

      // 2️⃣ slet fra pendingItems
      await set(dbRef(db, `pendingItems/${item.id}`), null);

      // 3️⃣ fjern fra lokal liste
      setPendingItems((prev) => prev.filter((it) => it.id !== item.id));

      alert(`Item "${item.title}" godkendt!`);
    } catch (err) {
      console.error("Approve error:", err);
      alert(
        "Noget gik galt ved godkendelsen. Tjek database-regler og admin-adgang."
      );
    } finally {
      setLoadingItems((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const rejectItem = async (item) => {
    if (!item?.id) return alert("Item mangler ID!");
    setLoadingItems((prev) => ({ ...prev, [item.id]: true }));

    try {
      await update(dbRef(db, `pendingItems/${item.id}`), null);
      setPendingItems((prev) => prev.filter((it) => it.id !== item.id));
      alert(`Item "${item.title}" afvist!`);
    } catch (err) {
      console.error("Reject error:", err);
      alert(
        "Noget gik galt ved afvisningen. Tjek database-regler og admin-adgang."
      );
    } finally {
      setLoadingItems((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Pending Items for Approval</h1>
      {pendingItems.length === 0 && <p>No items pending approval.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {pendingItems.map((item) => (
          <li
            key={item.id || item.title}
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <div>
              <strong>{item.title}</strong> ({item.type}) <br />
              by {item.author} <br />
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                View Link
              </a>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
              <button
                style={{
                  background: "green",
                  color: "white",
                  padding: "5px 10px",
                  border: "none",
                  borderRadius: "5px",
                  opacity: loadingItems[item.id] ? 0.6 : 1,
                  cursor: loadingItems[item.id] ? "not-allowed" : "pointer",
                }}
                onClick={() => approveItem(item)}
                disabled={loadingItems[item.id]}
              >
                {loadingItems[item.id] ? "Processing..." : "Approve"}
              </button>

              <button
                style={{
                  background: "red",
                  color: "white",
                  padding: "5px 10px",
                  border: "none",
                  borderRadius: "5px",
                  opacity: loadingItems[item.id] ? 0.6 : 1,
                  cursor: loadingItems[item.id] ? "not-allowed" : "pointer",
                }}
                onClick={() => rejectItem(item)}
                disabled={loadingItems[item.id]}
              >
                {loadingItems[item.id] ? "Processing..." : "Reject"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
