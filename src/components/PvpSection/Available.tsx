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
  const [cancelHash, setCancelHash] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [joiningBetId, setJoiningBetId] = useState<number | null>(null);
  const [joinComplete, setJoinComplete] = useState<boolean>(false);
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
    useWaitForTransactionReceipt({
      hash: approvalHash as `0x${string}`,
    });

  const {
    data: joinGameHash,
    writeContract: joinGame,
    isPending: isJoining,
    error: joinError,
  } = useWriteContract();

  const { isLoading: isJoinConfirming, isSuccess: isJoinConfirmed } =
    useWaitForTransactionReceipt({
      hash: joinGameHash,
    });

  const {
    writeContract: writeCancelBet,
    isPending: isCancelPending,
    error: cancelError,
  } = useWriteContract();

  const { isLoading: isCancelConfirming, isSuccess: isCancelConfirmed } =
    useWaitForTransactionReceipt({
      hash: cancelHash as `0x${string}`,
    });

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

        if (status === "Fulfilled" && Number(betId) === joiningBetId) {
          setJoinComplete(true);
          setJoiningBetId(null);
        }

        const face = playerFace ? "Heads" : "Tails";
        const result = outcome ? "Heads" : "Tails";
        const message =
          status === "Fulfilled"
            ? `Game resolved! Bet was ${face}, result was ${result}. Winner: ${
                winner === userAddress
                  ? "You"
                  : winner.slice(0, 6) + "..." + winner.slice(-4)
              }`
            : `Game status updated: ${status}`;

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
        .filter((bet) => {
          if (bet.status !== "Pending") return false;
          const endTime = Number(bet.timestamp) + Number(bet.timeout);
          return endTime > now;
        });
      setAllBets(sortedBets);
      setPendingBets(sortedBets);
    }
  }, [allBetsData]);

  useEffect(() => {
    if (isApproveConfirmed && selectedBetId) {
      const bet = allBets.find((b) => Number(b.id) === selectedBetId);
      if (bet) {
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

  // Helper functions
  const getTokenSymbol = (address: string) => {
    const token = SUPPORTED_TOKENS.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );
    return token?.symbol || address.slice(0, 6) + "..." + address.slice(-4);
  };

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

  // Action handlers
  const handleJoinGame = async (betId: number) => {
    if (!userAddress) return alert("Please connect your wallet!");

    const bet = allBets.find((b) => Number(b.id) === betId);
    if (!bet) return alert("Bet not found!");

    setSelectedBetId(betId);

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
        return setApproving(false);
      }
    }

    setApproving(false);
    setJoiningBetId(betId);
    setJoinComplete(false);
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
      {
        onSuccess: setCancelHash,
        onError: () => setCancelingBetId(null),
      }
    );
  };

  // Components
  const LoadingModal = () =>
    joiningBetId && !joinComplete ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Processing Game
            </h3>
            <p className="text-sm text-gray-500">
              Waiting for game resolution...
            </p>
            <p className="text-xs text-gray-400 mt-2">Bet ID: {joiningBetId}</p>
          </div>
        </div>
      </div>
    ) : null;

  const Notification = ({ message, timestamp, payout }: any) => (
    <div className="bg-white p-4 mb-2 rounded-lg shadow-lg border-l-4 border-green-500 animate-fadeIn">
      <p className="font-bold mb-1 text-black">{message}</p>
      <p className="text-xs text-gray-600">
        {new Date(timestamp).toLocaleTimeString()}
      </p>
      {payout && (
        <p className="mt-1 text-sm text-black">
          Payout: {parseFloat(payout).toFixed(4)} ETH
        </p>
      )}
    </div>
  );

  // Pagination
  const indexOfLastBet = currentPage * betsPerPage;
  const indexOfFirstBet = indexOfLastBet - betsPerPage;
  const currentBets = pendingBets.slice(indexOfFirstBet, indexOfLastBet);
  const totalPages = Math.ceil(pendingBets.length / betsPerPage);

  return (
    <div className="p-4 w-full max-w-[614px] mx-auto bg-gray-50">
      <LoadingModal />

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-5 right-5 z-50 max-w-xs">
          {notifications.map((n, i) => (
            <Notification key={i} {...n} />
          ))}
        </div>
      )}

      <h1 className="text-black text-2xl font-bold mb-4 text-center">
        Flip Coin PvP
      </h1>

      {/* Pending Bets Table */}
      <section>
        <h2 className="text-black text-xl font-semibold mb-3 text-center">
          Pending Bets
        </h2>
        {pendingBets.length === 0 ? (
          <p className="text-black text-center">No pending bets available.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-black text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-2">Bet ID</th>
                    <th className="p-2">Player 1</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Token</th>
                    <th className="p-2">Face</th>
                    {/* <th className="p-2">Timeout</th> */}
                    <th className="p-2">Time Left</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
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
                      <tr key={Number(bet.id)} className="border-b">
                        <td className="p-2 text-center">{Number(bet.id)}</td>
                        <td className="p-2 text-center">
                          {bet.player1.slice(0, 2)}...{bet.player1.slice(-4)}
                        </td>
                        <td className="p-2 text-center">
                          {parseFloat(formatEther(bet.amount)).toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          {getTokenSymbol(bet.token)}
                        </td>
                        <td className="p-2 text-center">
                          {bet.player1Face ? "Heads" : "Tails"}
                        </td>
                        {/* <td className="p-2 text-center">
                          {formatTimeout(bet.timeout)}
                        </td> */}
                        <td className="p-2 text-center">
                          {getRemainingTime(bet.timestamp, bet.timeout)}
                        </td>
                        <td className="p-2 text-center">
                          {isExpired ? (
                            isCreator ? (
                              <button
                                onClick={() => handleCancelBet(Number(bet.id))}
                                disabled={isCanceling}
                                className="bg-red-500 text-white px-2 py-1 rounded-md text-xs w-full"
                              >
                                {isCanceling ? "Canceling..." : "Cancel"}
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
                              className="bg-blue-500 text-white px-2 py-1 rounded-md text-xs w-full"
                            >
                              {isProcessing
                                ? approving
                                  ? "Approving..."
                                  : "Joining..."
                                : "Join"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-black">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="bg-gray-500 text-white px-3 py-1 rounded-md text-sm"
                >
                  Prev
                </button>
                <span className="text-sm py-1">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="bg-gray-500 text-white px-3 py-1 rounded-md text-sm"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Transaction Status */}
      {(approvalHash || joinGameHash || cancelHash) && (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
          {approvalHash && (
            <>
              <p className="text-black break-words">
                Approval Tx: {approvalHash.slice(0, 6)}...
                {approvalHash.slice(-4)}
              </p>
              {isApproveConfirming && (
                <p className="text-black">Approving...</p>
              )}
              {isApproveConfirmed && <p className="text-black">Approved!</p>}
            </>
          )}
          {joinGameHash && (
            <>
              <p className="text-black break-words">
                Join Tx: {joinGameHash.slice(0, 6)}...{joinGameHash.slice(-4)}
              </p>
              {isJoinConfirming && <p className="text-black">Joining...</p>}
              {isJoinConfirmed && <p className="text-black">Joined!</p>}
            </>
          )}
          {cancelHash && (
            <>
              <p className="text-black break-words">
                Cancel Tx: {cancelHash.slice(0, 6)}...{cancelHash.slice(-4)}
              </p>
              {isCancelConfirming && <p className="text-black">Canceling...</p>}
              {isCancelConfirmed && <p className="text-black">Canceled!</p>}
            </>
          )}
        </div>
      )}

      {/* Error Messages */}
      {(approveError || joinError || cancelError) && (
        <p className="text-red-500 text-sm mt-2 break-words">
          Error:{" "}
          {(approveError || joinError || cancelError)?.message.slice(0, 50)}...
        </p>
      )}
    </div>
  );
};

export default FlipCoinFrontend;
