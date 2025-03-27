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

const BETS_PER_PAGE = 10;

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
  const [joiningBetId, setJoiningBetId] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [isFlipping, setIsFlipping] = useState(false);

  // Updated interface to match the event args
  interface NotificationEvent {
    betId: bigint;
    player1: Address;
    player2: Address;
    playerFace: boolean;
    outcome: boolean;
    winner: Address;
    status: string;
    payout: bigint;
    token: Address;
  }

  const [currentNotification, setCurrentNotification] = useState<NotificationEvent | null>(null);

  // Contract interactions
  const { data: allBetsData, refetch: refetchAllBets } = useReadContract({
    address: ADDRESS as Address,
    abi: ABI,
    functionName: "allBets",
  });

  const { writeContract: writeApprove, error: approveError } = useWriteContract();
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
    onLogs(logs) {
      refetchAllBets();
    },
  });

  useWatchContractEvent({
    address: ADDRESS as Address,
    abi: ABI,
    eventName: "Notification",
    onLogs: (logs) => {
      logs.forEach((log) => {
        try {
          const args = log.args as unknown as NotificationEvent;
          console.log("Notification event received:", args);

          // Only process fulfilled bets
          if (!args || args.status !== "Fulfilled") return;

          // Convert betId to number
          const eventBetId = Number(args.betId);
          console.log("Processing bet:", eventBetId, "Current selectedBetId:", selectedBetId);

          // Check if this is the bet we're waiting for
          if (eventBetId === selectedBetId) {
            setCurrentNotification(args);
            setIsFlipping(false);
            setJoiningBetId(null);
            console.log("Bet result processed successfully");
          }
        } catch (error) {
          console.error("Error processing notification:", error);
        }
      });
    },
  });

  // Debug useEffect
  useEffect(() => {
    console.log("Current state:", {
      currentNotification,
      joiningBetId,
      isFlipping,
      joinGameHash
    });
  }, [currentNotification, joiningBetId, isFlipping, joinGameHash]);

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

  const handleJoinGame = async (betId: number) => {
    if (!userAddress) {
      alert("Please connect your wallet!");
      return;
    }

    const bet = allBets.find((b) => Number(b.id) === betId);
    if (!bet) {
      alert("Bet not found!");
      return;
    }

    setSelectedBetId(betId);
    setCurrentNotification(null);
    setIsFlipping(true);

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
        setIsFlipping(false);
        return;
      }
    }

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

  const NotificationPopup = () => {
    if (!currentNotification) return null;
  
    const isWinner = currentNotification.winner.toLowerCase() === userAddress?.toLowerCase();
    const token = SUPPORTED_TOKENS.find(
      t => t.address.toLowerCase() === currentNotification.token.toLowerCase()
    ) || { 
      symbol: currentNotification.token.slice(0, 6) + "..." + currentNotification.token.slice(-4), 
      decimals: 18 
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
      const result = isWinner ? "won" : "lost";
      const url =
        platform === "warpcast"
          ? "flip-it-clanker.vercel.app/"
          : window.location.href;
      const basescanUrl = joinGameHash
        ? `https://basescan.org/tx/${joinGameHash}`
        : "";
      return `I just ${result} ${formatEther(currentNotification.payout)} ${token.symbol} flipping ${currentNotification.playerFace ? "Heads" : "Tails"} (Result: ${currentNotification.outcome ? "Heads" : "Tails"})! ${
        basescanUrl ? `(Tx: ${basescanUrl}) ` : ""
      }Try your luck at ${url}`;
    };
  
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          {/* Result Card */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200 shadow-md mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-purple-800">
                {isWinner ? "🎉 Victory!" : "🎲 Try Again!"}
              </h2>
              <p className="text-sm text-gray-500">
                Bet ID: {Number(currentNotification.betId)}
              </p>
              <span
                className={`px-2 py-1 rounded-full text-sm font-medium ${
                  isWinner
                    ? "bg-green-200 text-green-800"
                    : "bg-red-200 text-red-800"
                }`}
              >
                {isWinner ? "Won" : "Lost"}
              </span>
            </div>
  
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-purple-600">Player1 Choice</p>
                <p className="text-lg font-semibold text-purple-900">
                  {currentNotification.playerFace ? "Heads" : "Tails"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-purple-600">Outcome</p>
                <p className="text-lg font-semibold text-purple-900">
                  {currentNotification.outcome ? "Heads" : "Tails"}
                </p>
              </div>
            </div>
  
            <div className="bg-purple-200/50 p-3 rounded-md">
              <p className="text-sm text-purple-700">
                {formatEther(currentNotification.payout)} {token.symbol}
              </p>
              {joinGameHash && (
                <p className="text-xs text-purple-600 mt-1 truncate">
                  Tx:{" "}
                  <a
                    href={`https://basescan.org/tx/${joinGameHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-purple-800"
                    title={joinGameHash}
                  >
                    {joinGameHash.slice(0, 6)}...
                    {joinGameHash.slice(-4)}
                  </a>
                </p>
              )}
            </div>
          </div>
  
          {/* Share Section */}
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
            onClick={() => {
              setCurrentNotification(null);
              setShareStatus("");
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded text-sm"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  // Pagination
  const indexOfLastBet = currentPage * BETS_PER_PAGE;
  const indexOfFirstBet = indexOfLastBet - BETS_PER_PAGE;
  const currentBets = pendingBets.slice(indexOfFirstBet, indexOfLastBet);
  const totalPages = Math.ceil(pendingBets.length / BETS_PER_PAGE);

  return (
    <div className="p-2 sm:p-4 w-full max-w-[614px] mx-auto bg-gray-50">
      {/* Loading spinner */}
      {isFlipping && !currentNotification && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[9998]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      <NotificationPopup />

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

      {/* Error Messages */}
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