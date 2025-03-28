import React, { useState, useEffect, useRef } from "react";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";
import { useWriteContract, useAccount, useReadContract, usePublicClient } from "wagmi";
import { parseUnits, Address, formatUnits } from "viem";
import { decodeEventLog } from 'viem';

const TOKEN_ICONS: { [key: string]: string } = {
  STABLEAI: "https://flip-it-clanker.vercel.app/icon.svg",
};

export function useCreateGame() {
  const [gameId, setGameId] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const publicClient = usePublicClient();

  if (!publicClient) {
    throw new Error("useCreateGame must be used within a WagmiProvider");
  }

  const { writeContractAsync } = useWriteContract();

    // Helper to decode event logs
    const decodeGameCreationEvent = ({ data, topics }: { data: `0x${string}`, topics: [`0x${string}`, ...`0x${string}`[]] }) => {
      const eventAbi = ABI.find((item: any) => item.type === 'event' && item.name === 'AllBets');
      if (!eventAbi) throw new Error('AllBets event ABI not found');
      
      return decodeEventLog({
        abi: [eventAbi],
        data,
        topics
      });
    };

    const extractGameIdFromReceipt = (receipt: any) => {
      try {
        const eventLog = receipt.logs.find((log: any) => 
          log.address.toLowerCase() === ADDRESS.toLowerCase());
        
        if (!eventLog) return null;
  
        const decoded = decodeGameCreationEvent({
          data: eventLog.data as `0x${string}`,
          topics: eventLog.topics as [`0x${string}`, ...`0x${string}`[]]
        });
             // Type guard to check if args exists and has betId property
      if (!decoded.args || typeof decoded.args !== 'object' || !('betId' in decoded.args)) {
        throw new Error('Invalid event data structure');
      }

      return Number((decoded.args as { betId: bigint }).betId);
    } catch (error) {
      console.error("Error decoding event log:", error);
      return null;
    }
  };
  

  const approveToken = async (
    tokenAddress: Address,
    amount: bigint,
    balance: bigint
  ) => {
    if (amount > balance) {
      const fall = formatUnits(amount - balance, 18);
      const shortfall = parseFloat(fall).toFixed(2);
      const tokenSymbol =
        SUPPORTED_TOKENS.find((t) => t.address === tokenAddress)?.symbol ||
        "tokens";
      return {
        success: false,
        error: new Error(
          `Insufficient funds: You need ${shortfall} more ${tokenSymbol}`
        ),
      };
    }

    try {
      const data = await writeContractAsync({
        address: tokenAddress,
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [ADDRESS, amount],
      });
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error("Error approving token"),
      };
    }
  };

  

  const createGame = async ({
    face,
    tokenSymbol,
    amount,
    betTimeout,
    tokenBalance,
  }: {
    face: boolean;
    tokenSymbol: string;
    amount: string;
    betTimeout: number;
    tokenBalance: bigint;
  }) => {
    setIsPending(true);
    setError(null);

    try {
      const token = SUPPORTED_TOKENS.find((t) => t.symbol === tokenSymbol);
      if (!token) throw new Error(`Token ${tokenSymbol} not supported`);

      const parsedAmount = parseUnits(amount, 18);
      const approvalResult = await approveToken(
        token.address as Address,
        parsedAmount,
        tokenBalance
      );
      if (!approvalResult.success) throw approvalResult.error;

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const txHash = await writeContractAsync({
        address: ADDRESS as Address,
        abi: ABI,
        functionName: "createGame",
        args: [face, token.address, parsedAmount, BigInt(betTimeout)],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        confirmations: 1
      });

      const newGameId = extractGameIdFromReceipt(receipt);
      if (!newGameId) throw new Error("Could not determine game ID");

      setGameId(newGameId);
      setIsPending(false);
      setIsSuccess(true);
      return { txHash, gameId: newGameId };
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Unknown error occurred")
      );
      setIsPending(false);
      setIsSuccess(false);
      throw err;
    }
  };

  return { createGame, gameId, isPending, isSuccess, error, setError };
}

const CreateGameForm: React.FC = () => {
  const { address } = useAccount();
  const [face, setFace] = useState<boolean>(true);
  const [tokenSymbol, setTokenSymbol] = useState<string>(
    SUPPORTED_TOKENS[0]?.symbol || ""
  );
  const [amount, setAmount] = useState<string>("0.1");
  const [betTimeout, setBetTimeout] = useState<number>(3600);
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0));
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<
    "prepare" | "approve" | "create"
  >("prepare");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showTour, setShowTour] = useState<boolean>(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState<boolean>(false);
  const [gameTxHash, setGameTxHash] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const sliderRef = useRef<HTMLInputElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  const { createGame, gameId, isPending } = useCreateGame();

  const selectedToken = SUPPORTED_TOKENS.find((t) => t.symbol === tokenSymbol);
  const tokenAddress = selectedToken?.address as Address;

  const timeoutOptions = [
    { label: "10 min", value: 600 },
    { label: "30 min", value: 1800 },
    { label: "1 hr", value: 3600 },
    { label: "6 hrs", value: 21600 },
    { label: "1 day", value: 86400 },
  ];

  const betPresets = [
    { label: "Min", value: "1", percent: 1 },
    { label: "Low", value: "10", percent: 10 },
    { label: "Med", value: "50", percent: 50 },
    { label: "High", value: "80", percent: 80 },
  ];

  const {
    data: balanceData,
    refetch,
    isLoading,
  } = useReadContract({
    address: tokenAddress,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [address as Address],
  });

  useEffect(() => {
    if (address && tokenAddress) refetch();
  }, [address, tokenAddress, refetch]);

  useEffect(() => {
    if (balanceData !== undefined) {
      setTokenBalance(BigInt(balanceData.toString()));
      setIsLoadingBalance(false);
    }
  }, [balanceData]);

  const formattedBalance = formatUnits(tokenBalance, 18);
  const maxBet = parseFloat(formattedBalance) || 0;
  const betPercentage = maxBet > 0 ? (parseFloat(amount) / maxBet) * 100 : 0;

  const getBetColor = () =>
    betPercentage < 25
      ? "green"
      : betPercentage < 50
      ? "yellow"
      : betPercentage < 75
      ? "orange"
      : "red";

  const validateAmount = (value: string): boolean => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0 || !value.trim()) {
      setToast({ message: "Amount must be greater than 0", type: "error" });
      return false;
    }
    const parsedAmount = parseUnits(value, 18);
    if (parsedAmount > tokenBalance) {
      const shortfall = parseFloat(
        formatUnits(parsedAmount - tokenBalance, 18)
      ).toFixed(2);
      setToast({
        message: `Need ${shortfall} more ${tokenSymbol}`,
        type: "error",
      });
      return false;
    }
    return true;
  };

  const handleCreateGame = async (quickBet = false) => {
    setCurrentStep("approve");
    setToast({ message: "Approving tokens...", type: "info" });

    const betAmount = quickBet ? "1000" : amount;
    if (!validateAmount(betAmount)) return;

    try {
      const { txHash } = await createGame({
        face,
        tokenSymbol,
        amount: betAmount,
        betTimeout,
        tokenBalance,
      });
      
      setGameTxHash(txHash);
      setCurrentStep("create");
      setToast({ message: "Game created successfully!", type: "success" });
      setShowSuccessPopup(true);
      
      if (coinRef.current) {
        coinRef.current.classList.add("animate-flip");
        setTimeout(
          () => coinRef.current?.classList.remove("animate-flip"),
          1000
        );
      }
    } catch (err) {
      setCurrentStep("prepare");
      setToast({
        message: err instanceof Error ? err.message : "Error creating game",
        type: "error",
      });
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = Number(e.target.value);
    const newAmount = (maxBet * (percentage / 100)).toFixed(2);
    setAmount(newAmount);
  };

  const handleSwipe = (e: React.TouchEvent<HTMLInputElement>) => {
    const percentage = Number(e.currentTarget.value);
    const newAmount = (maxBet * (percentage / 100)).toFixed(2);
    setAmount(newAmount);
  };

  type SharePlatform = "X" | "warpcast" | "copy";

const handleShare = async (platform: SharePlatform) => {
  const message = generateShareMessage(platform);
  const baseUrl = window.location.href;
  const pvpUrl = `${baseUrl}/pvp`; // Append /pvp to the base URL
  
  try {
    switch (platform) {
      case "X":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(baseUrl)}`,
          '_blank',
          'noopener,noreferrer'
        );
        break;
      case "warpcast":
        window.open(
          `https://warpcast.com/~/compose?text=${encodeURIComponent(message)}&embeds[]=${encodeURIComponent(pvpUrl)}`,
          '_blank',
          'noopener,noreferrer'
        );
        break;
      case "copy":
        try {
          // Copy the regular URL (without /pvp) to clipboard
          await navigator.clipboard.writeText(`${message} - ${baseUrl}`);
          setShareStatus("Copied to clipboard!");
          const timer = setTimeout(() => setShareStatus(""), 2000);
          return () => clearTimeout(timer);
        } catch (err) {
          console.error('Failed to copy:', err);
          setShareStatus("Failed to copy");
          setTimeout(() => setShareStatus(""), 2000);
        }
        break;
    }
  } catch (error) {
    console.error('Sharing failed:', error);
  }
};

  const generateShareMessage = (platform: "X" | "warpcast" | "copy"): string => {
    const baseMessage = `Join my coin flip game! ID: ${gameId} - I bet ${amount} ${tokenSymbol} on ${face ? "Heads" : "Tails"}`;
    
    switch (platform) {
      case "X":
        return `${baseMessage} 🎲 #CoinFlip`;
      case "warpcast":
        return `${baseMessage} 🚀`;
      case "copy":
        return baseMessage;
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <div className="bg-gradient-to-br from-gray-100 to-gray-200 py-2 px-2 sm:py-4 sm:px-6">
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-3 sm:p-6 relative overflow-hidden max-h-[80vh] sm:max-h-none overflow-y-auto">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2220%22 height=%2220%22 viewBox=%220 0 20 20%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M10 10h.01%22 fill=%22%23e5e7eb%22/%3E%3C/svg%3E')] opacity-10 pointer-events-none"></div>

        {/* Progress Stepper */}
        <div className="flex justify-between mb-4 sm:mb-6 relative z-10">
          {["Prepare", "Approve", "Create"].map((step, idx) => (
            <div key={step} className="flex flex-col items-center">
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step.toLowerCase()
                    ? "bg-blue-600 text-white"
                    : idx <
                      ["prepare", "approve", "create"].indexOf(currentStep)
                    ? "bg-green-500 text-white"
                    : "bg-gray-300 text-gray-700"
                }`}
              >
                {idx + 1}
              </div>
              <span className="text-xs mt-1 hidden sm:block">{step}</span>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">
            Create Game
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
              {truncatedAddress}
            </span>
            <button
              onClick={() => setShowTour(true)}
              className="text-blue-600 hover:text-blue-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 rounded"
              aria-label="Show first time tour"
            >
              First time?
            </button>
          </div>
        </div>

        {/* Balance Display */}
        <div className="text-center mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg shadow-inner">
          {isLoadingBalance || isLoading ? (
            <span className="text-gray-500 animate-pulse">Loading...</span>
          ) : (
            <>
              <span className="text-xl sm:text-2xl font-semibold text-gray-800">
                {parseFloat(formattedBalance).toFixed(2)}
              </span>
              <span className="ml-2 text-gray-600 text-sm sm:text-base">
                {tokenSymbol}
              </span>
            </>
          )}
        </div>

        {/* Heads/Tails */}
        <div className="mb-4 sm:mb-6">
          <label className="flex items-center justify-between text-sm font-medium text-gray-800 mb-2">
            Choose Side
            <span
              className="text-xs text-gray-500 cursor-help"
              title="Pick Heads or Tails to bet on"
            >
              ?
            </span>
          </label>
          <div ref={coinRef} className="grid grid-cols-2 gap-2 sm:gap-4">
            <button
              className={`p-3 sm:p-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[80px] sm:min-h-[100px] ${
                face
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
              onClick={() => setFace(true)}
              aria-label="Bet on Heads"
              aria-pressed={face}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full bg-yellow-400 flex items-center justify-center text-lg sm:text-xl font-bold text-gray-800 mb-2">
                H
              </div>
              <span className="text-sm">Heads</span>
            </button>
            <button
              className={`p-3 sm:p-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[80px] sm:min-h-[100px] ${
                !face
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
              onClick={() => setFace(false)}
              aria-label="Bet on Tails"
              aria-pressed={!face}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full bg-yellow-400 flex items-center justify-center text-lg sm:text-xl font-bold text-gray-800 mb-2">
                T
              </div>
              <span className="text-sm">Tails</span>
            </button>
          </div>
        </div>

        {/* Token Selection */}
        <div className="text-black mb-4 sm:mb-6">
          <label className="flex items-center justify-between text-sm font-medium text-gray-800 mb-2">
            Token
            <span
              className="text-xs text-gray-500 cursor-help"
              title="Select the token to bet with"
            >
              ?
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {SUPPORTED_TOKENS.map((token) => (
              <button
                key={token.symbol}
                className={`p-2 sm:p-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[60px] sm:min-h-[80px] ${
                  tokenSymbol === token.symbol
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => setTokenSymbol(token.symbol)}
                disabled={isPending}
                aria-label={`Select ${token.symbol}`}
              >
                <img
                  src={
                    TOKEN_ICONS[token.symbol] ||
                    "https://flip-it-clanker.vercel.app/icon.svg"
                  }
                  alt={`${token.symbol} icon`}
                  className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1"
                />
                <span className="text-xs sm:text-sm">{token.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bet Amount */}
        <div className="mb-4 text-black sm:mb-6">
          <label className="flex items-center justify-between text-sm font-medium text-gray-800 mb-2">
            Bet Amount
            <span
              className="text-xs text-gray-500 cursor-help"
              title="Amount to bet (max is your balance)"
            >
              ?
            </span>
          </label>
          <div className="grid grid-cols-4 gap-2 mb-2 sm:mb-3">
            {betPresets.map((preset) => (
              <button
                key={preset.label}
                className={`p-2 rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                  parseFloat(amount) === (maxBet * preset.percent) / 100
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
                onClick={() =>
                  setAmount(((maxBet * preset.percent) / 100).toFixed(2))
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm sm:text-base"
              step="0.01"
              min="0"
              max={maxBet}
              disabled={isPending}
              aria-label="Bet amount"
            />
            <span className="p-2 bg-gray-100 rounded-r-lg text-gray-700 text-sm sm:text-base">
              {tokenSymbol}
            </span>
          </div>
          <input
            ref={sliderRef}
            type="range"
            min="0"
            max={maxBet}
            value={parseFloat(amount)}
            onChange={handleSliderChange}
            onTouchMove={handleSwipe}
            className={`w-full accent-${getBetColor()}-500`}
            step="0.01"
            disabled={isPending || maxBet === 0}
            aria-label="Bet amount slider"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0</span>
            <span className={`text-${getBetColor()}-600`}>
              {betPercentage.toFixed(0)}%
            </span>
            <span>{maxBet.toFixed(2)}</span>
          </div>
        </div>

        {/* Timeout */}
        <div className="mb-4 text-black sm:mb-6">
          <button
            className="flex justify-between w-full text-sm font-medium text-gray-800 mb-2 focus:outline-none"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
          >
            Timeout
            <span
              className="text-xs text-gray-500 cursor-help"
              title="Time before the game expires if not accepted"
            >
              ?
            </span>
          </button>
          {showAdvanced && (
            <div className="space-y-2 animate-fade-in">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {timeoutOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`p-2 rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      betTimeout === option.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                    onClick={() => setBetTimeout(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={betTimeout}
                onChange={(e) => setBetTimeout(parseInt(e.target.value))}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm sm:text-base"
                min="1"
                disabled={isPending}
                aria-label="Timeout in seconds"
              />
              <div className="text-xs text-gray-600">
                Seconds until expiration
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <button
            onClick={() => handleCreateGame(true)}
            disabled={isPending || isLoadingBalance}
            className={`p-3 rounded-lg text-white transition-all focus:outline-none focus:ring-2 focus:ring-green-300 text-sm sm:text-base ${
              isPending
                ? "bg-gray-400"
                : "bg-green-600 hover:bg-green-700 hover:shadow-lg transform hover:-translate-y-0.5"
            }`}
            aria-label="Quick Bet with 0.1 tokens"
            title="Instantly bet 0.1 tokens"
          >
            {isPending && currentStep === "approve" ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="white"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="white"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Approving...
              </span>
            ) : (
              "Quick Bet"
            )}
          </button>
          <button
            onClick={() => handleCreateGame()}
            disabled={isPending || isLoadingBalance}
            className={`p-3 rounded-lg text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm sm:text-base ${
              isPending
                ? "bg-gray-400"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5"
            }`}
            aria-label="Create Game with custom amount"
          >
            {isPending ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="white"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="white"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {currentStep === "approve" ? "Approving..." : "Creating..."}
              </span>
            ) : (
              "Create Game"
            )}
          </button>
        </div>

        {/* Success Popup */}
        {showSuccessPopup && gameId && (
          <div className="fixed text-black inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-11/12 success-popup">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Game Created Successfully!</h3>
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <p className="font-mono text-sm">Game ID: #{gameId}</p>
                  <p className="text-sm mt-1">
                    {amount} {tokenSymbol} on {face ? "Heads" : "Tails"}
                  </p>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Share this game:</p>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `Join my coin flip game! ID: ${gameId} - ${window.location.href}`
                        );
                        setToast({ message: "Copied to clipboard!", type: "success" });
                      }}
                      className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                      title="Copy link"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                    </button>
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
                className="p-2 rounded-full hover:bg-gray-200 transition-colors"
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
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowSuccessPopup(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Join my coin flip game! ID: ${gameId} - ${window.location.href}`
                      );
                      setToast({ message: "Copied to clipboard!", type: "success" });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-4 left-4 right-4 sm:max-w-sm sm:mx-auto p-4 rounded-lg shadow-lg text-white animate-fade-in text-sm ${
              toast.type === "success"
                ? "bg-green-600"
                : toast.type === "error"
                ? "bg-red-600"
                : "bg-blue-600"
            }`}
            role="alert"
          >
            {toast.message}
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white opacity-75 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        {/* Guided Tour Modal */}
        {showTour && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 sm:p-6 rounded-lg max-w-md w-11/12">
              <h3 className="text-lg font-bold mb-4">Welcome to Coin Flip!</h3>
              <p className="text-gray-700 mb-4 text-sm sm:text-base">
                1. Choose Heads or Tails
                <br />
                2. Select your token and amount
                <br />
                3. Set a timeout
                <br />
                4. Create your game!
              </p>
              <button
                onClick={() => setShowTour(false)}
                className="w-full p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
              >
                Got it!
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        .animate-flip {
          animation: flip 1s ease-in-out;
        }
        @keyframes flip {
          0% {
            transform: rotateY(0deg);
          }
          50% {
            transform: rotateY(180deg);
          }
          100% {
            transform: rotateY(360deg);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .success-popup {
          animation: popIn 0.3s ease-out;
        }
        @keyframes popIn {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default CreateGameForm;