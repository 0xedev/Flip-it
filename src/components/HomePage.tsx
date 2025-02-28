import { Link } from "react-router-dom";
import { Swords, Bot, Coins } from "lucide-react";

const HomePage = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-purple-950 via-purple-900 to-black">
      {/* Animated background elements - adjusted for better mobile display */}
      <div className="absolute inset-0">
        <div className="absolute w-48 sm:w-96 h-48 sm:h-96 -top-24 sm:-top-48 -left-24 sm:-left-48 bg-purple-600/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-48 sm:w-96 h-48 sm:h-96 -bottom-24 sm:-bottom-48 -right-24 sm:-right-48 bg-blue-600/30 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Floating particles - reduced count for mobile */}
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 sm:w-2 h-1 sm:h-2 bg-white rounded-full animate-[float_5s_ease-in-out_infinite]"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            opacity: 0.2,
          }}
        />
      ))}

      {/* Header - adjusted padding for mobile */}
      <header className="absolute top-0 left-0 right-0 p-4 sm:p-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Coins className="w-6 h-6 sm:w-8 sm:h-8 text-purple-300" />
            <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
              FlipIt
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content - improved spacing for mobile */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-16 sm:py-0">
        <div className="text-center mb-8 sm:mb-16 animate-[fadeIn_1s_ease-out]">
          <h2 className="text-3xl sm:text-5xl font-bold mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-blue-300 to-purple-300">
            Welcome to the Future of Flipping
          </h2>
          <p className="text-lg sm:text-xl text-purple-200 mb-6 sm:mb-8 px-2">
            Experience the thrill of the flip in a whole new dimension
          </p>
        </div>

        {/* Spinning Coin - responsive size */}
        <div className="mb-8 sm:mb-16">
          <div className="w-28 h-28 sm:w-40 sm:h-40 animate-[spin_2s_linear_infinite] rounded-full bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 shadow-[0_0_50px_rgba(168,85,247,0.4)] flex items-center justify-center">
            <div className="text-yellow-700 font-bold text-4xl sm:text-6xl">
              ₿
            </div>
          </div>
        </div>

        {/* Game Mode Buttons - stack on mobile, side by side on desktop */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full max-w-xl px-4 sm:px-0">
          <Link to="/pvc" className="w-full sm:w-1/2">
            <button className="group relative px-6 sm:px-8 py-4 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-base sm:text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-95">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>VS Computer</span>
              </div>
            </button>
          </Link>

          <Link to="/pvp" className="w-full sm:w-1/2">
            <button className="group relative px-6 sm:px-8 py-4 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-base sm:text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-95">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <Swords className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>PVP Battle</span>
              </div>
            </button>
          </Link>

          <Link
            to="/faq"
            className="mt-8 text-purple-300 hover:text-purple-100 underline"
          >
            View FAQ
          </Link>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
