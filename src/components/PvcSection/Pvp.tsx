import { useNavigate } from "react-router-dom";

const Pvp = () => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="text-center p-6 bg-white shadow-lg rounded-lg">
        <button onClick={() => navigate("/")} className="back-button">
          Back to Home
        </button>
        <h1 className="text-4xl font-bold text-blue-600 mb-4">Coming Soon!</h1>
        <p className="text-xl text-gray-700">
          We are working hard to bring this feature to you.
        </p>
      </div>
    </div>
  );
};

export default Pvp;
