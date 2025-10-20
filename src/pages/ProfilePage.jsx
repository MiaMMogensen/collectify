import { Link } from "react-router";
import { auth } from "../../firebase-config";
import Nav from "../components/Nav";
import favourites from "../assets/icons/favourites.svg";

export default function ProfilePage() {
  const user = auth.currentUser;
  const uid = user?.uid;

  return (
    <main className="page-container">
      <div className="profile-header">
        <h1 className="page-title">Profile</h1>

        {uid && (
          <Link
            to={`/wishlist`}
            className="wishlist-link get-started-btn"
            aria-label="Go to your wishlist"
          >
            <img
              src={favourites}
              alt="Wishlist"
              className="wishlist-icon"
              aria-hidden="true"
            />
            <span>Wishlist</span>
          </Link>
        )}
      </div>

      <p className="aftersignup-subtitle">This is your profile page.</p>

      <Nav />
    </main>
  );
}
