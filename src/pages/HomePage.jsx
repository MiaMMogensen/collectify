import { useEffect, useState } from "react";
import { ensureAnonAuth } from "../../firebase-config.js"; // ret stien hvis nødvendigt

export default function HomePage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBooks() {
      try {
        const base = import.meta.env.VITE_FIREBASE_DATABASE_URL;
        if (!base) {
          throw new Error(
            "Mangler VITE_FIREBASE_DATABASE_URL. Tjek .env og genstart dev-serveren."
          );
        }

        // Sørg for anonym auth (hvis regler kræver det)
        await ensureAnonAuth().catch(() => {});

        const baseUrl = base.replace(/\/$/, "");
        const url = `${baseUrl}/items.json`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} – kunne ikke hente data`);
        }

        const data = await res.json();

        // Konverter objekt → array
        const list = data
          ? Object.entries(data)
              .map(([id, value]) => ({ id, ...value }))
              // filtrér kun bøger (hvis du har andre typer)
              .filter((item) => item.type === "book")
          : [];

        setBooks(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ukendt fejl");
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
  }, []);

  return (
    <section
      className="page"
      style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}
    >
      <h1>Vores bøger 📚</h1>
      <p>Her kan du se alle bøger fra databasen.</p>

      {loading && <p>Henter bøger…</p>}
      {error && <p style={{ color: "red" }}>Fejl: {error}</p>}

      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}
        >
          {books.length === 0 ? (
            <p>Ingen bøger fundet.</p>
          ) : (
            books.map((book) => (
              <article
                key={book.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                  background: "white",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {book.images?.cover && (
                  <img
                    src={book.images.cover}
                    alt={book.title}
                    style={{
                      width: "100%",
                      height: 180,
                      objectFit: "cover",
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  />
                )}

                <h2 style={{ marginBottom: 4 }}>{book.title}</h2>
                <p style={{ margin: 0 }}>
                  <strong>Forfatter:</strong> {book.author ?? "Ukendt"}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Tags:</strong>{" "}
                  {Array.isArray(book.tags)
                    ? book.tags.join(", ")
                    : "Ingen tags"}
                </p>
                <p style={{ margin: "8px 0" }}>
                  <strong>Beskrivelse:</strong> {book.description ?? "—"}
                </p>
                {book.external?.link && (
                  <a
                    href={book.external.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      color: "#1976d2",
                    }}
                  >
                    Læs mere →
                  </a>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
