import { lazy, Suspense } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { SignIn } from "./auth";
import { useAuth } from "./use-auth";

const DashboardPage = lazy(() =>
  import("./pages").then((pages) => ({ default: pages.DashboardPage })),
);
const EmployeesPage = lazy(() =>
  import("./pages").then((pages) => ({ default: pages.EmployeesPage })),
);
const EmployeeDetailPage = lazy(() =>
  import("./pages").then((pages) => ({ default: pages.EmployeeDetailPage })),
);
const AnalyticsPage = lazy(() =>
  import("./pages").then((pages) => ({ default: pages.AnalyticsPage })),
);

function Shell() {
  const { signOut } = useAuth();
  const location = useLocation();
  const active = location.pathname.startsWith("/employees")
    ? "employees"
    : location.pathname === "/analytics"
      ? "analytics"
      : "dashboard";
  const title =
    active === "employees"
      ? "People directory"
      : active === "analytics"
        ? "Salary analytics"
        : "Overview";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">A</span>
          <span>
            <strong>acme</strong>
            <small>salary intelligence</small>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <Link
            className={
              active === "dashboard" ? "nav-link selected" : "nav-link"
            }
            to="/"
          >
            <LayoutDashboard size={18} />
            Dashboard
          </Link>
          <Link
            className={
              active === "employees" ? "nav-link selected" : "nav-link"
            }
            to="/employees"
          >
            <Users size={18} />
            Employees
          </Link>
          <Link
            className={
              active === "analytics" ? "nav-link selected" : "nav-link"
            }
            to="/analytics"
          >
            <BarChart3 size={18} />
            Analytics
          </Link>
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">HR</span>
          <span>
            <strong>HR Manager</strong>
            <small>Administrator</small>
          </span>
          <button
            aria-label="Sign out"
            className="icon-button"
            onClick={signOut}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <BriefcaseBusiness size={15} /> Workspace <span>/</span> {title}
          </div>
          <div className="topbar-right">
            <span className="secure-indicator">
              <span /> Secure workspace
            </span>
            <div className="profile-info" aria-label="Profile information">
              <span className="avatar small" aria-hidden="true">
                HR
              </span>
              <span>HR Manager</span>
            </div>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { token } = useAuth();
  return (
    <Suspense fallback={<div className="state-panel">Loading workspace…</div>}>
      <Routes>
        <Route
          path="/signin"
          element={token ? <Navigate to="/" replace /> : <SignIn />}
        />
        <Route element={token ? <Shell /> : <Navigate to="/signin" replace />}>
          <Route index element={<DashboardPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="employees/:id" element={<EmployeeDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>
        <Route
          path="*"
          element={<Navigate to={token ? "/" : "/signin"} replace />}
        />
      </Routes>
    </Suspense>
  );
}
