import { useState, useEffect } from "react";
import { 
  useReadContract, 
  useAccount, 
  useWatchContractEvent, 
  useWriteContract 
} from "wagmi";
import { formatEther, Address } from "viem";
import { SUPPORTED_TOKENS, ADDRESS, ABI } from "./Contract";

type GameMatch = {
  player1: Address;
  player2: Address;
  token: Address;
  amount: bigint;
  player1Face: boolean;
  fulfilled: boolean;
  outcome: boolean;
  paid: bigint;
  betId: bigint;
  timestamp: bigint;
  timeout: bigint;
  status: string;
  id: bigint;
  winner?: Address;
};

type AllBetsEvent = {
  betId: bigint;
  player1: Address;
  player2: Address;
  player1Face: boolean;
  outcome: boolean;
  winner: Address;
  payout: bigint;
  status: string;
  timeout: bigint;
  amount: bigint;
  token: Address;
  id: bigint;
};

export function MyGame() {
  const { address } = useAccount();
  const [, setBets] = useState<GameMatch[]>([]);
  const [player1Bets, setPlayer1Bets] = useState<GameMatch[]>([]);
  const [player2Bets, setPlayer2Bets] = useState<GameMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<AllBetsEvent[]>([]);
  const [activeTab, setActiveTab] = useState<"player1" | "player2">("player1");
  const { writeContract } = useWriteContract();

  // Read all bets from the contract
  const { data, refetch, isError, isLoading } = useReadContract({
    address: ADDRESS,
    abi: ABI,
    functionName: "allBets",
  });

  // Watch for new bet events to refresh the list
  useWatchContractEvent({
    address: ADDRESS,
    abi: ABI,
    eventName: "AllBets",
    onLogs(logs) {
      const newEvents = logs.map((log: any) => {
        const args = log.args as AllBetsEvent;
        return {
          betId: args.betId,
          player1: args.player1,
          player2: args.player2,
          player1Face: args.player1Face,
          outcome: args.outcome,
          winner: args.winner,
          payout: args.payout,
          status: args.status,
          timeout: args.timeout,
          amount: args.amount,
          token: args.token,
          id: args.id,
        };
      });
      setEvents((prev) => [...newEvents, ...prev]);
      refetch();
    },
  });

  const claimExpiredBet = async (betId: bigint) => {
    try {
      await writeContract({
        address: ADDRESS,
        abi: ABI,
        functionName: "claimExpiredBet",
        args: [betId],
      });
      refetch();
    } catch (error) {
      console.error("Error claiming expired bet:", error);
      setError("Failed to claim expired bet");
    }
  };

  const cancelBet = async (betId: bigint) => {
    try {
      await writeContract({
        address: ADDRESS,
        abi: ABI,
        functionName: "cancelBet",
        args: [betId],
      });
      refetch();
    } catch (error) {
      console.error("Error cancelling bet:", error);
      setError("Failed to cancel bet");
    }
  };

  const isClaimable = (bet: GameMatch) => {
    return (
      bet.status.toLowerCase() === "expired" &&
      bet.player1 === address &&
      (!bet.player2 || bet.player2 === "0x0000000000000000000000000000000000000000")
    );
  };

  const isCancellable = (bet: GameMatch) => {
    return (
      bet.status.toLowerCase() === "pending" &&
      bet.player1 === address &&
      (!bet.player2 || bet.player2 === "0x0000000000000000000000000000000000000000")
    );
  };

  useEffect(() => {
    if (data && address) {
      try {
        const formattedBets = (data as GameMatch[]).map((bet) => {
          const winner = bet.fulfilled
            ? bet.player1Face === bet.outcome
              ? bet.player1
              : bet.player2
            : undefined;

          return {
            ...bet,
            amount: bet.amount,
            paid: bet.paid,
            timestamp: bet.timestamp,
            timeout: bet.timeout,
            id: bet.id,
            betId: bet.betId,
            winner,
          };
        });

        setBets(formattedBets);

        const p1Bets = formattedBets.filter((bet) => bet.player1 === address);
        const p2Bets = formattedBets.filter(
          (bet) => bet.player2 && bet.player2 === address
        );

        setPlayer1Bets(p1Bets);
        setPlayer2Bets(p2Bets);
        setLoading(false);
      } catch (err) {
        console.error("Error parsing bet data:", err);
        setError("Failed to parse bet data");
        setLoading(false);
      }
    }
  }, [data, address, events]);

  useEffect(() => {
    if (isError) {
      setError("Failed to load bets");
      setLoading(false);
    }
  }, [isError]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
      </div>
    );

  if (error)
    return (
      <div
        className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
        role="alert"
      >
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );

  const activeBets = activeTab === "player1" ? player1Bets : player2Bets;

  return (
    <div className="text-black container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">My Bets</h2>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Refreshing..." : "Refresh Bets"}
          </button>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          <p>• <span className="font-medium">Cancel</span>: Available for your pending bets that haven't been matched</p>
          <p>• <span className="font-medium">Claim</span>: Available when your unmatched bet expires</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-4 border-b">
          <button
            className={`flex-1 py-2 text-center font-semibold ${
              activeTab === "player1"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("player1")}
          >
            My Created Bets ({player1Bets.length})
          </button>
          <button
            className={`flex-1 py-2 text-center font-semibold ${
              activeTab === "player2"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("player2")}
          >
            My Joined Bets ({player2Bets.length})
          </button>
        </div>

        <div className="overflow-x-auto">
          {activeBets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {activeTab === "player1"
                ? "You haven't created any bets yet"
                : "You haven't joined any bets yet"}
            </div>
          ) : (
            <table className="w-full whitespace-nowrap">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  {[
                    "Bet ID",
                    "Player 1",
                    "Player 2",
                    "Amount",
                    "Token",
                    "Choice",
                    "Status",
                    "Outcome",
                    "Winner",
                    "Actions"
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeBets.map((bet) => (
                  <tr
                    key={bet.id.toString()}
                    className={`hover:bg-gray-50 ${
                      bet.status.toLowerCase() === "fulfilled"
                        ? "bg-green-50"
                        : bet.status.toLowerCase() === "pending"
                        ? "bg-yellow-50"
                        : bet.status.toLowerCase() === "expired"
                        ? "bg-red-50"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-4">{bet.betId.toString()}</td>
                    <td className="px-4 py-4">
                      {bet.player1 === address
                        ? "You"
                        : shortenAddress(bet.player1)}
                    </td>
                    <td className="px-4 py-4">
                      {bet.player2
                        ? bet.player2 === address
                          ? "You"
                          : shortenAddress(bet.player2)
                        : "Waiting..."}
                    </td>
                    <td className="px-4 py-4">{formatEther(bet.amount)}</td>
                    <td className="px-4 py-4">{getTokenSymbol(bet.token)}</td>
                    <td className="px-4 py-4">
                      {bet.player1Face ? "Heads" : "Tails"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span>{bet.status}</span>
                        {bet.status.toLowerCase() === "pending" && (
                          <span className="text-xs text-gray-500">
                            {getRemainingTime(bet.timestamp, bet.timeout)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {bet.fulfilled
                        ? bet.outcome
                          ? "Heads"
                          : "Tails"
                        : "Pending"}
                    </td>
                    <td className="px-4 py-4">
                      {bet.winner ? (
                        <div
                          className={
                            bet.winner === address
                              ? "text-green-600 font-bold"
                              : ""
                          }
                        >
                          {bet.winner === address
                            ? "You won!"
                            : `${shortenAddress(bet.winner)} won`}
                          {bet.winner === address && bet.paid > 0 && (
                            <div className="text-sm text-gray-500">
                              (+{formatEther(bet.paid)}{" "}
                              {getTokenSymbol(bet.token)})
                            </div>
                          )}
                        </div>
                      ) : bet.status.toLowerCase() === "fulfilled" ? (
                        "Calculating..."
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-4 space-x-2">
                      {/* Cancel button for pending bets */}
                      {isCancellable(bet) && (
                        <button
                          onClick={() => cancelBet(bet.betId)}
                          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      )}
                      
                      {/* Claim button for expired bets */}
                      {isClaimable(bet) && (
                        <button
                          onClick={() => claimExpiredBet(bet.betId)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                        >
                          Claim
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Recent Events
          </h3>
          {events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.slice(0, 5).map((event, index) => (
                <div
                  key={index}
                  className="bg-white border rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
                >
                  <h4 className="text-lg font-bold mb-2 text-gray-700">
                    Event #{index + 1}
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <strong>Bet ID:</strong> {event.betId.toString()}
                    </p>
                    <p>
                      <strong>Match ID:</strong> {event.id.toString()}
                    </p>
                    <p>
                      <strong>Status:</strong> {event.status}
                    </p>
                    <p>
                      <strong>Player1:</strong> {shortenAddress(event.player1)}
                    </p>
                    <p>
                      <strong>Player2:</strong>{" "}
                      {event.player2 ? shortenAddress(event.player2) : "None"}
                    </p>
                    <p>
                      <strong>Amount:</strong> {formatEther(event.amount)}{" "}
                      {getTokenSymbol(event.token)}
                    </p>
                    {event.outcome !== undefined && (
                      <p>
                        <strong>Outcome:</strong>{" "}
                        {event.outcome ? "Heads" : "Tails"}
                      </p>
                    )}
                    {event.winner &&
                    event.winner !==
                      "0x0000000000000000000000000000000000000000" ? (
                      <p
                        className={
                          event.winner === address
                            ? "text-green-600 font-semibold"
                            : ""
                        }
                      >
                        <strong>Winner:</strong>{" "}
                        {event.winner === address
                          ? "You"
                          : shortenAddress(event.winner)}
                        {event.payout > 0 && (
                          <span>
                            {" "}
                            (Payout: {formatEther(event.payout)}{" "}
                            {getTokenSymbol(event.token)})
                          </span>
                        )}
                      </p>
                    ) : event.status.toLowerCase() === "fulfilled" ? (
                      <p>Winner: Being calculated...</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No events detected yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function shortenAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getTokenSymbol(tokenAddress: Address): string {
  const token = SUPPORTED_TOKENS.find((t) => t.address === tokenAddress);
  return token ? token.symbol : "Unknown";
}
function getRemainingTime(timestamp: bigint, timeout: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const endTime = Number(timestamp) + Number(timeout);
  const remaining = endTime - now;
  return remaining > 0 ? formatTimeout(BigInt(remaining)) : "Expired";
}
function formatTimeout(timeout: bigint): string {
  const seconds = Number(timeout);
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  return `${Math.floor(seconds / 86400)} days`;
}


export default MyGame;