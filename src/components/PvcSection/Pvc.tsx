import { useNavigate } from "react-router-dom";
import Create from "./components/CreateGameVsComp";

const Pvc = () => {
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() => navigate("/")}
        className="back-button"
        style={{
          position: "absolute",
          left: "20px",
          top: "20px",
          padding: "4px 8px",
          backgroundColor: "#2c3e50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "14px",
          cursor: "pointer",
          opacity: 0.8,
          transition: "opacity 0.2s ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
      >
        ←
      </button>

      <Create />
    </>
  );
};

export default Pvc;
