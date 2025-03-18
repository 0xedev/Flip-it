import React, { useState, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import {
  Coins,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { parseEther, formatEther } from "viem";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";

const CreateGame: React.FC = () => {
  const { isConnected, address } = useAccount();

  const [selectedToken, setSelectedToken] = useState<string>(SUPPORTED_TOKENS[0]?.address || "");
  const [betAmount, setBetAmount] = useState<string>('');
  const [selectedFace, setSelectedFace] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [timeoutDuration, setTimeoutDuration] = useState<string>("300");
  const [isApprovalPending, setIsApprovalPending] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);

  const { data: writeData, writeContract } = useWriteContract();
  const { isSuccess: isTxSuccess, isError: isTxError } = 
    useWaitForTransactionReceipt({
      hash: writeData,
    });

  // Handle approval transaction receipt
  const { isSuccess: isApprovalSuccess, isError: isApprovalError } = 
    useWaitForTransactionReceipt({
      hash: approvalTxHash as `0x${string}`,
      enabled: !!approvalTxHash,
    });

  const { data: balanceData } = useReadContract({
    address: selectedToken as `0x${string}`,
    abi: [
      {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: "balanceOf",
    args: [address || "0x0"],
    enabled: isConnected && !!address && !!selectedToken,
  });
  
  // Handle allowance check
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: selectedToken as `0x${string}`,
    abi: [
      {
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" }
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: "allowance",
    args: [address || "0x0", ADDRESS],
    enabled: isConnected && !!address && !!selectedToken,
  });

  useEffect(() => {
    if (balanceData) {
      console.log("Balance data received:", balanceData);
      setTokenBalance(formatEther(balanceData as bigint));
      console.log("Token balance updated:", formatEther(balanceData as bigint));
    }
  }, [balanceData]);

  useEffect(() => {
    if (isTxSuccess) {
      console.log("Transaction succeeded with hash:", writeData);
      setLoading(false);
      setPendingTxHash(null);
      setSuccess("Game created successfully!");
  
      // Refetch the token balance after successful game creation
   
      setTimeout(() => {
        console.log("Clearing success message");
        setSuccess(null);
      }, 5000);
    }
    if (isTxError) {
      console.log("Transaction failed with hash:", writeData);
      setLoading(false);
      setError("Transaction failed. Please try again.");
      setPendingTxHash(null);
      setTimeout(() => {
        console.log("Clearing error message");
        setError(null);
      }, 5000);
    }
  }, [isTxSuccess, isTxError]);
  

  
  // Monitor approval transaction status
  useEffect(() => {
    if (isApprovalSuccess) {
      console.log("Approval succeeded with hash:", approvalTxHash);
      setIsApprovalPending(false);
      setApprovalTxHash(null);
      refetchAllowance();
      
      // After successful approval, proceed with game creation
      const amount = parseEther(betAmount);
      const timeout = BigInt(timeoutDuration);
      
      console.log("Approval successful, now creating game");
      writeContract({
        address: ADDRESS,
        abi: ABI,
        functionName: "createGame",
        args: [selectedFace, selectedToken, amount, timeout],
      });
    }
    
    if (isApprovalError) {
      console.log("Approval failed with hash:", approvalTxHash);
      setLoading(false);
      setIsApprovalPending(false);
      setApprovalTxHash(null);
      setError("Token approval failed. Please try again.");
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  }, [isApprovalSuccess, isApprovalError, approvalTxHash]);

  useEffect(() => {
    if (writeData) {
      console.log("Pending transaction hash set:", writeData);
      setPendingTxHash(writeData);
    }
  }, [writeData]);

  const handleCreateGame = async () => {
    if (!isConnected || !address) {
      console.log("Wallet not connected, cannot create game");
      setError("Please connect your wallet first");
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    try {
      console.log("Starting game creation process");
      setLoading(true);
      setError(null);
      
      const amount = parseEther(betAmount);
      const timeout = BigInt(timeoutDuration);
      
      console.log("Creating game with:", {
        face: selectedFace,
        token: selectedToken,
        amount: betAmount,
        timeout: timeoutDuration
      });
      
      console.log("User address:", address);
      console.log("Allowance data:", allowanceData);
      
      // Convert allowanceData to bigint for proper comparison
      const currentAllowance = allowanceData ? BigInt(allowanceData.toString()) : BigInt(0);
      console.log("Current allowance:", currentAllowance.toString());
      console.log("Required amount:", amount.toString());
      
      // Check if allowance is insufficient
      if (currentAllowance < amount) {
        console.log("Allowance is insufficient, requesting approval...");
        const approved = await approveTokens(amount);
        
        if (!approved) {
          console.log("Approval process failed or was rejected");
          setLoading(false);
          return;
        }
        
        // The game creation will be handled by the effect when approval succeeds
        return;
      }
      
      // If we already have sufficient allowance, proceed with game creation
      console.log("Sufficient allowance exists, creating game directly");
      writeContract({
        address: ADDRESS,
        abi: ABI,
        functionName: "createGame",
        args: [selectedFace, selectedToken, amount, timeout],
      });
      
    } catch (err) {
      console.error("Error in game creation:", err);
      setLoading(false);
      setError("Failed to create game. Please try again.");
      setTimeout(() => {
        console.log("Clearing error message");
        setError(null);
      }, 5000);
    }
  };

  const approveTokens = async (amount: bigint) => {
    console.log("Approving tokens for amount:", amount.toString());
    setIsApprovalPending(true);
    
    try {
      // Request a large approval amount to avoid needing frequent approvals
      const approvalAmount = amount * BigInt(10); // Approve 10x the needed amount
      
      console.log("Sending approval transaction for:", approvalAmount.toString());
      const hash = await writeContract({
        address: selectedToken as `0x${string}`,
        abi: [
          {
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            name: "approve",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function"
          }
        ],
        functionName: "approve",
        args: [ADDRESS, approvalAmount],
      });
      
      console.log("Approval transaction submitted:", hash);
      setApprovalTxHash(hash);
      
      return true;
    } catch (error) {
      console.error("Error approving tokens:", error);
      setIsApprovalPending(false);
      setError("Failed to approve tokens. Please try again.");
      setTimeout(() => setError(null), 5000);
      return false;
    }
  };

  const getTokenSymbol = (address: string) => {
    const token = SUPPORTED_TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token?.symbol || "???";
  };

  const handleTokenChange = (value: string) => {
    console.log("Token changed to:", value);
    setSelectedToken(value);
  };

  const handleBetAmountChange = (value: string) => {
    console.log("Bet amount changed to:", value);
    setBetAmount(value);
  };

  const handleFaceChange = (value: boolean) => {
    console.log("Face selection changed to:", value ? "Heads" : "Tails");
    setSelectedFace(value);
  };

  const handleTimeoutChange = (value: string) => {
    console.log("Timeout duration changed to:", value);
    setTimeoutDuration(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4 flex items-center justify-center">
      <div className="w-full">
        {error && (
          <div className="bg-red-500 text-white p-4 text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500 text-white p-4 text-center">
            {success}
          </div>
        )}
        {loading && (
          <div className="bg-yellow-500 text-white p-4 text-center">
            {isApprovalPending ? "Approving tokens..." : "Processing transaction..."}
            {(pendingTxHash || approvalTxHash) && (
              <span className="ml-2">
                Hash: {(pendingTxHash || approvalTxHash)?.substring(0, 10)}...
              </span>
            )}
          </div>
        )}
        <div className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-xl rounded-2xl">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Coins className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Create New Game
              </h2>
            </div>
            {address && (
              <p className="text-xs text-gray-500 mb-4 truncate">Connected: {address}</p>
            )}
            
            <div className="space-y-4">
              {/* Token Balance Card */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-medium text-gray-600">
                      Balance
                    </span>
                  </div>
                  <span className="font-bold text-gray-900">
                    {parseFloat(tokenBalance).toFixed(4)} {getTokenSymbol(selectedToken)}
                  </span>
                </div>
              </div>

              {/* Bet Amount */}
              <div className="space-y-2">
                <label
                  htmlFor="betAmount"
                  className="block text-sm font-medium text-gray-700"
                >
                  Bet Amount
                </label>
                <div className="text-gray-700 relative">
                  <input
                    id="betAmount"
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="0.00"
                    value={betAmount}
                    onChange={(e) => handleBetAmountChange(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors pr-20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    {getTokenSymbol(selectedToken)}
                  </span>
                </div>
              </div>

              {/* Token Selection */}
              <div>
                <label
                  htmlFor="token"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Select Token
                </label>
                <select
                  id="token"
                  value={selectedToken}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  disabled={loading}
                  className="w-full text-black-700 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  {SUPPORTED_TOKENS.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timeout Duration */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Game Timeout
                </label>
                <select
                  id="timeout"
                  value={timeoutDuration}
                  onChange={(e) => handleTimeoutChange(e.target.value)}
                  className="w-full text-gray-700 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="300">5 minutes</option>
                  <option value="3600">1 hour</option>
                  <option value="86400">24 hours</option>
                </select>
              </div>

              
              {/* Player Choice */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Your Choice
                </label>
                <div className="flex items-center justify-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <button
                    onClick={() => handleFaceChange(false)}
                    className={`px-6 py-2 rounded-lg transition-all ${
                      !selectedFace
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Tails
                  </button>
                  <button
                    onClick={() => handleFaceChange(true)}
                    className={`px-6 py-2 rounded-lg transition-all ${
                      selectedFace
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Heads
                  </button>
                </div>
              </div>

              {/* Create Game Button */}
              <button
                onClick={handleCreateGame}
                disabled={loading || !selectedToken || parseFloat(betAmount) <= 0}
                className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-white font-medium transition-colors ${
                  loading || !isConnected
                    ? "bg-indigo-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Game...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Game
                  </>
                )}
              </button>

              {/* Status Messages */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-600">{success}</p>
                </div>
              )}

              {/* Help Text */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-600">
                  Create a new game by setting your bet amount and choosing heads or
                  tails. The game will timeout if no one joins within the selected
                  timeout period.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGame;