import Link from "next/link";
import AdminRouteEditor from "./AdminRouteEditor";
import AdminReports from "./AdminReports";

export default function AdminPage() {
  return (
    <main className="admin-page">
      <nav className="nav shell inner-nav">
        <Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link>
        <div className="nav-links"><Link href="/centres">View website</Link><Link href="/auth/login">Log in</Link></div>
      </nav>
      <section className="shell admin-shell">
        <div className="admin-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Content operations</p><h1>Route control room</h1><p>Manage published routes and the points drivers need to watch.</p></div><span className="admin-badge">Admin only</span></div>
        <AdminRouteEditor />
        <AdminReports />
      </section>
    </main>
  );
}
