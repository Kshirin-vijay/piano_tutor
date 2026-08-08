import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import MusicDecor from "./components/MusicDecor";
import OrientationGate from "./components/OrientationGate";
import TeacherDashboard from "./dashboard/TeacherDashboard";
import { initProgressRecorder } from "./progress/recorder";
import "./styles/theme.css";

const dashboardRoute = window.location.hash === "#/dashboard";
if (!dashboardRoute) initProgressRecorder();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {dashboardRoute ? (
      <TeacherDashboard />
    ) : (
      <>
        <MusicDecor />
        <OrientationGate>
          <App />
        </OrientationGate>
      </>
    )}
  </React.StrictMode>
);
