import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import NotificationBell from "./NotificationBell";
import Button from "./ui/Button";

const AppLayout = () => {
  const { user, logout } = useAuth();
  const isClient = user?.roles?.includes("Client");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [isClient]);

  const navItems = isClient
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/client/matters", label: "My Matters" },
        { to: "/client/documents", label: "My Documents" },
        { to: "/client/invoices", label: "My Invoices" },
      ]
    : [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/clients", label: "Clients" },
        { to: "/matters", label: "Matters" },
        { to: "/billing", label: "Billing" },
        { to: "/portal", label: "Portal" },
        { to: "/settings", label: "Org Settings" },
      ];

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
    : "";

  const handleNavLinkClick = () => setIsMobileNavOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:flex-nowrap">
          <div className="flex w-full items-center justify-between gap-3 md:w-auto">
            <div>
              <h1 className="text-xl font-semibold text-primary-600">Maple Legal</h1>
              <p className="text-xs text-slate-500">Ontario legal operations suite</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 md:hidden"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
              aria-expanded={isMobileNavOpen}
            >
              <span className="sr-only">Toggle navigation</span>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-3 md:w-auto md:flex-nowrap md:justify-end">
            {!isClient && (
              <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-end">
                <NotificationBell />
                <span className="text-sm text-slate-600 md:hidden">{displayName}</span>
              </div>
            )}
            <div className="flex w-full items-center justify-between gap-3 md:w-auto md:flex-nowrap">
              {isClient && <span className="text-sm text-slate-600 md:hidden">{displayName}</span>}
              <span className="hidden text-sm text-slate-600 md:inline">{displayName}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsMobileNavOpen(false);
                  logout();
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
        <nav className="border-t border-slate-200 bg-slate-50 md:border-t-0">
          <div className="mx-auto w-full max-w-6xl px-4">
            <ul className="hidden items-center gap-6 py-2 text-sm md:flex">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `pb-1 transition-colors ${
                        isActive
                          ? "border-b-2 border-primary-600 font-medium text-primary-700"
                          : "text-slate-600 hover:text-primary-600"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <ul
              className={`flex flex-col gap-2 py-3 text-sm text-slate-600 md:hidden ${
                isMobileNavOpen ? "" : "hidden"
              }`}
            >
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={handleNavLinkClick}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-md border border-transparent px-3 py-2 transition-colors ${
                        isActive
                          ? "border-primary-100 bg-white font-medium text-primary-700"
                          : "hover:border-primary-100 hover:bg-white hover:text-primary-600"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>
      <main className="flex-grow">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-6">
          <Outlet />
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        Data stored in {import.meta.env.VITE_CA_REGION ?? "ca-central-1"}
      </footer>
    </div>
  );
};

export default AppLayout;
