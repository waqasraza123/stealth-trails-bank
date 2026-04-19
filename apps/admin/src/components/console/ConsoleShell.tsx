import { NavLink } from "react-router-dom";
import { Search, ShieldCheck } from "lucide-react";
import { ReactNode } from "react";
import {
  AdminReveal,
  AdminStage,
  AdminStagger,
  AdminStaggerItem
} from "@/components/motion/primitives";

type ConsoleShellProps = {
  navItems: Array<{ label: string; path: string }>;
  routeLabel: string;
  heading: string;
  description: string;
  healthLabel: string;
  healthTone: "neutral" | "positive" | "warning" | "critical" | "technical";
  incidentCount: number;
  operatorLabel: string;
  environmentLabel: string;
  topActions: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
};

export function ConsoleShell({
  navItems,
  routeLabel,
  heading,
  description,
  healthLabel,
  healthTone,
  incidentCount,
  operatorLabel,
  environmentLabel,
  topActions,
  sidebar,
  children
}: ConsoleShellProps) {
  return (
    <div className="admin-shell-bg">
      <div className="admin-shell relative">
        <div className="admin-ambient-orb admin-ambient-orb--emerald left-[-3rem] top-[8rem] h-40 w-40" />
        <div className="admin-ambient-orb admin-ambient-orb--indigo right-[10rem] top-[3rem] h-44 w-44" />
        <AdminReveal className="admin-sidebar">
          <div className="admin-brand">
            <p className="admin-kicker">Stealth Trails Bank</p>
            <h1>{heading}</h1>
            <p className="admin-copy">{description}</p>
          </div>

          <AdminStagger className="admin-nav" delay={0.08}>
            {navItems.map((item) => (
              <AdminStaggerItem key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    isActive ? "admin-nav-link active" : "admin-nav-link"
                  }
                >
                  {item.label}
                </NavLink>
              </AdminStaggerItem>
            ))}
          </AdminStagger>

          <div className="admin-sidebar-card">{sidebar}</div>
        </AdminReveal>

        <AdminStage className="admin-main">
          <header className="admin-hero relative overflow-hidden">
            <div className="admin-hero-copy">
              <div className="admin-ribbon">
                <ShieldCheck className="h-4 w-4" />
                <span>Controlled system identity</span>
              </div>
              <p className="admin-kicker">Active workspace</p>
              <h2>{routeLabel}</h2>
              <p className="admin-copy">
                Governed actions, evidence, and operational state remain visible in one
                reviewable surface.
              </p>
            </div>

            <div className="admin-hero-side">
              <div className="admin-system-strip">
                <div>
                  <span className="label">System health</span>
                  <strong>
                    <span className="admin-status-badge" data-tone={healthTone}>
                      {healthLabel}
                    </span>
                  </strong>
                </div>
                <div>
                  <span className="label">Active incidents</span>
                  <strong>{incidentCount}</strong>
                </div>
                <div>
                  <span className="label">Operator</span>
                  <strong>{operatorLabel}</strong>
                </div>
                <div>
                  <span className="label">Environment</span>
                  <strong>
                    <Search className="inline-block h-4 w-4" /> {environmentLabel}
                  </strong>
                </div>
              </div>
              <div className="admin-top-actions">{topActions}</div>
            </div>
          </header>

          <div className="admin-content">{children}</div>
        </AdminStage>
      </div>
    </div>
  );
}
