import { NavLink } from "react-router";
import addItem from "../assets/icons/additem.svg";
import collections from "../assets/icons/collections.svg";
import favourites from "../assets/icons/favourites.svg";
import home from "../assets/icons/home.svg";
import profile from "../assets/icons/profile.svg";

export default function Nav() {
  const links = [
    { to: "/", icon: home, label: "Hjem" },
    { to: "/collections", icon: collections, label: "Samlinger" },
    { to: "/add", icon: addItem, label: "Tilføj" },
    { to: "/favourites", icon: favourites, label: "Favoritter" },
    { to: "/profile", icon: profile, label: "Profil" },
  ];

  return (
    <nav className="nav-bar">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          <div className="icon-wrapper">
            <img
              src={link.icon}
              alt={link.label}
              className={`icon-image ${
                link.icon === addItem ? "icon-add" : ""
              }`}
            />
          </div>
        </NavLink>
      ))}
    </nav>
  );
}
