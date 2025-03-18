import React, { useState, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
  useWatchContractEvent,
} from "wagmi";
import { formatEther } from "viem";
import { CircleDollarSign, XCircle, GamepadIcon } from "lucide-react";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";

type PendingBet = {
  betId: number;
  player: string;
  token: string;
  amount: bigint;
  face: boolean;
  timestamp: bigint;
};

const LoadingSpinner = () => (
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
  const [selectedToken] = useState<string>(SUPPORTED_TOKENS[0]?.address || "");
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const gamesPerPage = 5;

  // Filter out expired bets (older than 1 hour)
  const isBetActive = (bet: PendingBet) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeout = BigInt(3600); // 1 hour in seconds
    return now < bet.timestamp + timeout;
  };

  const activeBets = pendingBets.filter(isBetActive);
  const sortedGames = [...activeBets].sort((a, b) => Number(b.betId) - Number(a.betId));
  const indexOfLastGame = currentPage * gamesPerPage;
  const indexOfFirstGame = indexOfLastGame - gamesPerPage;
  const currentGames = sortedGames.slice(indexOfFirstGame, indexOfLastGame);

  const { data: writeData, writeContract } = useWriteContract();
  const { isSuccess: isTxSuccess, isError: isTxError } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  const { data: pendingBetsData, refetch: refetchPendingBets } = useReadContract({
    address: ADDRESS,
    abi: ABI,
    functionName: "getPendingBets",
    enabled: isConnected,
  });

  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: selectedToken,
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

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "BetPlaced",
    onLogs() {
      refetchPendingBets();
      setSuccess("Bet placed successfully!");
      setTimeout(() => setSuccess(null), 5000);
    },
  });

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "MatchCreated",
    onLogs() {
      refetchPendingBets();
      setSuccess("Successfully joined the game!");
      setTimeout(() => setSuccess(null), 5000);
    },
  });

  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "BetCanceled",
    onLogs() {
      refetchPendingBets();
      setSuccess("Bet successfully canceled!");
      setTimeout(() => setSuccess(null), 5000);
    },
  });

  useEffect(() => {
    if (isConnected) {
      setLoading(true);
      refetchPendingBets().finally(() => setLoading(false));
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (pendingBetsData) {
      const formattedBets = (pendingBetsData as any[]).map((bet, index) => ({
        betId: index + 1,
        player: bet.player,
        token: bet.token,
        amount: bet.amount,
        face: bet.face,
        timestamp: bet.timestamp
      }));
      setPendingBets(formattedBets);
    }
  }, [pendingBetsData]);

  useEffect(() => {
    if (isTxSuccess) {
      setLoading(false);
    }
    if (isTxError) {
      setLoading(false);
      setErrorMessage("Transaction failed. Please try again.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [isTxSuccess, isTxError]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleJoinGame = async (betId: number) => {
    if (!isConnected || !address) return;

    try {
      setLoading(true);
      setErrorMessage(null);

      const bet = activeBets.find(b => b.betId === betId);
      if (!bet) throw new Error("Bet not found or expired");

      if (allowanceData < bet.amount) {
        await approveTokens(bet.amount);
      }

      writeContract({
        address: ADDRESS,
        abi: ABI,
        functionName: "joinGame",
        args: [betId],
      });
    } catch (err) {
      setLoading(false);
      setErrorMessage("Failed to join game. Please try again.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleCancelBet = async (betId: number) => {
    if (!isConnected || !address) return;

    try {
      setLoading(true);
      setErrorMessage(null);

      writeContract({
        address: ADDRESS,
        abi: ABI,
        functionName: "cancelBet",
        args: [betId],
      });
    } catch (err) {
      setLoading(false);
      setErrorMessage("Failed to cancel bet. Please try again.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const approveTokens = async (amount: bigint) => {
    setLoading(true);
    writeContract({
      address: selectedToken,
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
      args: [ADDRESS, amount],
    });

    return new Promise((resolve) => {
      const checkApproval = setInterval(() => {
        if (!writeData) {
          clearInterval(checkApproval);
          refetchAllowance();
          setLoading(false);
          resolve(true);
        }
      }, 1000);
    });
  };

  const getTokenSymbol = (address: string) => {
    const token = SUPPORTED_TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token?.symbol || "???";
  };

  const getTimeDiff = (timestamp: bigint) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const diff = now - timestamp;
    
    if (diff < BigInt(60)) return `${diff.toString()} seconds ago`;
    if (diff < BigInt(3600)) return `${(diff / BigInt(60)).toString()} minutes ago`;
    if (diff < BigInt(86400)) return `${(diff / BigInt(3600)).toString()} hours ago`;
    return `${(diff / BigInt(86400)).toString()} days ago`;
  };

  const canCancelBet = (bet: PendingBet) => {
    if (bet.player.toLowerCase() !== address?.toLowerCase()) return false;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeout = BigInt(3600);
    return now >= bet.timestamp + timeout;
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

        {activeBets.length === 0 && !loading ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-8 text-center">
            <GamepadIcon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No Available Games
            </h3>
            <p className="text-white/70">
              There are currently no active games to join. Check back later or
              create a game.
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
                              className={`py-1 px-4 rounded text-sm ${canCancelBet(bet) ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-600'}`}
                              disabled={loading || !canCancelBet(bet)}
                            >
                              {canCancelBet(bet) ? "Cancel" : "Waiting"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinGame(bet.betId)}
                              className="py-1 px-4 rounded bg-green-500 text-white text-sm"
                              disabled={loading}
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

              <div className="flex justify-between items-center p-4">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg"
                >
                  Previous
                </button>
                <span className="text-white">{`Page ${currentPage}`}</span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={indexOfLastGame >= activeBets.length || loading}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg"
                >
                  Next
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default GameList;