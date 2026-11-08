import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { IoClose, IoMenu } from "react-icons/io5";
import { Discovery } from "./pages/Discovery";
import { VolumePage } from "./pages/VolumePage";
import { Gallery } from "./pages/Gallery";
import { Shelf } from "./pages/Shelf";
import { IssuePage } from "./pages/IssuePage";
import { History } from "./pages/History";
import { Creators } from "./pages/Creators";
import { Characters } from "./pages/Characters";
import { CharacterPage } from "./pages/CharacterPage";

const navLink = ({ isActive }: { isActive: boolean }) =>
  "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors " +
  (isActive
    ? "border-accent text-accent"
    : "border-transparent text-muted hover:text-body");

const mobileNavLink = ({ isActive }: { isActive: boolean }) =>
  "border-l-2 px-4 py-3 text-sm transition-colors " +
  (isActive
    ? "border-accent text-accent"
    : "border-transparent text-muted hover:text-body");

const LINKS = [
  { to: "/", end: true, label: "Discovery" },
  { to: "/gallery", label: "Gallery" },
  { to: "/shelf", label: "Shelf" },
  { to: "/history", label: "History" },
  { to: "/creators", label: "Creators" },
  { to: "/characters", label: "Characters" },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-base text-body">
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center gap-1 px-6 py-0.5">
          <span className="mr-8 whitespace-nowrap font-display text-sm font-medium tracking-[0.22em] text-body">
            COMICLIB
          </span>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={navLink}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="ml-auto rounded-md p-2 text-muted transition-colors hover:text-body md:hidden"
          >
            {menuOpen ? (
              <IoClose className="h-5 w-5" />
            ) : (
              <IoMenu className="h-5 w-5" />
            )}
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-line md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={closeMenu}
                  className={mobileNavLink}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Discovery />} />
          <Route path="/volume/:id" element={<VolumePage />} />
          <Route path="/volume/:id/issues/:issueId" element={<IssuePage />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/shelf" element={<Shelf />} />
          <Route path="/history" element={<History />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/character/:id" element={<CharacterPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
