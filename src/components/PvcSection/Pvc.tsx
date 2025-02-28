import { useNavigate } from "react-router-dom";
import Create from "./components/CreateGameVsComp";

const Pvc = () => {
  const navigate = useNavigate();

  return (
    <>
      <button onClick={() => navigate("/")} className="back-button">
        Back to Home
      </button>
      <Create />
    </>
  );
};

export default Pvc;
