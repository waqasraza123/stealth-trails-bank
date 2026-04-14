import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@stealth-trails-bank/ui-foundation/styles.css";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeUserStore } from "./stores/userStore";

async function bootstrap() {
  try {
    await initializeUserStore();
  } catch (error) {
    console.error("Failed to initialize persisted user state.", error);
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
