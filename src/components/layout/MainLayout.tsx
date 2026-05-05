import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./navigation/BottomNavigation";
import { TopNav } from "./navigation/TopNavigation";

export const MainLayout = ({ userId }: { userId: number }) => {
  const location = useLocation();

  const getTitle = () => {
    switch (location.pathname) {
      case "/history":
        return "История";
      case "/saved":
        return "Сохраненные";
      default:
        return "UMAKLER";
    }
  };

  return (
    <div className="background">
      <TopNav title={getTitle()} />

      <div className="main-data">
        <Outlet />
        <BottomNav userId={userId} />
      </div>
    </div>
  );
};