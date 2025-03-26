import { useState, useEffect } from "react";
import { useReadContract, useAccount, useWatchContractEvent } from "wagmi";
import { formatEther } from "viem";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";

const Leaderb = () => {
  const { address } = useAccount();
  
  interface Bet {
    id: string;
    betId: string;
    player1: string;
    player2: string;
    token: string;
    amount: string;
    player1Face: string;
    outcome: string;
    winner: string;
    status: string;
    timestamp: string;
    timeout: string;
    fulfilled: boolean;
    payout: string;
    remainingTime?: string;
  }

  const [bets, setBets] = useState<Bet[]>([]);
  const [sortedBets, setSortedBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const betsPerPage = 7;

  // Format timeout to human readable format
  const formatTimeout = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  // Calculate remaining time
  const getRemainingTime = (timestamp: number, timeout: number) => {
    const now = Math.floor(Date.now() / 1000);
    const endTime = timestamp + timeout;
    const remaining = endTime - now;
    return remaining > 0 ? formatTimeout(remaining) : "Expired";
  };

  // Read all bets from contract
  const { data: allBetsData, refetch } = useReadContract({
    address: ADDRESS,
    abi: ABI,
    functionName: "allBets",
  }) as { data: any[]; refetch: () => void };

  // Watch for new bet events
  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "AllBets",
    onLogs: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (allBetsData) {
      try {
        const formattedBets = allBetsData.map((bet) => {
          const timestamp = Number(bet.timestamp);
          const timeout = Number(bet.timeout);
          const isExpired = getRemainingTime(timestamp, timeout) === "Expired";
          
          return {
            id: bet.id.toString(),
            betId: bet.betId.toString(),
            player1: bet.player1,
            player2: bet.player2,
            token: bet.token,
            amount: formatEther(bet.amount),
            player1Face: bet.player1Face ? "Heads" : "Tails",
            outcome: bet.outcome ? "Heads" : "Tails",
            winner: bet.winner,
            status: isExpired && bet.status.toLowerCase() === "pending" 
              ? "Expired" 
              : bet.status,
            timestamp: timestamp.toString(),
            timeout: timeout.toString(),
            fulfilled: bet.fulfilled,
            payout: bet.payout ? formatEther(bet.payout) : "0",
            remainingTime: getRemainingTime(timestamp, timeout)
          };
        });
        
        // Sort bets by betId in descending order (newest first)
        const sorted = [...formattedBets].sort((a, b) => 
          parseInt(b.betId) - parseInt(a.betId)
        );
        
        setBets(sorted);
        setLoading(false);
      } catch (err) {
        setError("Error formatting bet data");
        setLoading(false);
      }
    }
  }, [allBetsData]);

  // Update sorted bets when pagination changes
  useEffect(() => {
    const indexOfLastBet = currentPage * betsPerPage;
    const indexOfFirstBet = indexOfLastBet - betsPerPage;
    setSortedBets(bets.slice(indexOfFirstBet, indexOfLastBet));
  }, [bets, currentPage]);

  // Optimized remaining time update effect
  useEffect(() => {
    const updateRemainingTimes = () => {
      setBets(prevBets => {
        // Only update if there are pending/active bets
        const hasPendingBets = prevBets.some(bet => 
          bet.status.toLowerCase() === 'pending' || bet.status.toLowerCase() === 'active'
        );
        
        if (!hasPendingBets) return prevBets;
  
        return prevBets.map(bet => {
          // Only update for pending/active bets
          if (bet.status.toLowerCase() === 'pending' || bet.status.toLowerCase() === 'active') {
            const timestamp = Number(bet.timestamp);
            const timeout = Number(bet.timeout);
            const remainingTime = getRemainingTime(timestamp, timeout);
            const isExpired = remainingTime === "Expired";
            
            return {
              ...bet,
              remainingTime: remainingTime,
              // Update status if expired
              status: isExpired && bet.status.toLowerCase() === "pending" 
                ? "Expired" 
                : bet.status
            };
          }
          return bet;
        });
      });
    };
  
    // Initial update
    updateRemainingTimes();
    
    // Set up interval
    const interval = setInterval(updateRemainingTimes, 1000);
    return () => clearInterval(interval);
  }, []); // Empty dependency array
  // Pagination functions
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => {
    if (currentPage < Math.ceil(bets.length / betsPerPage)) {
      setCurrentPage(currentPage + 1);
    }
  };
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getTokenSymbol = (tokenAddress: string) => {
    return (
      SUPPORTED_TOKENS.find(
        (token) => token.address.toLowerCase() === tokenAddress.toLowerCase()
      )?.symbol || "Unknown"
    );
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "active":
        return "bg-blue-100 text-blue-800";
      case "fulfilled":
        return "bg-green-100 text-green-800";
      case "canceled":
      case "expired":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "N/A";
    return addr === address ? "You" : `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const renderWinner = (bet: Bet) => {
    if (!bet.fulfilled) return "Pending";

    if (bet.winner) {
      return (
        <div className="flex items-center">
          <span
            className={`font-medium ${
              bet.winner === address ? "text-green-600" : "text-gray-700"
            }`}
          >
            {formatAddress(bet.winner)}
          </span>
          {bet.payout && bet.payout !== "0" && (
            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              Won {bet.payout} {getTokenSymbol(bet.token)}
            </span>
          )}
        </div>
      );
    }
    return "Draw/Refund";
  };

  const renderStatus = (status: string, remainingTime: string) => {
    const isActuallyExpired = remainingTime === "Expired" && status.toLowerCase() === "pending";
    const displayStatus = isActuallyExpired ? "Expired" : status;
      
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
          displayStatus
        )}`}
      >
        {displayStatus}
      </span>
    );
  };

  const getTimeColor = (remainingTime: string) => {
    if (remainingTime === "Expired") return "text-red-600";
    
    // Extract the largest time unit
    if (remainingTime.includes("days")) return "text-green-600";
    if (remainingTime.includes("hours")) {
      const hours = parseInt(remainingTime.split(' ')[0]);
      return hours > 1 ? "text-green-600" : "text-yellow-600";
    }
    return "text-red-600";
  };

  if (loading) return <div className="text-center py-8">Loading bets...</div>;
  if (error)
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;

  // Calculate page numbers
  const pageNumbers = [];
  for (let i = 1; i <= Math.ceil(bets.length / betsPerPage); i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">All Bets</h2>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh Bets
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bet ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Players
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Choice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time Left
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Outcome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Winner
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedBets.length > 0 ? (
              sortedBets.map((bet) => {
                
                return (
                  <tr key={bet.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{bet.betId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <span className={bet.player1 === address ? "font-bold text-blue-600" : ""}>
                          {formatAddress(bet.player1)}
                        </span>
                        <span className="mx-1">vs</span>
                        <span className={bet.player2 === address ? "font-bold text-blue-600" : ""}>
                          {bet.player2 ? formatAddress(bet.player2) : "Waiting..."}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {bet.amount} {getTokenSymbol(bet.token)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {bet.player1Face}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderStatus(bet.status, bet.remainingTime || "")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={getTimeColor(bet.remainingTime || "")}>
                        {bet.status.toLowerCase() === "pending" || bet.status.toLowerCase() === "active" 
                          ? bet.remainingTime 
                          : "Completed"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {bet.fulfilled ? bet.outcome : "Pending"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {renderWinner(bet)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                  No bets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {bets.length > betsPerPage && (
        <div className="flex justify-center mt-6">
          <nav className="inline-flex rounded-md shadow">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-l-md border border-gray-300 ${
                currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            {pageNumbers.map((number) => (
              <button
                key={number}
                onClick={() => paginate(number)}
                className={`px-3 py-1 border-t border-b border-gray-300 ${
                  currentPage === number 
                    ? 'bg-blue-50 text-blue-600 border-blue-200' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {number}
              </button>
            ))}
            <button
              onClick={nextPage}
              disabled={currentPage === pageNumbers.length}
              className={`px-3 py-1 rounded-r-md border border-gray-300 ${
                currentPage === pageNumbers.length 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default Leaderb;