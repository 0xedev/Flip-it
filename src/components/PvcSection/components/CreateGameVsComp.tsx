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
  const { disconnect } = useDisconnect();
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

  const decimals = 18;

  // Token balance and symbol
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

  // Allowance check
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: state.tokenAddress as `0x${string}`,
    abi: [
      {
        name: "allowance",
        type: "function",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
    ],
    functionName: "allowance",
    args: [address as `0x${string}`, ADDRESS],
    query: { enabled: !!address },
  });

  // Approval
  const {
    writeContract: writeApproval,
    data: approvalHash,
    error: approvalError,
  } = useWriteContract();

  const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  // Flip
  const {
    writeContract: writeFlip,
    data: flipHash,
    error: flipError,
  } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: flipHash,
  });

  // Event listeners
  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "BetSent",
    onLogs(logs) {
      logs.forEach((log) => {
        const {
          args: { requestId: eventRequestId },
        } = log as any;
        setRequestId(eventRequestId.toString());
      });
    },
  });

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "BetFulfilled",
    onLogs(logs) {
      logs.forEach((log) => {
        const {
          args: { requestId: eventRequestId },
        } = log as any;
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
    query: { enabled: !!requestId && !!betStatus?.[1] },
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

  useEffect(() => {
    setState((prev) => ({ ...prev, isBalanceLoading: true }));
    refetchBalance();
    refetchSymbol();
    refetchAllowance();
  }, [state.tokenAddress, refetchBalance, refetchSymbol, refetchAllowance]);

  useEffect(() => {
    if (!isBalanceFetching && !isSymbolFetching) {
      fetchTokenBalance();
    }
  }, [isBalanceFetching, isSymbolFetching, fetchTokenBalance]);

  // Handle approval cancellation or errors
  useEffect(() => {
    if (approvalError) {
      console.error("Approval error:", approvalError);
      setState((prev) => ({
        ...prev,
        error: approvalError.message.includes("rejected")
          ? "Approval cancelled by user"
          : "Approval failed",
        loading: false,
        isApproving: false,
      }));
      setIsFlipping(false);
    }
  }, [approvalError]);

  // Handle flip transaction errors (optional, for completeness)
  useEffect(() => {
    if (flipError) {
      console.error("Flip error:", flipError);
      setState((prev) => ({
        ...prev,
        error: flipError.message.includes("rejected")
          ? "Transaction cancelled by user"
          : "Flip transaction failed",
        loading: false,
        isApproving: false,
      }));
      setIsFlipping(false);
    }
  }, [flipError]);

  useEffect(() => {
    if (approvalConfirmed && state.isApproving) {
      const amountInWei = parseUnits(state.tokenAmount, decimals);
      writeFlip({
        address: ADDRESS,
        abi: ABI,
        functionName: "flip",
        args: [state.face, state.tokenAddress as `0x${string}`, amountInWei],
      });
      setState((prev) => ({ ...prev, isApproving: false }));
    }
  }, [
    approvalConfirmed,
    state.isApproving,
    state.tokenAmount,
    state.face,
    state.tokenAddress,
    writeFlip,
  ]);

  useEffect(() => {
    if (isConfirmed && flipHash) {
      setState((prev) => ({
        ...prev,
        loading: true,
        isBalanceLoading: true,
        success: "Transaction confirmed, waiting for result...",
      }));
      setIsFlipping(true);
    }
  }, [isConfirmed, flipHash]);

  useEffect(() => {
    if (betStatus && requestId && betStatus[1] && gameOutcome) {
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
      }));
      refetchBalance();
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

  const handleFlipCoin = async () => {
    const validationError = validateInput();
    if (validationError) {
      setState((prev) => ({ ...prev, error: validationError }));
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      success: null,
    }));
    setIsFlipping(true);

    try {
      const amountInWei = parseUnits(state.tokenAmount, decimals);
      const currentAllowance = allowanceData
        ? BigInt(allowanceData as bigint)
        : BigInt(0);

      // Check if approval is needed
      if (currentAllowance < amountInWei) {
        setState((prev) => ({ ...prev, isApproving: true }));
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
          args: [ADDRESS, BigInt("2") ** BigInt("256") - BigInt("1")], // MaxUint256
        });
      } else {
        // If already approved, proceed directly to flip
        writeFlip({
          address: ADDRESS,
          abi: ABI,
          functionName: "flip",
          args: [state.face, state.tokenAddress as `0x${string}`, amountInWei],
        });
      }
    } catch (error) {
      console.error("Error in flip:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Transaction failed",
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

  const handleShare = async (platform: "X" | "warpcast" | "copy") => {
    const message = generateShareMessage(platform);
    switch (platform) {
      case "X":
        window.open(
          `https://X.com/intent/tweet?text=${encodeURIComponent(message)}`,
          "_blank"
        );
        break;
      case "warpcast":
        window.open(
          `https://warpcast.com/~/compose?text=${encodeURIComponent(message)}`,
          "_blank"
        );
        break;
      case "copy":
        await navigator.clipboard.writeText(message);
        setShareStatus("Copied to clipboard!");
        setTimeout(() => setShareStatus(""), 2000);
        break;
    }
  };

  const generateShareMessage = (platform: "X" | "warpcast" | "copy") => {
    const result = flipResult.won ? "won" : "lost";
    const url =
      platform === "warpcast"
        ? "flip-it-clanker.vercel.app/"
        : window.location.href;
    return `I just ${result} ${state.tokenAmount} ${state.tokenSymbol} playing the flip-it game! Try your luck at ${url}`;
  };

  const [shareStatus, setShareStatus] = useState("");

  // UI rendering (modified slightly for better feedback)
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950">
      <div className="p-4">
        {!isConnected ? (
          <button
            onClick={() => setIsModalOpen(true)}
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
              <span className="text-gray-800 font-medium truncate">{`${address?.substring(
                0,
                6
              )}...${address?.substring(address.length - 4)}`}</span>
            </div>
            <button
              onClick={() => disconnect()}
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
                      onClick={() => setSelectedConnector(connector)}
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
                    onClick={() =>
                      selectedConnector &&
                      connect({ connector: selectedConnector })
                    }
                    disabled={!selectedConnector}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Connect Wallet
                  </button>
                </div>
                <div className="mt-3 text-center">
                  <button
                    onClick={() => setIsModalOpen(false)}
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
            <button
              onClick={() => setState((prev) => ({ ...prev, error: null }))}
              className="ml-2 text-white font-bold"
            >
              ×
            </button>
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
                {state.isApproving
                  ? "Approving tokens (one-time setup)..."
                  : "Flipping..."}
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
                    className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                    aria-label="Share on X"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 512 512"
                      fill="#none"
                    >
                      <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm297.1 84L257.3 234.6 379.4 396H283.8L209 298.1 123.3 396H75.8l111-126.9L69.7 116h98l67.7 89.5L313.6 116h47.5zM323.3 367.6L153.4 142.9H125.1L296.9 367.6h26.3z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleShare("warpcast")}
                    className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                    aria-label="Share on Warpcast"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 1000 1000"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect width="1000" height="1000" fill="#855DCD" />
                      <path
                        d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z"
                        fill="white"
                      />
                      <path
                        d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.444H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"
                        fill="white"
                      />
                      <path
                        d="M675.555 746.667C663.282 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.444H875.555V817.778C875.555 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.555Z"
                        fill="white"
                      />
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
                onChange={(e) =>
                  setState((prev) => ({ ...prev, tokenAmount: e.target.value }))
                }
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
                      {state.isApproving
                        ? "Approving (one-time)..."
                        : "Flipping..."}
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
