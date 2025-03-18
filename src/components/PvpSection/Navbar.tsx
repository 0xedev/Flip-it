// components/Navbar.tsx
import React from "react";
import { Connector } from "@wagmi/core";

interface NavbarProps {
  handleOpenModal: () => void;
  isConnected: boolean;
  address: string | undefined;
  handleDisconnect: () => void;
  selectedConnector: Connector | null;
}

const Navbar: React.FC<NavbarProps> = ({
  handleOpenModal,
  isConnected,
  address,
  handleDisconnect,
  selectedConnector,
}) => {
  return (
    <div className="bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 p-4 shadow-md">
      <div className="max-w-screen-xl mx-auto flex justify-between items-center">
        <h1 className="text-white font-bold text-xl">PVP Game</h1>
        {!isConnected ? (
          <button
            onClick={handleOpenModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="flex items-center space-x-3 bg-gray-100 rounded-lg px-4 py-2 shadow-sm border border-gray-200 max-w-[300px]">
            <div className="flex items-center">
              {selectedConnector?.icon && (
                <img
                  src={selectedConnector.icon}
                  alt={`${selectedConnector.name} icon`}
                  className="w-5 h-5 mr-2"
                />
              )}
              <span className="text-gray-800 font-medium truncate">
                {`${address?.substring(0, 6)}...${address?.substring(address.length - 4)}`}
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
      </div>
    </div>
  );
};

export default Navbar;
