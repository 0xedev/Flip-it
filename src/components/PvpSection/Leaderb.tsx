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
  }

  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const formattedBets = allBetsData.map((bet) => ({
          id: bet.id.toString(),
          betId: bet.betId.toString(),
          player1: bet.player1,
          player2: bet.player2,
          token: bet.token,
          amount: formatEther(bet.amount),
          player1Face: bet.player1Face ? "Heads" : "Tails",
          outcome: bet.outcome ? "Heads" : "Tails",
          winner: bet.winner,
          status: bet.status,
          timestamp: new Date(Number(bet.timestamp) * 1000).toLocaleString(),
          timeout: bet.timeout.toString(),
          fulfilled: bet.fulfilled,
          payout: bet.payout ? formatEther(bet.payout) : "0",
        }));
        setBets(formattedBets);
        setLoading(false);
      } catch (err) {
        setError("Error formatting bet data");
        setLoading(false);
      }
    }
  }, [allBetsData]);

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

  if (loading) return <div className="text-center py-8">Loading bets...</div>;
  if (error)
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;

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
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Bet ID
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Players
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Amount
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Choice
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Outcome
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Winner
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bets.length > 0 ? (
              bets.map((bet) => (
                <tr key={bet.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{bet.betId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <span
                        className={`${
                          bet.player1 === address
                            ? "font-bold text-blue-600"
                            : ""
                        }`}
                      >
                        {formatAddress(bet.player1)}
                      </span>
                      <span className="mx-1">vs</span>
                      <span
                        className={`${
                          bet.player2 === address
                            ? "font-bold text-blue-600"
                            : ""
                        }`}
                      >
                        {bet.player2
                          ? formatAddress(bet.player2)
                          : "Waiting..."}
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
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        bet.status
                      )}`}
                    >
                      {bet.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bet.fulfilled ? bet.outcome : "Pending"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {renderWinner(bet)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bet.timestamp}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  No bets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderb;
