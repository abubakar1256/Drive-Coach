"use client";

import { useState } from "react";

type MenuLink = { href: string; label: string };

export default function MobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const menuId = "mobile-navigation-menu";

  return (
    <div className="mobile-menu">
      <button className="menu-button" type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-controls={menuId} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "×" : "☰"}
      </button>
      {open && (
        <div className="mobile-menu-panel" id={menuId}>
          {links.map((link) => <a href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}
        </div>
      )}
    </div>
  );
}
