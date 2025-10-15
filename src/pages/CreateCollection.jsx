import { useState } from "react";
import { useNavigate } from "react-router"; // Korrekt import
import { ref as dbRef, push, update, serverTimestamp } from "firebase/database";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../../firebase-config";
import upload from "../assets/icons/uploadicon.svg";

export default function CreateCollection() {
  const [name, setName] = useState("");
  const [type, setType] = useState("books");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate(); // Bruges senere til redirect (fjern hvis du ikke vil redirecte)

  const sanitize = (raw) =>
    String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20);

  function validateName(n) {
    const s = sanitize(n);
    if (!s || s.length < 3)
      return "Navnet skal være mindst 3 tegn (a-z, 0-9 eller _).";
    return null;
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const v = validateName(name);
    if (v) return setError(v);

    if (!file) return setError("Vælg et coverbillede til collection.");

    const user = auth.currentUser;
    if (!user || !user.uid) {
      return setError("Du skal være logget ind for at oprette en collection.");
    }

    setLoading(true);

    try {
      const uid = user.uid;
      const collectionName = sanitize(name);

      // Upload til storage
      const storagePath = `users/${uid}/collections/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, storagePath);
      const uploadTask = uploadBytesResumable(sRef, file);

      const downloadUrl = await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            if (snapshot.totalBytes) {
              const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.round(p));
            }
          },
          (err) => reject(err),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      // Opret collection med multipath update
      const collectionsRef = dbRef(db, `users/${uid}/collections`);
      const newRef = push(collectionsRef);
      const collectionId = newRef.key;

      const now = serverTimestamp();

      const updates = {};
      updates[`users/${uid}/collections/${collectionId}/id`] = collectionId;
      updates[`users/${uid}/collections/${collectionId}/title`] =
        collectionName;
      updates[`users/${uid}/collections/${collectionId}/type`] = type;
      updates[`users/${uid}/collections/${collectionId}/coverImage`] =
        downloadUrl;
      updates[`users/${uid}/collections/${collectionId}/createdAt`] = now;
      updates[`users/${uid}/collections/${collectionId}/updatedAt`] = now;

      updates[`users/${uid}/collections/_placeholder`] = true;
      updates[`users/${uid}/collectionItems/_placeholder`] = true;

      await update(dbRef(db), updates); // dbRef(db) === root ref

      setSuccess("Collection oprettet!");
      setName("");
      setFile(null);
      setPreview(null);
      setUploadProgress(null);

      // Redirect til collection (fjern linjen hvis I ikke skal redirecte)
      navigate(`/users/${uid}/collections/${collectionId}`);
    } catch (err) {
      console.error("CreateCollection error:", err);
      setError(err?.message || "Noget gik galt ved oprettelsen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1 className="page-title">My next collection</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="collection-btns">
          <button
            type="button"
            onClick={() => setType("books")}
            className={`collection-btn ${type === "books" ? "active" : ""}`}
          >
            Books
          </button>
          <button
            type="button"
            onClick={() => setType("vinyl")}
            className={`collection-btn ${type === "vinyl" ? "active" : ""}`}
          >
            Vinyls
          </button>
          <button
            type="button"
            onClick={() => setType("albums")}
            className={`collection-btn ${type === "albums" ? "active" : ""}`}
          >
            Albums
          </button>
        </div>
        <div className="login-inputs login-form collection-inputs">
          <p>Name collection</p>
          <input
            type="text"
            placeholder="Enter name of collection"
            value={name}
            onChange={(e) => setName(e.target.value)}
            pattern="^[a-z0-9_]{3,20}$"
            required
          />

          <label className="cover-image-label">Add cover image</label>
          <label htmlFor="fileUpload" className="file-upload-label">
            <img
              src={upload}
              alt="image icon for upload"
              className="upload-img"
            />
          </label>
          <input
            id="fileUpload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="file-input-hidden"
          />

          {preview && (
            <div className="preview">
              <p>Preview:</p>
              <img
                src={preview}
                alt="cover preview"
                style={{ maxWidth: 240, borderRadius: 8 }}
              />
            </div>
          )}
        </div>
        <div>
          <button
            className="get-started-btn create-collection-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? "Opretter..." : "Opret collection"}
          </button>
        </div>

        {uploadProgress !== null && <div>Upload: {uploadProgress}%</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}
        {success && <div style={{ color: "green" }}>{success}</div>}
      </form>
    </main>
  );
}
