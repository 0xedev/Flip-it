
import { Link } from "react-router-dom";
import { Home, PlusCircle,  Gamepad, User } from "lucide-react";
import GameList from "./PvpSection/Available";
import CreateGame from "./PvpSection/CreateGame";
import Leaderb from "./PvpSection/Leaderb";
import MyGame from "./PvpSection/MyGame";
import Modal from "./PvpSection/Modal";
import { Connector } from "@wagmi/core";
import {
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";
import { useState,  useRef } from "react";

const Pvp = () => {
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<JSX.Element | null>(null);

  const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect(); // Get the disconnect function
    const { isConnected, address } = useAccount();
  
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedConnector, setSelectedConnector] = useState<Connector | null>(
      null
    );
    const modalRef = useRef<HTMLDivElement | null>(null);

     // Add the wallet connection button
      // Close modal when clicking outside
      const handleOpenModal = () => {
        setIsModalOpen(true);
      };
    
      const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedConnector(null);
      };
    
      const handleConnectorSelect = (connector: Connector) => {
        setSelectedConnector(connector);
      };
    
      const handleConnect = async () => {
        if (!selectedConnector) return;
    
        try {
          await connect({ connector: selectedConnector }); // Wagmi expects its own Connector type here
          handleCloseModal();
        } catch (err) {
          console.error("Connection failed", err);
        }
      };
    
      const handleDisconnect = () => {
        disconnect();
      };

  const openModal = (content: JSX.Element) => {
    setModalContent(content);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalContent(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-black text-purple-50">
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 -top-48 -left-48 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-96 h-96 -bottom-48 -right-48 bg-blue-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-purple-800/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Gamepad className="w-8 h-8 text-purple-400" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  FlipIt PVP
                </h1>
              </div>
              <div className="p-4">
        {!isConnected ? (
          <button
            onClick={handleOpenModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="flex items-center space-x-3 bg-gray-100 rounded-lg px-4 py-2 shadow-sm border border-gray-200 max-w-[230px]">
            <div className="flex items-center">
              {selectedConnector?.icon && (
                <img
                  src={selectedConnector.icon}
                  alt={`${selectedConnector.name} icon`}
                  className="w-5 h-5 mr-2"
                />
              )}
              <span className="text-gray-800 font-medium truncate">
                {`${address?.substring(0, 6)}...${address?.substring(
                  address.length - 4
                )}`}
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded-md transition-colors duration-200"
            >
              Disconnect
            </button>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
              ref={modalRef}
              className="bg-white rounded-xl shadow-xl w-full max-w-[450px] mx-4 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-center text-xl font-bold">
                  Connect Wallet
                </h3>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto">
                <div className="grid gap-4 py-2">
                  {connectors.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => handleConnectorSelect(connector)}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        selectedConnector?.id === connector.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center">
                        {connector.icon && (
                          <img
                            src={connector.icon}
                            alt={`${connector.name} icon`}
                            className="w-8 h-8 mr-3"
                          />
                        )}
                        <span className="font-medium">{connector.name}</span>
                      </div>
                      {selectedConnector?.id === connector.id && (
                        <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleConnect}
                    disabled={!selectedConnector}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Connect Wallet
                  </button>
                </div>

                <div className="mt-3 text-center">
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
              <Link to="/">
                <button className="flex items-center space-x-2 px-4 py-2 rounded-lg text-purple-200 hover:bg-purple-800/50 transition-all duration-300">
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </button>
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <button
              onClick={() => openModal(<CreateGame />)}
              className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Game</span>
            </button>
            <button
              onClick={() => openModal(<MyGame />)}
              className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
            >
              <User className="w-4 h-4" />
              <span>My Games</span>
            </button>
          </div>

          {/* Game List */}
          <div className="bg-purple-900/50 border border-purple-800/50 rounded-xl shadow-xl backdrop-blur-sm mb-8 p-6">
            <GameList />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap justify-center gap-4">
          
            <div className="flex items-center space-x-2 px-6 py-3 rounded-lg max-w-full">
              <Leaderb />
            </div>
             
          </div>
        </main>
      </div>

      {/* Modal */}
      <Modal
        showModal={showModal}
        closeModal={closeModal}
        content={modalContent}
      />
    </div>
  );
};

export default Pvp;
