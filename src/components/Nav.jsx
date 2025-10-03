import { NavLink } from "react-router";

export default function Nav() {
  return (
    <nav>
      <NavLink to="/">Hjem</NavLink>
      <NavLink to="/about">Om</NavLink>
      <NavLink to="/contact">Kontakt</NavLink>
    </nav>
  );
}
