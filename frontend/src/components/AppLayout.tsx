import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/clients", label: "Clients" },
  { to: "/matters", label: "Matters" },
  { to: "/billing", label: "Billing" },
  { to: "/portal", label: "Portal" },
  { to: "/settings", label: "Org Settings" }
];

const AppLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold text-primary-600">Maple Legal</h1>
            <p className="text-xs text-slate-500">Ontario legal operations suite</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user?.first_name} {user?.last_name}</span>
            <button
              onClick={logout}
              className="rounded border border-slate-200 px-3 py-1 text-sm hover:border-primary-500 hover:text-primary-600"
            >
              Logout
            </button>
          </div>
        </div>
        <nav className="bg-slate-50">
          <ul className="mx-auto flex max-w-6xl gap-6 px-4 py-2 text-sm">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `pb-1 ${isActive ? "border-b-2 border-primary-600 font-medium" : "text-slate-600 hover:text-primary-500"}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex-grow bg-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white py-2 text-center text-xs text-slate-500">
        Data stored in {import.meta.env.VITE_CA_REGION ?? "ca-central-1"}
      </footer>
    </div>
  );
};

export default AppLayout;
