import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gamepad } from "lucide-react";
import Create from "./components/CreateGameVsComp";

const Pvc = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black  relative overflow-hidden">
      {/* Animated Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[500px] h-[500px] -top-64 -left-64 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-[500px] h-[500px] -bottom-64 -right-64 bg-blue-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Header with Back Button and Title */}
        <header className="flex items-center space-x-6 mb-4">
          <button
            onClick={() => navigate("/")}
            className="group flex items-center justify-center w-12 h-12 bg-purple-800/30 hover:bg-purple-800/50 rounded-full transition-all duration-300 border border-purple-700/30"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-6 h-6 text-purple-200 group-hover:translate-x-[-2px] transition-transform" />
          </button>

          <div className="flex items-center space-x-4">
            <Gamepad className="w-10 h-10 text-purple-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Play vs Computer
            </h1>
          </div>
        </header>

        {/* Main Content */}
        <main className="bg-purple-900/30 border border-purple-800/30 rounded-xl backdrop-blur-sm p-2">
          <Create />
        </main>
      </div>
    </div>
  );
};

export default Pvc;
