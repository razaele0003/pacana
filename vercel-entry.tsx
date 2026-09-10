import { createRoot } from "react-dom/client";
import Landing from "./components/landing";
import Pacana from "./components/pacana";
import "./styles/pacana.css";
createRoot(document.getElementById("root")!).render(location.pathname.startsWith("/app") ? <Pacana /> : <Landing />);
