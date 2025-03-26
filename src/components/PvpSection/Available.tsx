import { useState, useEffect } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
  useWatchContractEvent,
} from "wagmi";
import { formatEther, Address } from "viem";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";

const FlipCoinFrontend = () => {
  const { address: userAddress } = useAccount();
  const [selectedBetId, setSelectedBetId] = useState<number | null>(null);
  const [allBets, setAllBets] = useState<any[]>([]);
  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [approving, setApproving] = useState<boolean>(false);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [cancelingBetId, setCancelingBetId] = useState<number | null>(null);
  const [, setCancelHash] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [joiningBetId, setJoiningBetId] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<any>(null); // Store result for popup
  const betsPerPage = 5;

  // Contract interactions
  const { data: allBetsData, refetch: refetchAllBets } = useReadContract({
    address: ADDRESS as Address,
    abi: ABI,
    functionName: "allBets",
  });

  const { writeContract: writeApprove, error: approveError } =
    useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approvalHash as `0x${string}` });

  const {
    data: joinGameHash,
    writeContract: joinGame,
    isPending: isJoining,
    error: joinError,
    reset: resetJoinGame,
  } = useWriteContract();
  const { isLoading: isJoinConfirming, isSuccess: isJoinConfirmed } =
    useWaitForTransactionReceipt({ hash: joinGameHash });

  const {
    writeContract: writeCancelBet,
    isPending: isCancelPending,
    error: cancelError,
  } = useWriteContract();

  // Event watchers
  useWatchContractEvent({
    address: ADDRESS as Address,
    abi: ABI,
    eventName: "AllBets",
    onLogs() {
      refetchAllBets();
    },
  });

  useWatchContractEvent({
    address: ADDRESS as Address,
    abi: ABI,
    eventName: "Notification",
    onLogs(logs: any[]) {
      logs.forEach((log) => {
        const {
          player1,
          player2,
          winner,
          status,
          payout,
          playerFace,
          outcome,
          betId,
        } = log.args;
        console.log("Notification event:", {
          betId: Number(betId),
          joiningBetId,
          status,
        }); // Debug event
        if (status === "Fulfilled" && Number(betId) === joiningBetId) {
          const result = {
            face: playerFace ? "Heads" : "Tails",
            result: outcome ? "Heads" : "Tails",
            winner:
              winner === userAddress
                ? "You"
                : winner.slice(0, 6) + "..." + winner.slice(-4),
            payout: formatEther(payout),
          };
          setGameResult(result);
          console.log("Game result set:", result); // Confirm result is set
        }
        const face = playerFace ? "Heads" : "Tails";
        const result = outcome ? "Heads" : "Tails";
        const message =
          status === "Fulfilled"
            ? `Game resolved! Bet: ${face}, Result: ${result}. Winner: ${
                winner === userAddress
                  ? "You"
                  : winner.slice(0, 6) + "..." + winner.slice(-4)
              }`
            : `Game status: ${status}`;
        setNotifications((prev) =>
          [
            {
              message,
              player1,
              player2,
              winner,
              payout: formatEther(payout),
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 10)
        );
      });
    },
  });

  // Effects
  useEffect(() => {
    if (allBetsData) {
      const now = Math.floor(Date.now() / 1000);
      const sortedBets = [...(allBetsData as any[])]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .filter(
          (bet) =>
            bet.status === "Pending" &&
            Number(bet.timestamp) + Number(bet.timeout) > now
        );
      setAllBets(sortedBets);
      setPendingBets(sortedBets);
    }
  }, [allBetsData]);

  useEffect(() => {
    if (isApproveConfirmed && selectedBetId) {
      const bet = allBets.find((b) => Number(b.id) === selectedBetId);
      if (bet) {
        setApproving(false);
        setTimeout(() => {
          joinGame({
            address: ADDRESS as Address,
            abi: ABI,
            functionName: "joinGame",
            args: [selectedBetId],
            value:
              bet.token === "0x0000000000000000000000000000000000000000"
                ? bet.amount
                : BigInt(0),
          });
        }, 500);
      }
    }
  }, [isApproveConfirmed, selectedBetId]);

  // Action handlers
  const handleJoinGame = async (betId: number) => {
    if (!userAddress) return alert("Please connect your wallet!");
    const bet = allBets.find((b) => Number(b.id) === betId);
    if (!bet) return alert("Bet not found!");
    setSelectedBetId(betId);
    setGameResult(null); // Reset result for new join

    if (bet.token !== "0x0000000000000000000000000000000000000000") {
      setApproving(true);
      const approvalSuccess = await new Promise<boolean>((resolve) => {
        writeApprove(
          {
            address: bet.token as Address,
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
            args: [ADDRESS, bet.amount],
          },
          {
            onSuccess: (hash) => {
              setApprovalHash(hash);
              const interval = setInterval(() => {
                if (isApproveConfirmed) {
                  clearInterval(interval);
                  resolve(true);
                }
                if (approveError) {
                  clearInterval(interval);
                  resolve(false);
                }
              }, 500);
            },
            onError: () => resolve(false),
          }
        );
      });
      if (!approvalSuccess) {
        alert("Token approval failed");
        setApproving(false);
        setApprovalHash(null);
        setSelectedBetId(null);
        return;
      }
    }

    setApproving(false);
    setJoiningBetId(betId);
    joinGame({
      address: ADDRESS as Address,
      abi: ABI,
      functionName: "joinGame",
      args: [betId],
      value:
        bet.token === "0x0000000000000000000000000000000000000000"
          ? bet.amount
          : BigInt(0),
    });
  };

  const handleCancelBet = async (betId: number) => {
    if (!userAddress) return alert("Please connect your wallet!");
    setCancelingBetId(betId);
    writeCancelBet(
      {
        address: ADDRESS as Address,
        abi: ABI,
        functionName: "cancelBet",
        args: [betId],
      },
      { onSuccess: setCancelHash, onError: () => setCancelingBetId(null) }
    );
  };

  const dismissNotification = (index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  // Components
  const TransactionPopup = () => {
    const isProcessing =
      approving ||
      isApproveConfirming ||
      isJoining ||
      isJoinConfirming ||
      (joiningBetId && !gameResult);
    const hasResult = gameResult;
    const hasError = approveError || joinError;

    console.log({
      isProcessing,
      hasResult,
      hasError,
      approving,
      isApproveConfirming,
      isJoining,
      isJoinConfirming,
      joiningBetId,
      gameResult,
    });

    if (!isProcessing && !hasResult && !hasError) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-4 rounded-lg max-w-xs w-full text-center">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
              <h3 className="text-base font-medium text-gray-900 mb-1">
                {approving || isApproveConfirming
                  ? "Approving"
                  : "Joining Game"}
              </h3>
              <p className="text-xs text-gray-500">Please wait...</p>
            </>
          ) : hasResult ? (
            <>
              <h3 className="text-base font-medium text-gray-900 mb-2">
                Game Resolved
              </h3>
              <p className="text-xs text-black">
                Bet: {gameResult.face}, Result: {gameResult.result}
              </p>
              <p className="text-xs text-black mt-1">
                Winner: {gameResult.winner}
              </p>
              <p className="text-xs text-black mt-1">
                Payout: {parseFloat(gameResult.payout).toFixed(4)} ETH
              </p>
              {approvalHash && isApproveConfirmed && (
                <p className="text-xs text-black mt-2">
                  Approval: {approvalHash.slice(0, 6)}...
                  {approvalHash.slice(-4)}
                </p>
              )}
              {joinGameHash && isJoinConfirmed && (
                <p className="text-xs text-black mt-1">
                  Join: {joinGameHash.slice(0, 6)}...{joinGameHash.slice(-4)}
                </p>
              )}
              <button
                onClick={() => {
                  setApprovalHash(null);
                  resetJoinGame();
                  setSelectedBetId(null);
                  setJoiningBetId(null);
                  setGameResult(null);
                }}
                className="mt-3 bg-blue-500 text-white px-3 py-1 rounded text-xs"
              >
                Close
              </button>
            </>
          ) : hasError ? (
            <>
              <h3 className="text-base font-medium text-red-900 mb-2">
                Transaction Failed
              </h3>
              <p className="text-xs text-red-500 break-words">
                Error: {(approveError || joinError)?.message.slice(0, 50)}...
              </p>
              <button
                onClick={() => {
                  setApprovalHash(null);
                  resetJoinGame();
                  setSelectedBetId(null);
                  setJoiningBetId(null);
                  setGameResult(null);
                }}
                className="mt-3 bg-red-500 text-white px-3 py-1 rounded text-xs"
              >
                Close
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  const Notification = ({ message, timestamp, payout, index }: any) => (
    <div className="bg-white p-4 mb-2 rounded-lg shadow-lg border-l-4 border-green-500 animate-fadeIn relative">
      <p className="font-bold mb-1 text-black">{message}</p>
      <p className="text-xs text-gray-600">
        {new Date(timestamp).toLocaleTimeString()}
      </p>
      {payout && (
        <p className="mt-1 text-sm text-black">
          Payout: {parseFloat(payout).toFixed(4)} ETH
        </p>
      )}
      <button
        onClick={() => dismissNotification(index)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xs"
      >
        ✕
      </button>
    </div>
  );

  // Helper functions
  const getTokenSymbol = (address: string) =>
    SUPPORTED_TOKENS.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    )?.symbol || address.slice(0, 6) + "..." + address.slice(-4);

  const formatTimeout = (timeout: bigint) => {
    const seconds = Number(timeout);
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  const getRemainingTime = (timestamp: bigint, timeout: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const endTime = Number(timestamp) + Number(timeout);
    const remaining = endTime - now;
    return remaining > 0 ? formatTimeout(BigInt(remaining)) : "Expired";
  };

  // Pagination
  const indexOfLastBet = currentPage * betsPerPage;
  const indexOfFirstBet = indexOfLastBet - betsPerPage;
  const currentBets = pendingBets.slice(indexOfFirstBet, indexOfLastBet);
  const totalPages = Math.ceil(pendingBets.length / betsPerPage);

  return (
    <div className="p-2 sm:p-4 w-full max-w-[614px] mx-auto bg-gray-50">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <TransactionPopup />

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-2 right-2 sm:top-5 sm:right-5 z-50 w-[90%] sm:w-[320px]">
          {notifications.map((n, i) => (
            <Notification key={i} {...n} index={i} />
          ))}
        </div>
      )}

      {/* Pending Bets Table */}
      <section className="mt-2">
        {pendingBets.length === 0 ? (
          <p className="text-black text-center">No pending bets available.</p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200 text-black text-xs sm:text-sm">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="p-2 whitespace-nowrap">ID</th>
                      <th className="p-2 whitespace-nowrap">Player</th>
                      <th className="p-2 whitespace-nowrap">Amount</th>
                      <th className="p-2 whitespace-nowrap">Token</th>
                      <th className="p-2 whitespace-nowrap">Face</th>
                      <th className="hidden sm:table-cell p-2 whitespace-nowrap">
                        Time Left
                      </th>
                      <th className="p-2 whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {currentBets.map((bet) => {
                      const isExpired =
                        getRemainingTime(bet.timestamp, bet.timeout) ===
                        "Expired";
                      const isCreator = bet.player1 === userAddress;
                      const isCanceling =
                        cancelingBetId === Number(bet.id) && isCancelPending;
                      const isProcessing =
                        (approving || isJoining) &&
                        selectedBetId === Number(bet.id);

                      return (
                        <tr key={Number(bet.id)}>
                          <td className="p-2 text-center">{Number(bet.id)}</td>
                          <td className="p-2 text-center">
                            {bet.player1.slice(0, 4)}...{bet.player1.slice(-2)}
                          </td>
                          <td className="p-2 text-center">
                            {parseFloat(formatEther(bet.amount)).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            {getTokenSymbol(bet.token)}
                          </td>
                          <td className="p-2 text-center">
                            {bet.player1Face ? "H" : "T"}
                          </td>
                          <td className="hidden sm:table-cell p-2 text-center">
                            {getRemainingTime(bet.timestamp, bet.timeout)}
                          </td>
                          <td className="p-2 text-center">
                            {isExpired ? (
                              isCreator ? (
                                <button
                                  onClick={() =>
                                    handleCancelBet(Number(bet.id))
                                  }
                                  disabled={isCanceling}
                                  className="bg-red-500 text-white px-2 py-1 rounded text-xs w-full max-w-[100px]"
                                >
                                  {isCanceling ? "..." : "Cancel"}
                                </button>
                              ) : (
                                <span className="text-gray-500 text-xs">
                                  Expired
                                </span>
                              )
                            ) : (
                              <button
                                onClick={() => handleJoinGame(Number(bet.id))}
                                disabled={
                                  isProcessing || bet.player1 === userAddress
                                }
                                className="bg-blue-500 text-white px-2 py-1 rounded text-xs w-full max-w-[100px]"
                              >
                                {isProcessing ? "..." : "Join"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center items-center gap-3 text-sm">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="bg-gray-500 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  ←
                </button>
                <span className="text-black">
                  {currentPage}/{totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="bg-gray-500 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Error Messages (Cancel Only) */}
      {cancelError && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg">
          <p className="text-red-500 text-xs sm:text-sm break-words">
            Cancel Error: {cancelError.message.slice(0, 50)}...
          </p>
        </div>
      )}
    </div>
  );
};

export default FlipCoinFrontend;
