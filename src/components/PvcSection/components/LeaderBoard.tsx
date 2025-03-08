import React, { useEffect, useState } from "react";
import { gql } from "@apollo/client";
import client from "../client/apollo-client"; // Adjust the import path to your client file
import { SUPPORTED_TOKENS } from "../utils/contract";
import { useAccount } from "wagmi";
import {
  Trophy,
  ArrowLeftCircle,
  ArrowRightCircle,
  Award,
  Users,
  User,
  List,
} from "lucide-react";

// Types for bet data
interface Bet {
  player: string;
  token: string;
  payout: string;
  playerChoice: string;
  outcome: string;
  profit: string;
  userWon: boolean;
}

interface AggregatedPlayer {
  player: string;
  totalPayout: bigint;
}

interface TopPlayersByToken {
  [token: string]: { player: string; totalPayout: string }[];
}

interface PlayerBetData {
  playerChoice: string;
  outcome: string;
  profit: string;
  userWon: boolean;
}

// GraphQL query for a single player
const PLAYER_BETS_QUERY = gql`
  query AllPlayerBet($address: String!) {
    betResults(where: { player: $address }) {
      playerChoice
      outcome
      profit
      userWon
    }
  }
`;

// GraphQL query for a single selected token
const TOKEN_BETS_QUERY = gql`
  query TokenBets($skip: Int!, $token: Bytes!) {
    gameWons(
      first: 1000
      skip: $skip
      orderBy: payout
      orderDirection: desc
      where: { token: $token }
    ) {
      player
      token
      payout
    }
  }
`;

// All_BETS_QUERY
const ALL_BETS_QUERY = gql`
  query AllBets {
    betResults {
      player
      playerChoice
      outcome
      profit
      userWon
    }
  }
`;

// Fetch function for the selected token only
async function fetchTopPlayersForToken(
  selectedToken: string
): Promise<TopPlayersByToken> {
  let allBets: Bet[] = [];
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const result = await client.query<{ gameWons: Bet[] }>({
      query: TOKEN_BETS_QUERY,
      variables: { skip, token: selectedToken },
    });

    const bets = result.data.gameWons || [];
    allBets = allBets.concat(bets);

    if (bets.length < pageSize) break;
    skip += pageSize;
  }

  const aggregates = allBets.reduce(
    (acc: { [key: string]: AggregatedPlayer }, bet) => {
      const key = `${bet.token}-${bet.player}`;
      if (!acc[key]) {
        acc[key] = {
          player: bet.player,
          totalPayout: BigInt(0),
        };
      }
      acc[key].totalPayout += BigInt(bet.payout);
      return acc;
    },
    {}
  );

  const byToken: { [token: string]: AggregatedPlayer[] } = {};
  Object.values(aggregates).forEach((entry) => {
    if (!byToken[entry.player]) {
      byToken[entry.player] = [];
    }
    byToken[entry.player].push({
      player: entry.player,
      totalPayout: entry.totalPayout,
    });
  });

  const result: TopPlayersByToken = {};
  Object.keys(byToken).forEach((token) => {
    result[token] = byToken[token]
      .sort((a, b) => (b.totalPayout > a.totalPayout ? 1 : -1))
      .slice(0, 10)
      .map((entry) => ({
        player: entry.player,
        totalPayout: entry.totalPayout.toString(),
      }));
  });

  return result;
}

// Fetch function to get all bets
async function fetchAllBets(
  setAllBets: React.Dispatch<React.SetStateAction<Bet[]>>
): Promise<Bet[]> {
  let allBets: Bet[] = [];
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const result = await client.query<{ betResults: Bet[] }>({
      query: ALL_BETS_QUERY,
      fetchPolicy: "no-cache",
    });

    const bets = result.data.betResults || [];
    allBets = allBets.concat(bets);

    if (bets.length < pageSize) break;
    skip += pageSize;
  }

  setAllBets(allBets);
  return allBets;
}

// Utility functions
// const getTokenName = (tokenAddress: string): string => {
//   const tokenName = Object.keys(SUPPORTED_TOKENS).find(
//     (key) => SUPPORTED_TOKENS[key as keyof typeof SUPPORTED_TOKENS].toLowerCase() === tokenAddress.toLowerCase()
//   );
//   return tokenName || `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
// };

const truncateAddress = (address: string): string =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const formatPayout = (payout: string): string =>
  (Number(payout) / 1e18).toFixed(2);

// Tab options
type TabType = "all-bets" | "token-leaderboard" | "player-bets";

// Medal colors for top 3 ranks
const getMedalColor = (rank: number) => {
  if (rank === 0) return "text-yellow-500"; // Gold
  if (rank === 1) return "text-gray-400"; // Silver
  if (rank === 2) return "text-amber-700"; // Bronze
  return "text-gray-600"; // Others
};

// LeaderBoard Component
const LeaderBoard: React.FC = () => {
  const [topPlayers, setTopPlayers] = useState<TopPlayersByToken | null>(null);
  const [allBets, setAllBets] = useState<Bet[]>([]);
  const [playerBets, setPlayerBets] = useState<PlayerBetData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all-bets");
  const [selectedToken, setSelectedToken] = useState<string>("");

  // Pagination for All Bets
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { address } = useAccount(); // Hardcoded address

  // Fetch data for selected token
  useEffect(() => {
    if (!selectedToken || activeTab !== "token-leaderboard") {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchTopPlayersForToken(selectedToken);
        setTopPlayers(data);
      } catch (err) {
        setError("Failed to load leaderboard data for this token");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedToken, activeTab]);

  // Fetch all bets when the component mounts or when all-bets tab is selected
  useEffect(() => {
    if (activeTab !== "all-bets") return;

    const loadAllBets = async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchAllBets(setAllBets);
      } catch (err) {
        setError("Failed to load all bets data");
      } finally {
        setLoading(false);
      }
    };

    loadAllBets();
  }, [activeTab]);

  // Fetch player-specific bets when player-bets tab is selected
  useEffect(() => {
    if (activeTab !== "player-bets" || !address) return;

    const fetchPlayerBets = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.query<{ betResults: PlayerBetData[] }>({
          query: PLAYER_BETS_QUERY,
          variables: { address: address },
        });
        setPlayerBets(result.data.betResults);
      } catch (err) {
        setError("Failed to load player-specific bet data");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerBets();
  }, [address, activeTab]);

  const handleTokenChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedToken(event.target.value);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError(null);
    // Reset pagination when changing tabs
    setCurrentPage(1);
  };

  // Pagination controls
  const totalPages = Math.ceil(allBets.length / itemsPerPage);
  const paginatedBets = allBets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="leaderboard p-4 max-w-6xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex border-b mb-4">
        <button
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === "all-bets"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => handleTabChange("all-bets")}
        >
          <List className="mr-2 h-4 w-4" />
          All Bets
        </button>
        <button
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === "token-leaderboard"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => handleTabChange("token-leaderboard")}
        >
          <Trophy className="mr-2 h-4 w-4" />
          Payouts LeaderBoard
        </button>
        <button
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === "player-bets"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => handleTabChange("player-bets")}
        >
          <User className="mr-2 h-4 w-4" />
          Your Bets
        </button>
      </div>

      {/* Token Selector (only shown for Token Leaderboard tab) */}
      {activeTab === "token-leaderboard" && (
        <div className="mb-4">
          <label htmlFor="token-select" className="mr-2 font-medium">
            Select Token:
          </label>
          <select
            id="token-select"
            value={selectedToken}
            onChange={handleTokenChange}
            disabled={loading}
            className="p-2 border rounded"
          >
            <option value="">-- Select a Token --</option>
            {Object.entries(SUPPORTED_TOKENS).map(([name, address]) => (
              <option key={address} value={address}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Content based on active tab */}
      {!loading && !error && (
        <div className="tab-content">
          {/* All Bets Tab Content */}
          {activeTab === "all-bets" && paginatedBets.length > 0 && (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Player</th>
                      <th className="py-2 px-4 border-b text-left">
                        Player Choice
                      </th>
                      <th className="py-2 px-4 border-b text-left">Outcome</th>
                      <th className="py-2 px-4 border-b text-left">Profit</th>
                      <th className="py-2 px-4 border-b text-left">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBets.map((bet, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-gray-50" : ""}
                      >
                        <td className="py-2 px-4 border-b">
                          {truncateAddress(bet.player)}
                        </td>
                        <td className="py-2 px-4 border-b">
                          {bet.playerChoice ? "Tails" : "Heads"}
                        </td>
                        <td className="py-2 px-4 border-b">
                          {bet.outcome ? "Tails" : "Heads"}
                        </td>
                        <td className="py-2 px-4 border-b">
                          {(parseFloat(bet.profit) / 1e18).toFixed(2)}
                        </td>
                        <td
                          className={`py-2 px-4 border-b ${
                            bet.userWon ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {bet.userWon ? "Win" : "Loss"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, allBets.length)}
                    </span>{" "}
                    of <span className="font-medium">{allBets.length}</span>{" "}
                    results
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className={`flex items-center p-2 border rounded ${
                        currentPage === 1
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-blue-500 hover:bg-blue-50"
                      }`}
                    >
                      <ArrowLeftCircle className="h-4 w-4 mr-1" />
                      Previous
                    </button>
                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className={`flex items-center p-2 border rounded ${
                        currentPage === totalPages
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-blue-500 hover:bg-blue-50"
                      }`}
                    >
                      Next
                      <ArrowRightCircle className="h-4 w-4 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Token Leaderboard Tab Content */}
          {activeTab === "token-leaderboard" &&
            selectedToken &&
            topPlayers &&
            Object.keys(topPlayers).length > 0 && (
              <div>
                {Object.entries(topPlayers).map(([token, players]) => (
                  <div key={token} className="mb-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="py-2 px-4 border-b text-left">
                              Rank
                            </th>
                            <th className="py-2 px-4 border-b text-left">
                              Player
                            </th>
                            <th className="py-2 px-4 border-b text-left">
                              Total Payout
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((player, index) => (
                            <tr
                              key={player.player}
                              className={index % 2 === 0 ? "bg-gray-50" : ""}
                            >
                              <td className="py-2 px-4 border-b">
                                <div className="flex items-center">
                                  {index < 3 ? (
                                    <Award
                                      className={`h-5 w-5 mr-1 ${getMedalColor(
                                        index
                                      )}`}
                                    />
                                  ) : (
                                    <span className="text-gray-500 w-5 mr-1 text-center">
                                      {index + 1}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-4 border-b flex items-center">
                                <Users className="h-4 w-4 mr-2 text-blue-500" />
                                {truncateAddress(player.player)}
                              </td>
                              <td className="py-2 px-4 border-b font-medium">
                                {formatPayout(player.totalPayout)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

          {/* Player Bets Tab Content */}
          {activeTab === "player-bets" && playerBets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 border-b text-left">
                      Player Choice
                    </th>
                    <th className="py-2 px-4 border-b text-left">Outcome</th>
                    <th className="py-2 px-4 border-b text-left">Profit</th>
                    <th className="py-2 px-4 border-b text-left">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {playerBets.map((bet, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? "bg-gray-50" : ""}
                    >
                      <td className="py-2 px-4 border-b">
                        {bet.playerChoice ? "Tails" : "Heads"}
                      </td>
                      <td className="py-2 px-4 border-b">
                        {bet.outcome ? "Tails" : "Heads"}
                      </td>
                      <td className="py-2 px-4 border-b">
                        {(parseFloat(bet.profit) / 1e18).toFixed(2)}
                      </td>
                      <td
                        className={`py-2 px-4 border-b ${
                          bet.userWon ? "text-green-500" : "text-red-500"
                        } flex items-center`}
                      >
                        {bet.userWon ? (
                          <>
                            <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                            Win
                          </>
                        ) : (
                          <>
                            <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                            Loss
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* No Data Messages */}
          {activeTab === "all-bets" && allBets.length === 0 && !loading && (
            <div className="text-center py-4">No bets available.</div>
          )}

          {activeTab === "token-leaderboard" &&
            (!selectedToken ||
              !topPlayers ||
              Object.keys(topPlayers).length === 0) &&
            !loading && (
              <div className="text-center py-4">
                {selectedToken
                  ? "No leaderboard data available for this token."
                  : "Please select a token to view the leaderboard."}
              </div>
            )}

          {activeTab === "player-bets" &&
            playerBets.length === 0 &&
            !loading && (
              <div className="text-center py-4">
                You haven't placed any bets yet.
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default LeaderBoard;
