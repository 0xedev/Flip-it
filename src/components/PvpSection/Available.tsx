import React, { useState, useEffect, useCallback } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
  useWatchContractEvent,
} from "wagmi";
import { formatEther, Address } from "viem";
import { CircleDollarSign, XCircle, GamepadIcon } from "lucide-react";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";

interface PendingBet {
  betId: number;
  player: Address;
  token: Address;
  amount: bigint;
  face: boolean;
  timestamp: bigint;
}

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-64 gap-8">
    <div className="coin">
      <div className="coin-face coin-front">
        <CircleDollarSign className="w-full h-full text-white/90 p-6" />
      </div>
      <div className="coin-face coin-back">
        <CircleDollarSign className="w-full h-full text-white/90 p-6" />
      </div>
    </div>
    <span className="text-xl font-semibold loading-text">
      Processing transaction...
    </span>
  </div>
);

const GameList: React.FC = () => {
  const { isConnected, address } = useAccount();
  const [selectedToken] = useState<Address>(SUPPORTED_TOKENS[0]?.address as `0x${string}` || "0x0000000000000000000000000000000000000000");
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [, setTokenBalance] = useState<string>("0");
  const [isApprovalPending, setIsApprovalPending] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const gamesPerPage = 5;

  const { data: writeData, writeContract } = useWriteContract();
  const { isSuccess: isTxSuccess, isError: isTxError } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  const { isSuccess: isApprovalSuccess, isError: isApprovalError } = 
    approvalTxHash
      ? useWaitForTransactionReceipt({
          hash: approvalTxHash as `0x${string}`,
        })
      : { isSuccess: false, isError: false };

  const { data: pendingBetsData, refetch: refetchPendingBets } = useReadContract({
    address: ADDRESS,
    abi: ABI,
    functionName: "getPendingBets",
    query: { enabled: isConnected },
  });

  const {
    data: balanceData,
    refetch: refetchBalance,
  } = useReadContract({
    address: selectedToken,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
    ],
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: !!address && !!selectedToken },
  });

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "MatchFulfilled",
    onLogs() {
      refetchPendingBets();
      refetchBalance();
      setSuccess("Game completed! Check results!");
      setTimeout(() => setSuccess(null), 5000);
    },
  });

  const handleContractEvent = useCallback((message: string) => {
    refetchPendingBets();
    refetchBalance();
    setSuccess(message);
    setTimeout(() => setSuccess(null), 5000);
  }, [refetchPendingBets, refetchBalance]);

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "BetPlaced",
    onLogs: () => handleContractEvent("Bet placed successfully!"),
  });

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "MatchCreated",
    onLogs: () => handleContractEvent("Successfully joined the game!"),
  });

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "BetCanceled",
    onLogs: () => handleContractEvent("Bet successfully canceled!"),
  });

  const isBetActive = useCallback((bet: PendingBet): boolean => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeout = BigInt(3600);
    return now < bet.timestamp + timeout;
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      setLoading(true);
      console.log("Fetching pending bets and balance...");
      Promise.all([refetchPendingBets(), refetchBalance()])
        .catch((err) => {
          setErrorMessage(`Failed to fetch data: ${err.message}`);
          console.error(err);
        })
        .finally(() => setLoading(false));
    }
  }, [isConnected, address, refetchPendingBets, refetchBalance]);

  useEffect(() => {
    if (pendingBetsData) {
      const formattedBets = (pendingBetsData as any[]).map((bet, index) => ({
        betId: index + 1,
        player: bet.player as Address,
        token: bet.token as Address,
        amount: bet.amount as bigint,
        face: bet.face as boolean,
        timestamp: bet.timestamp as bigint
      }));
      console.log("Pending Bets:", formattedBets);
      setPendingBets(formattedBets);
    }
  }, [pendingBetsData]);

  useEffect(() => {
    if (balanceData) {
      setTokenBalance(formatEther(balanceData as bigint));
      console.log("Token balance:", formatEther(balanceData as bigint));
    }
  }, [balanceData]);

  useEffect(() => {
    if (isTxSuccess) {
      setLoading(false);
      setSuccess("Transaction confirmed!");
      refetchBalance();
      setTimeout(() => setSuccess(null), 5000);
    } else if (isTxError) {
      setLoading(false);
      setErrorMessage("Transaction failed");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [isTxSuccess, isTxError, refetchBalance]);

  useEffect(() => {
    if (isApprovalSuccess) {
      setIsApprovalPending(false);
      setApprovalTxHash(null);
      console.log("Token approval successful");
    }
    if (isApprovalError) {
      setLoading(false);
      setIsApprovalPending(false);
      setApprovalTxHash(null);
      setErrorMessage("Token approval failed");
      setTimeout(() => setErrorMessage(null), 5000);
      console.log("Token approval failed");
    }
  }, [isApprovalSuccess, isApprovalError]);

  const approveTokens = async (amount: bigint, tokenAddress: Address) => {
    setIsApprovalPending(true);
    try {
      const approvalAmount = amount * BigInt(1); // Approve 10x the needed amount
      const result = await writeContract({
        address: tokenAddress as `0x${string}`,
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

      if (result !== undefined && typeof result === "string") {
        setApprovalTxHash(result);
      } else {
        throw new Error("Failed to retrieve transaction hash");
      }
      console.log("Approval TX hash:", result);
      return true;
    } catch (error) {
      setIsApprovalPending(false);
      setErrorMessage("Failed to approve tokens");
      setTimeout(() => setErrorMessage(null), 5000);
      console.error("Approval failed:", error);
      return false;
    }
  };

  const handleJoinGame = async (betId: number) => {
    if (!isConnected || !address) {
      setErrorMessage("Please connect your wallet");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const bet = pendingBets.find(b => b.betId === betId);
      if (!bet || !isBetActive(bet)) {
        throw new Error("Bet not found or expired");
      }

      const balance = balanceData as bigint | undefined;
      if (!balance || balance < bet.amount) {
        throw new Error("Insufficient token balance");
      }

      console.log("Joining game with bet:", bet);

      // Approve tokens first
      const approved = await approveTokens(bet.amount, bet.token);
      if (!approved) {
        setLoading(false);
        return;
      }

      // Wait for approval to be confirmed before joining
      if (isApprovalPending) {
        return;
      }

      await writeContract({
        address: ADDRESS,
        abi: ABI,
        functionName: "joinGame",
        args: [betId],
      });
      console.log(`Joined game with betId: ${betId}`);
    } catch (err) {
      setLoading(false);
      setErrorMessage(err instanceof Error ? err.message : "Failed to join game");
      setTimeout(() => setErrorMessage(null), 5000);
      console.error("Error joining game:", err);
    }
  };

  const handleCancelBet = async (betId: number) => {
    if (!isConnected || !address) {
      setErrorMessage("Please connect your wallet");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      console.log(`Canceling bet with betId: ${betId}`);
      await writeContract({
        address: ADDRESS,
        abi: ABI,
        functionName: "cancelBet",
        args: [betId],
      });
    } catch (err) {
      setLoading(false);
      setErrorMessage(err instanceof Error ? err.message : "Failed to cancel bet");
      setTimeout(() => setErrorMessage(null), 5000);
      console.error("Error canceling bet:", err);
    }
  };

  const activeBets = pendingBets.filter(isBetActive);
  const sortedGames = [...activeBets].sort((a, b) => Number(b.betId) - Number(a.betId));
  const totalPages = Math.ceil(activeBets.length / gamesPerPage);
  const indexOfLastGame = currentPage * gamesPerPage;
  const indexOfFirstGame = indexOfLastGame - gamesPerPage;
  const currentGames = sortedGames.slice(indexOfFirstGame, indexOfLastGame);

  const getTokenSymbol = (tokenAddress: Address): string => {
    return SUPPORTED_TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase())?.symbol || "???";
  };

  const getTimeDiff = (timestamp: bigint): string => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const diff = now - timestamp;

    if (diff < BigInt(60)) return `${diff.toString()} seconds ago`;
    if (diff < BigInt(3600)) return `${(diff / BigInt(60)).toString()} minutes ago`;
    if (diff < BigInt(86400)) return `${(diff / BigInt(3600)).toString()} hours ago`;
    return `${(diff / BigInt(86400)).toString()} days ago`;
  };

  const canCancelBet = (bet: PendingBet): boolean => {
    return bet.player.toLowerCase() === address?.toLowerCase() && 
      BigInt(Math.floor(Date.now() / 1000)) >= bet.timestamp + BigInt(3600);
  };

  return (
    <div>
      {loading && <LoadingSpinner />}
      <div className={`max-w-[1400px] mx-auto ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        {errorMessage && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
            <p className="flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              {errorMessage}
            </p>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-400">
            <p className="flex items-center gap-2">{success}</p>
          </div>
        )}

        {activeBets.length === 0 && !loading ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-8 text-center">
            <GamepadIcon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No Available Games
            </h3>
            <p className="text-white/70">
              There are currently no active games to join. Check back later or create a game.
            </p>
          </div>
        ) : (
          !loading && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b border-white/10">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">Choice</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">Token Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">Amount</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-white">Created</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-white">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {currentGames.map((bet) => (
                      <tr key={bet.betId} className="bg-white/10">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{bet.face ? "Tails" : "Heads"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{getTokenSymbol(bet.token)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{formatEther(bet.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{getTimeDiff(bet.timestamp)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-white">
                          {bet.player.toLowerCase() === address?.toLowerCase() ? (
                            <button
                              onClick={() => handleCancelBet(bet.betId)}
                              className={`py-1 px-4 rounded text-sm ${canCancelBet(bet) ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                              disabled={loading || !canCancelBet(bet)}
                            >
                              {canCancelBet(bet) ? "Cancel" : "Waiting"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinGame(bet.betId)}
                              className="py-1 px-4 rounded bg-green-500 text-white text-sm disabled:opacity-50"
                              disabled={loading || isApprovalPending}
                            >
                              Join
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center p-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || loading}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-white">{`Page ${currentPage} of ${totalPages}`}</span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || loading}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default GameList;
