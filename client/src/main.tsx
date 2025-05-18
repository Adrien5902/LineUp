import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./components/App";

// biome-ignore lint/style/noNonNullAssertion: <explanation>
createRoot(document.getElementById("root")!).render(<App />);
