import { Link } from "react-router-dom";
import { Home, PlusCircle, Gamepad, User, Trophy } from "lucide-react";
import GameList from "./PvpSection/Available";
import CreateGame from "./PvpSection/CreateGame";
import Leaderb from "./PvpSection/Leaderb";
import { MyGame } from "./PvpSection/MyGame";
import Modal from "./PvpSection/Modal";
import { Connector } from "@wagmi/core";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useState, useCallback } from "react";
import { toast, Toaster } from "react-hot-toast";

const Pvp = () => {
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<JSX.Element | null>(null);

  const { connect, connectors } = useConnect({
    mutation: {
      onSuccess: () => {
        toast.success("Wallet Connected Successfully!");
        handleCloseModal();
      },
      onError: (error) => {
        toast.error(`Connection Failed: ${error.message}`);
      },
    },
  });
  const { disconnect } = useDisconnect();
  const { isConnected, address } = useAccount();

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(
    null
  );
  // const modalRef = useRef<HTMLDivElement | null>(null);

  const handleOpenWalletModal = useCallback(() => {
    setIsWalletModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsWalletModalOpen(false);
    setSelectedConnector(null);
  }, []);

  const handleConnectorSelect = useCallback((connector: Connector) => {
    setSelectedConnector(connector);
  }, []);

  const handleConnect = useCallback(async () => {
    if (!selectedConnector) return;
    try {
      await connect({ connector: selectedConnector });
    } catch (err) {
      console.error("Connection failed", err);
    }
  }, [connect, selectedConnector]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    toast.success("Wallet Disconnected");
  }, [disconnect]);

  const openModal = useCallback((content: JSX.Element) => {
    setModalContent(content);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setModalContent(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-purple-50 relative overflow-hidden">
      {/* Animated Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[500px] h-[500px] -top-64 -left-64 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-[500px] h-[500px] -bottom-64 -right-64 bg-blue-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Toaster for Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          success: {
            style: {
              background: "linear-gradient(to right, #10b981, #059669)",
              color: "white",
            },
          },
          error: {
            style: {
              background: "linear-gradient(to right, #ef4444, #dc2626)",
              color: "white",
            },
          },
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Navigation Header */}
        <header className="px-6 py-4 border-b border-purple-800/30 backdrop-blur-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Gamepad className="w-10 h-10 text-purple-400" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                FlipIt PVP
              </h1>
            </div>

            <nav className="flex items-center space-x-4">
              <Link
                to="/"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-purple-200 hover:bg-purple-800/50 transition-all duration-300"
              >
                <Home className="w-5 h-5" />
                <span>Home</span>
              </Link>

              {isConnected ? (
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-800/50 px-4 py-2 rounded-lg flex items-center space-x-2">
                    <span className="text-purple-200">
                      {`${address?.slice(0, 6)}...${address?.slice(-4)}`}
                    </span>
                    <button
                      onClick={handleDisconnect}
                      className="text-red-400 hover:text-red-300 ml-2"
                      title="Disconnect Wallet"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleOpenWalletModal}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-white transition-all duration-300"
                >
                  Connect Wallet
                </button>
              )}
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-2 py-6">
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-6 mb-10">
            <button
              onClick={() => openModal(<CreateGame />)}
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-gradient-to-br from-purple-700/50 to-blue-700/50 hover:from-purple-700/70 hover:to-blue-700/70 border border-purple-600/30 shadow-xl transition-all duration-300 space-y-3"
            >
              <PlusCircle className="w-8 h-8 text-white" />
              <span className="text-white font-semibold">Create Game</span>
            </button>

            <button
              onClick={() => openModal(<MyGame />)}
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-gradient-to-br from-blue-700/50 to-purple-700/50 hover:from-blue-700/70 hover:to-purple-700/70 border border-blue-600/30 shadow-xl transition-all duration-300 space-y-3"
            >
              <User className="w-8 h-8 text-white" />
              <span className="text-white font-semibold">My Games</span>
            </button>

            <button
              onClick={() => openModal(<Leaderb />)}
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-gradient-to-br from-green-700/50 to-teal-700/50 hover:from-green-700/70 hover:to-teal-700/70 border border-green-600/30 shadow-xl transition-all duration-300 space-y-3"
            >
              <Trophy className="w-8 h-8 text-white" />
              <span className="text-white font-semibold">Leaderboard</span>
            </button>
          </div>

          {/* Game List Section */}
          <div className="bg-purple-900/30 border border-purple-800/30 rounded-xl backdrop-blur-sm p-2">
            <h2 className="text-2xl font-bold text-purple-200 mb-6">
              Available Games
            </h2>
            <GameList />
          </div>
        </main>
      </div>

      {/* Wallet Connection Modal */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white/10 border border-purple-700/30 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-3 border-b border-purple-700/30">
              <h3 className="text-center text-2xl font-bold text-purple-100">
                Connect Wallet
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => {
                      handleConnectorSelect(connector);
                      handleConnect();
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-300 ${
                      selectedConnector?.id === connector.id
                        ? "border-blue-500 bg-blue-500/20"
                        : "border-purple-700/30 hover:bg-purple-800/20"
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {connector.icon && (
                        <img
                          src={connector.icon}
                          alt={`${connector.name} icon`}
                          className="w-8 h-8"
                        />
                      )}
                      <span className="text-purple-100 font-medium">
                        {connector.name}
                      </span>
                    </div>
                    {selectedConnector?.id === connector.id && (
                      <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleCloseModal}
                  className="w-full bg-purple-700/30 hover:bg-purple-700/50 text-purple-100 font-bold py-3 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Game Actions */}
      <Modal
        showModal={showModal}
        closeModal={closeModal}
        content={modalContent}
      />
    </div>
  );
};

export default Pvp;
