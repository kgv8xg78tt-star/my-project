import { Outlet, useLocation } from "react-router-dom";
import SiteHeader from "./SiteHeader";

export default function AppLayout() {
  const location = useLocation();
  const isProjectPage =
    location.pathname.startsWith("/commercial-offers/") &&
    location.pathname.slice("/commercial-offers/".length).length > 0;

  return (
    <div className="app-shell">
      <SiteHeader
        showBack={isProjectPage}
        eyebrow={isProjectPage ? "Коммерческие предложения" : undefined}
      />
      <Outlet />
    </div>
  );
}
