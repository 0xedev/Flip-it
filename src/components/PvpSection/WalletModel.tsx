// components/WalletModal.tsx
import React from "react";
import { Connector } from "@wagmi/core";

interface WalletModalProps {
  isModalOpen: boolean;
  connectors: Connector[];
  selectedConnector: Connector | null;
  handleConnectorSelect: (connector: Connector) => void;
  handleConnect: () => void;
  handleCloseModal: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({
  isModalOpen,
  connectors,
  selectedConnector,
  handleConnectorSelect,
  handleConnect,
  handleCloseModal,
}) => {
  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[500px] mx-4 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-center text-xl font-bold">Connect Wallet</h3>
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
  );
};

export default WalletModal;
