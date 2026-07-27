import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import OrientationGate from "./components/OrientationGate";
import { initProgressRecorder } from "./progress/recorder";
import "./styles/theme.css";

// Begin recording practice history before the app mounts so every event is captured.
initProgressRecorder();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OrientationGate>
      <App />
    </OrientationGate>
  </React.StrictMode>
);
