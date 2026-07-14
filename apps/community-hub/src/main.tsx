import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { CommunityHubApp } from "./CommunityHubApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CommunityHubApp />
  </StrictMode>,
);
