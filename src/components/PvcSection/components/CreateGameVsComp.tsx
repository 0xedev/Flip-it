import { useState, useEffect, useCallback, useRef } from "react";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "../utils/contract";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
  useConnect,
  useWatchContractEvent,
  useDisconnect,
} from "wagmi";
import Leader from "./LeaderBoard";
import { Connector } from "@wagmi/core";

import { parseUnits, formatUnits } from "viem";

interface FlipCoinState {
  tokenAddress: string;
  tokenAmount: string;
  face: boolean;
  error: string | null;
  loading: boolean;
  success: string | null;
  tokenBalance: string;
  tokenSymbol: string;
  isApproving: boolean;
  isBalanceLoading: boolean;
}

const FlipCoin = () => {
  const [state, setState] = useState<FlipCoinState>({
    face: false,
    tokenAmount: "",
    tokenAddress: SUPPORTED_TOKENS.STABLEAI,
    loading: false,
    error: null,
    success: null,
    tokenBalance: "0",
    tokenSymbol: "STABLEAI",
    isApproving: false,
    isBalanceLoading: false,
  });

  const [requestId, setRequestId] = useState<string | null>(null);

  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect(); // Get the disconnect function
  const { isConnected, address } = useAccount();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(
    null
  );
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [isFlipping, setIsFlipping] = useState(false);
  const [flipResult, setFlipResult] = useState<{
    won: boolean | null;
    result: string | null;
  }>({ won: null, result: null });

  // const { connect, connectors } = useConnect()
  const decimals = 18;

  // Token contract interactions Done
  const {
    data: balanceData,
    refetch: refetchBalance,
    isFetching: isBalanceFetching,
  } = useReadContract({
    address: state.tokenAddress as `0x${string}`,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
      {
        name: "symbol",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
      },
    ],
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  });

  // Token symbolData Done
  const {
    data: symbolData,
    refetch: refetchSymbol,
    isFetching: isSymbolFetching,
  } = useReadContract({
    address: state.tokenAddress as `0x${string}`,
    abi: [
      {
        name: "symbol",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
      },
    ],
    functionName: "symbol",
  });

  // Approval
  const { writeContract: writeApproval, data: approvalHash } =
    useWriteContract();
  const { isSuccess: approvalConfirmed, isLoading: approvalLoading } =
    useWaitForTransactionReceipt({
      hash: approvalHash,
    });
  console.log("approve", approvalLoading);

  // Flip
  const {
    writeContract: writeFlip,
    data: flipHash,
    isPending: isFlipPending,
  } = useWriteContract();

  console.log("flip", isFlipPending);

  const { isSuccess: isConfirmed, isLoading: flipConfirmLoading } =
    useWaitForTransactionReceipt({
      hash: flipHash,
    });

  console.log("approve", flipConfirmLoading);

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "BetFulfilled",
    onLogs(logs) {
      logs.forEach((log) => {
        const {
          args: { requestId: eventRequestId },
        } = log as typeof log & {
          args: {
            payment: bigint;
            randomWords: bigint[];
            requestId: bigint;
            resolved: boolean;
            rolled: bigint;
            status: string;
            userWon: boolean;
          };
        };
        setRequestId(eventRequestId.toString());
      });
    },
    onError(error) {
      console.error("Error in useWatchContractEvent:", error);
    },
  });

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "BetSent",
    onLogs(logs) {
      logs.forEach((log) => {
        const {
          args: { requestId: eventRequestId, numWords },
        } = log as typeof log & {
          args: {
            requestId: bigint;
            numWords: number;
          };
        };
        console.log("Number of Words:", numWords);
        setRequestId(eventRequestId.toString());
      });
    },
  });

  const { data: betStatus } = useReadContract({
    address: ADDRESS,
    abi: ABI,
    functionName: "getBetStatus",
    args: [requestId ? BigInt(requestId) : BigInt(0)],
    query: { enabled: !!requestId },
  }) as {
    data:
      | [bigint, boolean, boolean, bigint[], string, bigint, boolean]
      | undefined;
  };

  const { data: gameOutcome } = useReadContract({
    address: ADDRESS,
    abi: ABI,
    functionName: "getGameOutcome",
    args: [requestId ? BigInt(requestId) : BigInt(0)],
    query: {
      enabled: !!requestId && !!betStatus?.[1],
    },
  }) as {
    data:
      | [boolean, boolean, boolean, boolean, bigint, bigint, string]
      | undefined;
  };

  const fetchTokenBalance = useCallback(() => {
    if (balanceData && symbolData) {
      setState((prev) => ({
        ...prev,
        tokenBalance: formatUnits(balanceData as bigint, decimals),
        tokenSymbol: symbolData as string,
        isBalanceLoading: false,
      }));
    }
  }, [balanceData, symbolData]);

  // Update balance and symbol when tokenAddress changes
  useEffect(() => {
    setState((prev) => ({ ...prev, isBalanceLoading: true }));
    refetchBalance();
    refetchSymbol();
  }, [state.tokenAddress, refetchBalance, refetchSymbol]);

  // Sync state with fetched data
  useEffect(() => {
    if (!isBalanceFetching && !isSymbolFetching) {
      fetchTokenBalance();
    }
  }, [isBalanceFetching, isSymbolFetching, fetchTokenBalance]);

  // Monitor approval status
  useEffect(() => {
    if (approvalConfirmed && state.isApproving) {
      // Execute the flip transaction once approval is confirmed
      try {
        const amountInWei = parseUnits(state.tokenAmount, decimals);
        writeFlip({
          address: ADDRESS,
          abi: ABI,
          functionName: "flip",
          args: [state.face, state.tokenAddress as `0x${string}`, amountInWei],
        });

        // Update state to show we're no longer approving, but still flipping
        setState((prev) => ({ ...prev, isApproving: false }));
      } catch (error) {
        console.error("Error executing flip after approval:", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to flip",
          loading: false,
          isApproving: false,
        }));
        setIsFlipping(false);
      }
    }
  }, [
    approvalConfirmed,
    state.isApproving,
    state.tokenAmount,
    state.face,
    state.tokenAddress,
    writeFlip,
  ]);

  // Effect for handling the completion of the flip transaction
  useEffect(() => {
    if (isConfirmed && flipHash) {
      setState((prev) => ({
        ...prev,
        loading: true,
        isBalanceLoading: true,
        success: "Transaction confirmed, waiting for result...",
      }));

      // Keep the flipping UI visible while waiting for the result
      setIsFlipping(true);
    }
  }, [isConfirmed, flipHash]);

  // Monitor bet outcome
  useEffect(() => {
    if (betStatus && requestId) {
      if (betStatus[1] && gameOutcome) {
        // Game is resolved
        setFlipResult({
          won: gameOutcome[1],
          result: `You ${gameOutcome[1] ? "Won" : "Lost"}. Choice: ${
            gameOutcome[2] ? "Tails" : "Heads"
          }, Outcome: ${gameOutcome[3] ? "Tails" : "Heads"}`,
        });

        setState((prev) => ({
          ...prev,
          success: "Game completed",
          loading: false,
          isApproving: false,
        }));

        // The UI will still show the flipping overlay until the user closes it
        refetchBalance();
      }
    }
  }, [betStatus, gameOutcome, requestId, refetchBalance]);

  const validateInput = (): string | null => {
    if (!isConnected || !address) return "Please connect your wallet";
    if (!state.tokenAmount || parseFloat(state.tokenAmount) <= 0)
      return "Bet amount must be positive";
    if (parseFloat(state.tokenBalance) < parseFloat(state.tokenAmount))
      return `Insufficient ${state.tokenSymbol} balance`;
    return null;
  };

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

  const handleFlipCoin = async () => {
    const validationError = validateInput();
    if (validationError) {
      setState((prev) => ({ ...prev, error: validationError }));
      return;
    }

    // Reset any previous state
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      success: null,
      isApproving: true,
    }));

    setIsFlipping(true);

    try {
      const amountInWei = parseUnits(state.tokenAmount, decimals);

      // Request token approval
      writeApproval({
        address: state.tokenAddress as `0x${string}`,
        abi: [
          {
            name: "approve",
            type: "function",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "approve",
        args: [ADDRESS, amountInWei],
      });

      // The flip transaction will be executed in the useEffect that watches approvalConfirmed
    } catch (error) {
      console.error("Approval Error:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to approve token",
        loading: false,
        isApproving: false,
      }));
      setIsFlipping(false);
    }
  };

  const handleChoiceClick = () => {
    setState((prev) => ({ ...prev, face: !prev.face }));
  };

  const resetFlipState = () => {
    // Reset all game-related state to allow a new bet
    setFlipResult({ won: null, result: null });
    setState((prev) => ({
      ...prev,
      success: null,
      error: null,
      loading: false,
      isApproving: false,
    }));
    setIsFlipping(false);
    setRequestId(null);
  };

  // Add these functions within your component before the return statement

  const handleShare = async (platform: "X" | "telegram" | "copy") => {
    const message = generateShareMessage();

    switch (platform) {
      case "X":
        window.open(
          `https://X.com/intent/tweet?text=${encodeURIComponent(message)}`,
          "_blank"
        );
        break;
      case "telegram":
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(
            window.location.href
          )}&text=${encodeURIComponent(message)}`,
          "_blank"
        );
        break;
      case "copy":
        try {
          await navigator.clipboard.writeText(message);
          setShareStatus("Copied to clipboard!");
          setTimeout(() => setShareStatus(""), 2000);
        } catch (err) {
          setShareStatus("Failed to copy");
          console.error("Failed to copy:", err);
        }
        break;
      default:
        break;
    }
  };

  const generateShareMessage = () => {
    const result = flipResult.won ? "won" : "lost";
    const amount = state.tokenAmount;
    const token = state.tokenSymbol;

    return `I just ${result} ${amount} ${token} playing the cosmic coin flip game! Try your luck at ${window.location.href}`;
  };

  // Add this state for showing copy confirmation
  const [shareStatus, setShareStatus] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950">
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

      <div className="bg-[radial-gradient(circle_at_center,_rgba(88,28,135,0.15),_transparent_70%)] min-h-screen p-6 space-y-4">
        {state.error && (
          <div className="fixed top-4 right-4 bg-red-500/90 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-fade-in">
            {state.error}
          </div>
        )}

        {state.success && (
          <div className="fixed top-4 right-4 bg-green-500/90 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-fade-in">
            {state.success}
          </div>
        )}

        {isFlipping && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-10 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
              <p className="mt-4 text-center">
                {state.isApproving ? "Approving..." : "Flipping..."}
              </p>
            </div>
          </div>
        )}

        {flipResult.won !== null && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-2 text-center">
                {flipResult.won
                  ? "🎉 Congratulations!"
                  : "😢 Better luck next time!"}
              </h2>
              <p className="text-center mb-4">{flipResult.result}</p>

              <div className="border-t border-b border-gray-200 py-4 my-4">
                <p className="text-center text-gray-700 mb-3 font-medium">
                  Share your result
                </p>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => handleShare("X")}
                    className="bg-[#1DA1F2] text-white p-2 rounded-full hover:bg-[#1a91da] transition-colors"
                    aria-label="Share on X"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21-.36.1-.74.15-1.13.15-.27 0-.54-.03-.8-.08.54 1.69 2.11 2.95 4 2.98-1.46 1.16-3.31 1.84-5.33 1.84-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleShare("telegram")}
                    className="bg-[#0088cc] text-white p-2 rounded-full hover:bg-[#0077b3] transition-colors"
                    aria-label="Share on Telegram"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleShare("copy")}
                    className="bg-gray-800 text-white p-2 rounded-full hover:bg-gray-700 transition-colors"
                    aria-label="Copy to clipboard"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                {shareStatus && (
                  <p className="text-center mt-2 text-green-600 text-sm animate-fade-in">
                    {shareStatus}
                  </p>
                )}
              </div>

              <button
                onClick={resetFlipState}
                className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-md transition-colors duration-200 font-medium"
              >
                Place New Bet
              </button>
            </div>
          </div>
        )}

        <div className="w-full bg-purple-950/70 backdrop-blur-sm border border-purple-800/30 rounded-lg overflow-hidden shadow-xl">
          <div className="p-6 bg-purple-950/40 text-purple-100 backdrop-blur-sm">
            <div className="space-y-4">
              <div className="flex justify-center items-center w-full h-full">
                <div
                  className={`w-24 h-24 rounded-full relative ${
                    isFlipping ? "animate-spin" : ""
                  }`}
                  style={{
                    perspective: "1000px",
                    transformStyle: "preserve-3d",
                  }}
                  onClick={handleChoiceClick}
                >
                  <div
                    className="absolute w-full h-full backface-hidden bg-gradient-to-br from-[#ffd700] to-[#b8860b] rounded-full flex items-center justify-center border-2 border-[#daa520] shadow-lg"
                    style={{
                      transform: state.face
                        ? "rotateY(0deg)"
                        : "rotateY(180deg)",
                      transition: "transform 0.6s",
                      backfaceVisibility: "hidden",
                      boxShadow: "0 0 15px rgba(218, 165, 32, 0.8)",
                    }}
                  >
                    <span
                      className="text-lg font-bold"
                      style={{ color: "#422006" }}
                    >
                      TAILS
                    </span>
                  </div>
                  <div
                    className="absolute w-full h-full backface-hidden bg-gradient-to-br from-[#daa520] to-[#ffd700] rounded-full flex items-center justify-center border-2 border-[#daa520] shadow-lg"
                    style={{
                      transform: state.face
                        ? "rotateY(180deg)"
                        : "rotateY(0deg)",
                      transition: "transform 0.6s",
                      backfaceVisibility: "hidden",
                      boxShadow: "0 0 15px rgba(218, 165, 32, 0.8)",
                    }}
                  >
                    <span
                      className="text-lg font-bold"
                      style={{ color: "#422006" }}
                    >
                      HEADS
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start space-y-1">
                <p className="text-purple-200 flex items-center">
                  {state.tokenSymbol} balance:
                  {state.isBalanceLoading ||
                  isBalanceFetching ||
                  isSymbolFetching ? (
                    <span className="ml-2 animate-pulse">Loading...</span>
                  ) : (
                    <span className="ml-2 animate-fade-in">
                      {parseFloat(state.tokenBalance).toFixed(2)}
                    </span>
                  )}
                </p>
                <div className="text-purple-200">
                  <p>Choice: {state.face ? "Tails" : "Heads"}</p>
                </div>
              </div>

              <div className="flex flex-col w-full">
                <label
                  htmlFor="token"
                  className="block text-md font-medium text-purple-200 mb-1"
                >
                  Select Token
                </label>
                <select
                  id="token"
                  value={state.tokenAddress}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      tokenAddress: e.target.value,
                      tokenSymbol:
                        Object.keys(SUPPORTED_TOKENS).find(
                          (key) =>
                            SUPPORTED_TOKENS[
                              key as keyof typeof SUPPORTED_TOKENS
                            ] === e.target.value
                        ) || "UNKNOWN",
                    }));
                  }}
                  className="w-full text-gray-700 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  disabled={state.loading || state.isApproving}
                >
                  {Object.entries(SUPPORTED_TOKENS).map(([key, value]) => (
                    <option key={key} value={value}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>

              <label className="block text-purple-200">
                Bet amount ({state.tokenSymbol})
              </label>
              <input
                id="betAmount"
                type="number"
                step="0.001"
                min="0"
                placeholder="0.00"
                value={state.tokenAmount}
                onChange={(e) => {
                  setState((prev) => ({
                    ...prev,
                    tokenAmount: e.target.value,
                  }));
                }}
                className="w-full bg-purple-900/50 border border-purple-700/30 text-purple-100 rounded-md p-2 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-600/50"
                disabled={state.loading || state.isApproving}
              />

              <button
                className={`w-full py-3 flex items-center justify-center ${
                  state.loading || state.isApproving
                    ? "bg-purple-600/50 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-600 hover:to-purple-700"
                } text-white rounded-md transition duration-200 font-semibold shadow-lg`}
                onClick={handleFlipCoin}
                disabled={state.loading || state.isApproving}
              >
                {state.loading || state.isApproving ? (
                  <div className="flex items-center space-x-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>
                      {state.isApproving ? "Approving..." : "Flipping..."}
                    </span>
                  </div>
                ) : (
                  "Flip"
                )}
              </button>
            </div>
          </div>
          <Leader />
        </div>
      </div>
    </div>
  );
};

export default FlipCoin;
