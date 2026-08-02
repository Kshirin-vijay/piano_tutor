import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import MusicDecor from "./components/MusicDecor";
import OrientationGate from "./components/OrientationGate";
import { initProgressRecorder } from "./progress/recorder";
import "./styles/theme.css";

initProgressRecorder();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MusicDecor />
    <OrientationGate>
      <App />
    </OrientationGate>
  </React.StrictMode>
);
