import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import Pvc from "./components/PvcSection/Pvc";
import Pvp from "./components/Pvp";
import FAQ from "./components/PvcSection/FAQ";
import "./App.css";

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pvc/*" element={<Pvc />} />
        <Route path="/pvp/*" element={<Pvp />} />
        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </Router>
  );
}

export default App;
