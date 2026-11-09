import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/marcellus/latin-400.css";
import "@fontsource/marcellus-sc/latin-400.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-500.css";
import "@fontsource/eb-garamond/latin-600.css";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { NotificationProvider } from "./components/notification";
import { aplicarTempoLiturgico } from "./utils/liturgia";

aplicarTempoLiturgico();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NotificationProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </NotificationProvider>
  </React.StrictMode>,
);
