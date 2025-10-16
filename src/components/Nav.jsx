import { NavLink, useLocation } from "react-router";
import { useEffect, useState, useCallback } from "react";

import addItem from "../assets/icons/additem.svg";
import addItemOpen from "../assets/icons/additemopen.svg";
import collections from "../assets/icons/collections.svg";
import favourites from "../assets/icons/favourites.svg";
import home from "../assets/icons/home.svg";
import profile from "../assets/icons/profile.svg";

export default function Nav() {
  const [addOpen, setAddOpen] = useState(false);
  const { pathname } = useLocation();

  const links = [
    { to: "/", icon: home, label: "Hjem" },
    {
      to: "/users/:uid/collections/:collectionId",
      icon: collections,
      label: "Samlinger",
    },
    { to: "/add", icon: addItem, label: "Tilføj", isAdd: true },
    { to: "/favourites", icon: favourites, label: "Favoritter" },
    { to: "/profile", icon: profile, label: "Profil" },
  ];

  // luk hvis rute skifter
  useEffect(() => setAddOpen(false), [pathname]);

  // ESC lukker
  useEffect(() => {
    if (!addOpen) return;
    const onKey = (e) => e.key === "Escape" && setAddOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addOpen]);

  const toggleAdd = useCallback((e) => {
    e.preventDefault(); // undgå navigation til /add
    setAddOpen((v) => !v);
  }, []);

  const onAddCollection = useCallback(() => {
    // TODO: navigate("/collections/new") eller åbne modal
    setAddOpen(false);
  }, []);

  const onAddItem = useCallback(() => {
    // TODO: navigate("/items/new") eller åbne modal
    setAddOpen(false);
  }, []);

  return (
    <>
      {/* klik-udenfor for at lukke */}
      {addOpen && (
        <button
          className="add-backdrop"
          aria-label="Luk tilføj-menuen"
          onClick={() => setAddOpen(false)}
        />
      )}

      {/* GRADIENT-POPUP: bag navbaren og starter halvvejs under den */}
      {addOpen && (
        <div
          className="add-popup"
          role="dialog"
          aria-modal="true"
          id="add-popup"
        >
          <button className="add-choice" onClick={onAddCollection}>
            Add collection
          </button>
          <span className="add-divider" aria-hidden="true" />
          <button className="add-choice" onClick={onAddItem}>
            Add item
          </button>
        </div>
      )}

      <nav className={`nav-bar ${addOpen ? "is-open" : ""}`}>
        {links.map((link, idx) => {
          const isAdd = !!link.isAdd;

          // skjul andre ikoner fuldstændigt, men bevar kolonne med placeholder så grid’et står fast
          if (addOpen && !isAdd) {
            return (
              <div
                key={link.to || idx}
                className="nav-placeholder"
                aria-hidden="true"
              />
            );
          }

          const imgSrc = isAdd && addOpen ? addItemOpen : link.icon;

          return isAdd ? (
            <a
              key="add"
              href="/add"
              className="nav-link is-add"
              onClick={toggleAdd}
              aria-expanded={addOpen}
              aria-controls="add-popup"
            >
              <div className="icon-wrapper is-add">
                <img
                  src={imgSrc}
                  alt={link.label}
                  className="icon-image icon-add"
                />
              </div>
            </a>
          ) : (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <div className="icon-wrapper">
                <img src={link.icon} alt={link.label} className="icon-image" />
              </div>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
