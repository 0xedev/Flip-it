import React, { useState, useEffect, useRef } from "react";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";
import { useWriteContract, useAccount, useReadContract } from "wagmi";
import { parseUnits, Address, formatUnits } from "viem";

const TOKEN_ICONS: { [key: string]: string } = {
  STABLEAI: "https://flip-it-clanker.vercel.app/icon.svg",
  // Add more token icons as needed
};

export function useCreateGame() {
  const [gameId] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContractAsync } = useWriteContract();

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

      const tx = await writeContractAsync({
        address: ADDRESS as Address,
        abi: ABI,
        functionName: "createGame",
        args: [face, token.address, parsedAmount, BigInt(betTimeout)],
      });

      setIsPending(false);
      setIsSuccess(true);
      return tx;
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

  const sliderRef = useRef<HTMLInputElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  const { createGame, isPending } = useCreateGame();

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
      await createGame({
        face,
        tokenSymbol,
        amount: betAmount,
        betTimeout,
        tokenBalance,
      });
      setCurrentStep("create");
      setToast({ message: "Game created successfully!", type: "success" });
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

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <div className="bg-gradient-to-br from-gray-100 to-gray-200 py-2 px-2 sm:py-4 sm:px-6">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-3 sm:p-6 relative overflow-hidden max-h-[80vh] sm:max-h-none overflow-y-auto">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2220%22 height=%2220%22 viewBox=%220 0 20 20%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M10 10h.01%22 fill=%22%23e5e7eb%22/%3E%3C/svg%3E')] opacity-10 pointer-events-none"></div>

        {/* Progress Stepper */}
        <div className="flex justify-between mb-3 sm:mb-6 relative z-10">
          {["Prepare", "Approve", "Create"].map((step, idx) => (
            <div key={step} className="flex flex-col items-center">
              <div
                className={`w-5 h-5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
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
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 sm:mb-6 gap-2">
          <h2 className="text-base sm:text-xl font-bold text-gray-800">
            Create Game
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
              {truncatedAddress}
            </span>
            <button
              onClick={() => setShowTour(true)}
              className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 rounded"
              aria-label="Show first time tour"
            >
              First time?
            </button>
          </div>
        </div>

        {/* Balance Display */}
        <div className="text-center mb-3 sm:mb-6 p-2 sm:p-4 bg-gray-50 rounded-lg shadow-inner">
          {isLoadingBalance || isLoading ? (
            <span className="text-gray-500 animate-pulse">Loading...</span>
          ) : (
            <>
              <span className="text-lg sm:text-2xl font-semibold text-gray-800">
                {parseFloat(formattedBalance).toFixed(2)}
              </span>
              <span className="ml-2 text-gray-600 text-xs sm:text-base">
                {tokenSymbol}
              </span>
            </>
          )}
        </div>

        {/* Heads/Tails */}
        <div className="mb-3 sm:mb-6">
          <label className="flex items-center justify-between text-xs sm:text-sm font-medium text-gray-800 mb-2">
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
              className={`p-2 sm:p-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[60px] sm:min-h-[100px] ${
                face
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
              onClick={() => setFace(true)}
              aria-label="Bet on Heads"
              aria-pressed={face}
            >
              <div className="w-8 h-8 sm:w-12 sm:h-12 mx-auto rounded-full bg-yellow-400 flex items-center justify-center text-base sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2">
                H
              </div>
              <span className="text-xs sm:text-sm">Heads</span>
            </button>
            <button
              className={`p-2 sm:p-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[60px] sm:min-h-[100px] ${
                !face
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
              onClick={() => setFace(false)}
              aria-label="Bet on Tails"
              aria-pressed={!face}
            >
              <div className="w-8 h-8 sm:w-12 sm:h-12 mx-auto rounded-full bg-yellow-400 flex items-center justify-center text-base sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2">
                T
              </div>
              <span className="text-xs sm:text-sm">Tails</span>
            </button>
          </div>
        </div>

        {/* Token Selection */}
        <div className="text-black mb-3 sm:mb-6">
          <label className="flex items-center justify-between text-xs sm:text-sm font-medium text-gray-800 mb-2">
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
                className={`p-2 sm:p-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[50px] sm:min-h-[80px] ${
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
                  className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1"
                />
                <span className="text-xs sm:text-sm">{token.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bet Amount */}
        <div className="mb-3 text-black sm:mb-6">
          <label className="flex items-center justify-between text-xs sm:text-sm font-medium text-gray-800 mb-2">
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
                className={`p-1 sm:p-2 rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 ${
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
              className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-xs sm:text-base"
              step="0.01"
              min="0"
              max={maxBet}
              disabled={isPending}
              aria-label="Bet amount"
            />
            <span className="p-2 bg-gray-100 rounded-r-lg text-gray-700 text-xs sm:text-base">
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
        <div className="mb-3 text-black sm:mb-6">
          <button
            className="flex justify-between w-full text-xs sm:text-sm font-medium text-gray-800 mb-2 focus:outline-none"
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
                    className={`p-1 sm:p-2 rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 ${
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
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-xs sm:text-base"
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
            className={`p-2 sm:p-3 rounded-lg text-white transition-all focus:outline-none focus:ring-2 focus:ring-green-300 text-xs sm:text-base ${
              isPending
                ? "bg-gray-400"
                : "bg-green-600 hover:bg-green-700 hover:shadow-lg transform hover:-translate-y-0.5"
            }`}
            aria-label="Quick Bet with 1000 tokens"
            title="Instantly bet 1000 tokens"
          >
            {isPending && currentStep === "approve" ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2"
                  viewBox="0 0 24 24"
                >
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
            className={`p-2 sm:p-3 rounded-lg text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 text-xs sm:text-base ${
              isPending
                ? "bg-gray-400"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5"
            }`}
            aria-label="Create Game with custom amount"
          >
            {isPending ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2"
                  viewBox="0 0 24 24"
                >
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

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-4 left-4 right-4 sm:max-w-sm sm:mx-auto p-3 sm:p-4 rounded-lg shadow-lg text-white animate-fade-in text-xs sm:text-sm ${
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
            <div className="bg-white p-3 sm:p-6 rounded-lg max-w-md w-11/12">
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">
                Welcome to Coin Flip!
              </h3>
              <p className="text-gray-700 mb-3 sm:mb-4 text-xs sm:text-base">
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
                className="w-full p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-base"
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
      `}</style>
    </div>
  );
};

export default CreateGameForm;
