import React, { useState, useEffect } from "react";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";
import { useWriteContract, useAccount, useReadContract } from "wagmi";
import { parseUnits, Address, formatUnits } from "viem";

// Custom hook for creating a game
export function useCreateGame() {
  const [gameId] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContractAsync } = useWriteContract();

  // Function to approve token spending before creating game
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
      const errorMsg = `Insufficient funds: You need to add ${shortfall} more ${tokenSymbol}`;
      return { success: false, error: new Error(errorMsg) };
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

      console.log("Approval transaction data:", data);
      return { success: true, data };
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("User denied transaction signature")
      ) {
        return {
          success: false,
          error: new Error("Token approval was canceled by the user."),
        };
      }
      console.error("Error approving token:", err);
      return {
        success: false,
        error: err instanceof Error ? err : new Error("Error approving token"),
      };
    }
  };

  // Main function to create a game
  const createGame = async ({
    face,
    tokenSymbol,
    amount,
    betTimeout,
    tokenBalance, // Pass the user's token balance to check against
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
      // Find token from supported tokens
      const token = SUPPORTED_TOKENS.find((t) => t.symbol === tokenSymbol);
      if (!token) {
        throw new Error(`Token ${tokenSymbol} not supported`);
      }

      // Parse amount with correct decimals (assuming 18 decimals for all tokens)
      const parsedAmount = parseUnits(amount, 18);

      // First approve the contract to spend tokens, passing the balance for comparison
      const approvalResult = await approveToken(
        token.address as Address,
        parsedAmount,
        tokenBalance
      );
      if (!approvalResult.success) {
        throw approvalResult.error;
      }

      // Wait for approval transaction to complete
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Simple timeout, consider using actual transaction confirmation

      // Create the game
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
      console.error("Error creating game:", err);
      setError(
        err instanceof Error ? err : new Error("Unknown error occurred")
      );
      setIsPending(false);
      setIsSuccess(false);
      throw err;
    }
  };

  return {
    createGame,
    gameId,
    isPending,
    isSuccess,
    error,
    setError,
  };
}

// Example component using the hook
const CreateGameForm: React.FC = () => {
  const { address } = useAccount(); // Destructure address from the useAccount hook
  const [face, setFace] = useState<boolean>(true); // true for heads, false for tails
  const [tokenSymbol, setTokenSymbol] = useState<string>(
    SUPPORTED_TOKENS[0]?.symbol || ""
  );
  const [amount, setAmount] = useState<string>("0.1");
  const [betTimeout, setBetTimeout] = useState<number>(3600); // 1 hour in seconds
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0)); // Store token balance
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For validation errors

  const { createGame, isPending, isSuccess, error, setError } = useCreateGame();

  // Get the current selected token's address
  const selectedToken = SUPPORTED_TOKENS.find((t) => t.symbol === tokenSymbol);
  const tokenAddress = selectedToken?.address as Address;

  // Fetch token balance for the selected token
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

  // Refetch balance when address or tokenAddress changes
  useEffect(() => {
    if (address && tokenAddress) {
      refetch();
    }
  }, [address, tokenAddress, refetch]);

  // Handle token change
  const handleTokenChange = async (newTokenSymbol: string) => {
    setIsLoadingBalance(true);
    setTokenSymbol(newTokenSymbol);
    // Clear any existing errors when changing tokens
    setErrorMessage(null);
  };

  // Update balance when balanceData changes or when loading completes
  useEffect(() => {
    if (balanceData !== undefined) {
      setTokenBalance(BigInt(balanceData.toString()));
      setIsLoadingBalance(false);
    }
  }, [balanceData]);

  // Format the balance with proper decimals
  const formattedBalance = formatUnits(tokenBalance, 18); // Adjust decimals according to token
  const roundedBalance = parseFloat(formattedBalance).toFixed(2);

  // Validate bet amount
  const validateAmount = (value: string): boolean => {
    // Check if amount is a valid number greater than 0
    if (parseFloat(value) <= 0 || value.trim() === "") {
      setErrorMessage("Please enter a valid bet amount greater than 0");
      return false;
    }

    // Validate that the amount has at most 2 decimal places
    const decimalCheck = /^(\d+(\.\d{1,2})?)$/;
    if (!decimalCheck.test(value)) {
      setErrorMessage(
        "Please enter a bet amount with at most 2 decimal places"
      );
      return false;
    }

    // Check if amount exceeds balance
    const parsedAmount = parseUnits(value, 18);
    if (parsedAmount > tokenBalance) {
      const shortfall = parseFloat(
        formatUnits(parsedAmount - tokenBalance, 18)
      ).toFixed(2);
      setErrorMessage(
        `Insufficient balance: You need ${shortfall} more ${tokenSymbol}`
      );
      return false;
    }

    return true;
  };

  // Handle button click for game creation
  const handleCreateGame = async () => {
    setErrorMessage(null);
    setError(null);

    if (!validateAmount(amount)) return;

    try {
      await createGame({
        face,
        tokenSymbol,
        amount,
        betTimeout,
        tokenBalance,
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("User denied transaction signature")
      ) {
        setErrorMessage("Transaction was canceled by the user.");
      } else {
        setErrorMessage("Error creating game. Please try again.");
      }
    }
  };

  // Auto-hide error messages after 5 seconds
  useEffect(() => {
    if (errorMessage || error) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, error, setError]);

  return (
    <div className="space-y-4 text-black">
      <div>
        <label className="block mb-2 font-medium">Choose Side:</label>
        <p className="text-sm text-gray-600 mb-2">{address}</p>

        {/* Display token balance and symbol with loading indicator */}
        <div className="text-xl font-semibold mb-4">
          {isLoadingBalance || isLoading ? (
            <span className="text-gray-400">Loading balance...</span>
          ) : (
            <>
              <span>{roundedBalance} </span>
              <span>{tokenSymbol}</span>
            </>
          )}
        </div>

        <div className="flex space-x-4 mb-6">
          <button
            type="button"
            className={`px-6 py-3 rounded-lg font-medium ${
              face ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setFace(true)}
          >
            Heads
          </button>
          <button
            type="button"
            className={`px-6 py-3 rounded-lg font-medium ${
              !face ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setFace(false)}
          >
            Tails
          </button>
        </div>
      </div>

      <div>
        <label className="block mb-2 font-medium">Token:</label>
        <select
          value={tokenSymbol}
          onChange={(e) => handleTokenChange(e.target.value)}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          disabled={isPending}
        >
          {SUPPORTED_TOKENS.map((token) => (
            <option key={token.address} value={token.symbol}>
              {token.symbol}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-2 font-medium">Amount:</label>
        <input
          type="text"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            // Clear error when user types
            if (errorMessage) setErrorMessage(null);
          }}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="0.1"
          disabled={isPending}
        />
      </div>

      <div>
        <label className="block mb-2 font-medium">Timeout (seconds):</label>
        <input
          type="number"
          value={betTimeout}
          onChange={(e) => setBetTimeout(parseInt(e.target.value))}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="3600"
          min="1"
          disabled={isPending}
        />
      </div>

      <button
        type="button"
        onClick={handleCreateGame}
        disabled={isPending || isLoadingBalance}
        className="w-full p-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
      >
        {isPending ? "Creating Game..." : "Create Game"}
      </button>

      {/* Combined error message display */}
      {(errorMessage || error) && (
        <div className="p-3 bg-red-100 text-red-800 rounded-lg animate-fade-in">
          {errorMessage || error?.message}
        </div>
      )}

      {isSuccess && (
        <div className="p-3 bg-green-100 text-green-800 rounded-lg animate-fade-in">
          Game created successfully!
        </div>
      )}
    </div>
  );
};

export default CreateGameForm;
