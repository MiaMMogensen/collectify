import landingPage from "../assets/img/landingpage.png";
import arrowIcon from "../assets/img/arrow.svg";
import { Link } from "react-router";
import { ensureAnonAuth } from "../../firebase-config";
import { useEffect } from "react";

export default function LandingPage() {
  useEffect(() => {
    ensureAnonAuth({ allowGuest: true, timeoutMs: 2000 });
  }, []);
  return (
    <main>
      <h1 className="landing-page-title">Get Collectify-ing Today!</h1>
      <div className="landing-page-container">
        <div className="gradient-frame">
          <img
            className="landing-page-image"
            src={landingPage}
            alt="Landing Page image"
          />
        </div>
      </div>

      <div className="landing-page-btns">
        <Link to="/login" className="login-btn" aria-label="Login">
          Login
        </Link>
        <Link to="/signup" className="get-started-btn" aria-label="Get Started">
          Get Started
          <img
            src={arrowIcon}
            alt="white arrow icon"
            className="arrow-icon"
            aria-hidden="true"
          />
        </Link>
      </div>
    </main>
  );
}
