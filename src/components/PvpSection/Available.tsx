import  { useState, useEffect } from "react";
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
  const [notifications, setNotifications] = useState<{
    message: string;
    player1: string;
    player2: string;
    winner: string;
    payout: string;
    timestamp: number;
  }[]>([]);
  const betsPerPage = 5;

  // --- allBets Read Function ---
  const { data: allBetsData, refetch: refetchAllBets } = useReadContract({
    address: ADDRESS as Address,
    abi: ABI,
    functionName: "allBets",
  });

  // --- Token Approval Write Function ---
  const {
    writeContract: writeApprove,
    isPending: isApproving,
    error: approveError,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({
      hash: approvalHash as `0x${string}`,
    });

  // --- Join Game Write Function ---
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

  // --- Cancel Bet Write Function ---
  const {
    data: cancelBetHash,
    writeContract: writeCancelBet,
    isPending: isCancelPending,
    error: cancelError,
  } = useWriteContract();

  const { isLoading: isCancelConfirming, isSuccess: isCancelConfirmed } =
    useWaitForTransactionReceipt({
      hash: cancelHash as `0x${string}`,
    });

  // --- Watch Contract Events ---
  useWatchContractEvent({
    address: ADDRESS as Address,
    abi: ABI,
    eventName: "AllBets",
    onLogs(logs) {
      console.log("New bet event:", logs);
      refetchAllBets();
    },
  });

  useWatchContractEvent({
    address: ADDRESS as Address,
    abi: ABI,
    eventName: "Notification",
    onLogs(logs) {
      logs.forEach((log) => {
        const { player1, player2, winner, status, payout, playerFace, outcome } = log.args;
        const face = playerFace ? "Heads" : "Tails";
        const result = outcome ? "Heads" : "Tails";
        
        let message = "";
        if (status === "Fulfilled") {
          message = `Game resolved! Bet was ${face}, result was ${result}. Winner: ${winner === userAddress ? "You" : winner.slice(0, 6) + "..." + winner.slice(-4)}`;
        } else {
          message = `Game status updated: ${status}`;
        }

        setNotifications((prev) => [
          {
            message,
            player1,
            player2,
            winner,
            payout: formatEther(payout),
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 10)); // Keep only last 10 notifications
      });
    },
  });

  // Update bets state when allBetsData changes
  useEffect(() => {
    if (allBetsData) {
      const sortedBets = [...(allBetsData as any[])].sort((a, b) => Number(b.id) - Number(a.id));
      setAllBets(sortedBets);
      const pending = sortedBets.filter((bet) => bet.status === "Pending");
      setPendingBets(pending);
    }
  }, [allBetsData]);

  // Reset approval state when bet changes
  useEffect(() => {
    setApproving(false);
    setApprovalHash(null);
  }, [selectedBetId]);

  // Get current bets for pagination
  const indexOfLastBet = currentPage * betsPerPage;
  const indexOfFirstBet = indexOfLastBet - betsPerPage;
  const currentBets = pendingBets.slice(indexOfFirstBet, indexOfLastBet);
  const totalPages = Math.ceil(pendingBets.length / betsPerPage);

  // Get token symbol from address
  const getTokenSymbol = (address: string) => {
    const token = SUPPORTED_TOKENS.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );
    return token ? token.symbol : address.slice(0, 6) + "..." + address.slice(-4);
  };

  // Format timeout to human readable format
  const formatTimeout = (timeout: bigint) => {
    const seconds = Number(timeout);
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  // Calculate remaining time
  const getRemainingTime = (timestamp: bigint, timeout: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const endTime = Number(timestamp) + Number(timeout);
    const remaining = endTime - now;
    return remaining > 0 ? formatTimeout(BigInt(remaining)) : "Expired";
  };

  // Handle joining a game (approve and join in one click)
  const handleJoinGame = async (betId: number) => {
    if (!userAddress) {
      alert("Please connect your wallet!");
      return;
    }

    try {
      const bet = allBets.find((b) => Number(b.id) === betId);
      if (!bet) {
        alert("Bet not found!");
        return;
      }

      setSelectedBetId(Number(bet.id));

      // If not native token, approve first
      if (bet.token !== "0x0000000000000000000000000000000000000000") {
        console.log("Approving token:", bet.token, "Amount:", bet.amount.toString());
        const approvalSuccess = await new Promise<boolean>((resolve) => {
          setApproving(true);
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
                console.log("Approval transaction submitted. Hash:", hash);
                setApprovalHash(hash);
                const checkConfirmation = setInterval(() => {
                  if (isApproveConfirmed) {
                    clearInterval(checkConfirmation);
                    setApproving(false);
                    console.log("Approval confirmed!");
                    resolve(true);
                  } else if (approveError) {
                    clearInterval(checkConfirmation);
                    setApproving(false);
                    console.error("Approval failed with error:", approveError);
                    resolve(false);
                  }
                }, 1000); // Check every second
              },
              onError: (error) => {
                console.error("Detailed approval error:", error);
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
                setApproving(false);
                resolve(false);
              },
            }
          );
        });

        if (!approvalSuccess) {
          alert("Token approval failed. Check the console for details.");
          return;
        }
      } else {
        console.log("Native token bet, no approval needed.");
      }

      // Proceed to join the game
      console.log("Joining game with bet ID:", betId);
      joinGame({
        address: ADDRESS as Address,
        abi: ABI,
        functionName: "joinGame",
        args: [betId],
        value: bet.token === "0x0000000000000000000000000000000000000000" ? bet.amount : BigInt(0),
      });
    } catch (error) {
      console.error("Unexpected error in handleJoinGame:", error);
      alert("An unexpected error occurred. Check the console for details.");
    }
  };

  // Handle canceling a bet
  const handleCancelBet = async (betId: number) => {
    if (!userAddress) {
      alert("Please connect your wallet!");
      return;
    }

    try {
      setCancelingBetId(betId);
      writeCancelBet(
        {
          address: ADDRESS as Address,
          abi: ABI,
          functionName: "cancelBet",
          args: [betId],
        },
        {
          onSuccess: (hash) => {
            setCancelHash(hash);
          },
          onError: (error) => {
            console.error("Cancel error:", error);
            setCancelingBetId(null);
          },
        }
      );
    } catch (error) {
      console.error("Error canceling bet:", error);
      setCancelingBetId(null);
    }
  };

  // Render Notifications
  const renderNotifications = () => {
    if (!notifications.length) return null;

    return (
      <div className="fixed top-5 right-5 z-50 max-w-xs">
        {notifications.map((notification, index) => (
          <div
            key={index}
            className="bg-white p-4 mb-2 rounded-lg shadow-lg border-l-4 border-green-500 animate-fadeIn"
          >
            <p className="font-bold mb-1 text-black">{notification.message}</p>
            <p className="text-xs text-gray-600">{new Date(notification.timestamp).toLocaleTimeString()}</p>
            {notification.winner && notification.payout && (
              <p className="mt-1 text-sm text-black">
                Payout: {parseFloat(notification.payout).toFixed(4)} ETH
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render Bets Table
  const renderBets = () => {
    if (!pendingBets.length) return <p className="text-black">No pending bets available.</p>;

    return (
      <>
        <table className="w-full table-auto border-collapse text-black">
          <thead>
            <tr>
              <th className="p-2">Bet ID</th>
              <th className="p-2">Player 1</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Token</th>
              <th className="p-2">Face</th>
              <th className="p-2">Timeout</th>
              <th className="p-2">Time Left</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentBets.map((bet) => {
              const isExpired = getRemainingTime(bet.timestamp, bet.timeout) === "Expired";
              const isCreator = bet.player1 === userAddress;
              const isCancelingThisBet = cancelingBetId === Number(bet.id) && isCancelPending;
              const isProcessing =
                (approving || isApproving || isJoining || isJoinConfirming) &&
                selectedBetId === Number(bet.id);

              const formattedAmount = parseFloat(formatEther(bet.amount)).toFixed(2);

              return (
                <tr key={Number(bet.id)}>
                  <td className="p-2">{Number(bet.id)}</td>
                  <td className="p-2">
                    {bet.player1.slice(0, 6)}...{bet.player1.slice(-4)}
                  </td>
                  <td className="p-2">{formattedAmount}</td>
                  <td className="p-2">{getTokenSymbol(bet.token)}</td>
                  <td className="p-2">{bet.player1Face ? "Heads" : "Tails"}</td>
                  <td className="p-2">{formatTimeout(bet.timeout)}</td>
                  <td className="p-2">{getRemainingTime(bet.timestamp, bet.timeout)}</td>
                  <td className="p-2">
                    {isExpired ? (
                      isCreator ? (
                        <button
                          onClick={() => handleCancelBet(Number(bet.id))}
                          disabled={isCancelingThisBet}
                          className="bg-red-500 text-white p-2 rounded-md"
                        >
                          {isCancelingThisBet ? "Canceling..." : "Cancel Bet"}
                        </button>
                      ) : (
                        <span className="text-gray-500">Expired</span>
                      )
                    ) : (
                      <button
                        onClick={() => handleJoinGame(Number(bet.id))}
                        disabled={isProcessing || bet.player1 === userAddress}
                        className="bg-blue-500 text-white p-2 rounded-md"
                      >
                        {isProcessing
                          ? approving || isApproving
                            ? "Approving..."
                            : "Joining..."
                          : "Join Game"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="bg-gray-500 text-white p-2 rounded-md"
            >
              Previous
            </button>
            <span className="text-black">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="bg-gray-500 text-white p-2 rounded-md"
            >
              Next
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {renderNotifications()}
      <h1 className="text-black text-3xl font-bold mb-5">Flip Coin PvP</h1>

      <section>
        <h2 className="text-black text-2xl font-semibold mb-3">Pending Bets</h2>
        {renderBets()}
      </section>

      {approvalHash && (
        <div className="mt-5 p-4 bg-gray-100">
          <p className="text-black">Approval Transaction Hash: {approvalHash}</p>
          {isApproveConfirming && <p className="text-black">Waiting for approval confirmation...</p>}
          {isApproveConfirmed && <p className="text-black">Token approved successfully!</p>}
        </div>
      )}
      {approveError && <p className="text-red-500">Approval Error: {approveError.message}</p>}

      {joinGameHash && (
        <div className="mt-5 p-4 bg-gray-100">
          <p className="text-black">Join Game Transaction Hash: {joinGameHash}</p>
          {isJoinConfirming && <p className="text-black">Waiting for confirmation...</p>}
          {isJoinConfirmed && <p className="text-black">Game joined successfully!</p>}
        </div>
      )}
      {joinError && <p className="text-red-500">Error: {joinError.message}</p>}

      {cancelHash && (
        <div className="mt-5 p-4 bg-gray-100">
          <p className="text-black">Cancel Transaction Hash: {cancelHash}</p>
          {isCancelConfirming && <p className="text-black">Waiting for cancel confirmation...</p>}
          {isCancelConfirmed && <p className="text-black">Bet canceled successfully!</p>}
        </div>
      )}
      {cancelError && <p className="text-red-500">Cancel Error: {cancelError.message}</p>}
    </div>
  );
};

export default FlipCoinFrontend;
