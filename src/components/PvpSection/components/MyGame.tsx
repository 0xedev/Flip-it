import { useState, useEffect } from "react";
import { gql, useQuery } from "@apollo/client";
import { Trophy, Users, Clock, ArrowUpRight, Gift } from "lucide-react";
import {
  claimRewards,
  getGameStatus,
  cancelGame,
} from "../../../utils/contractFunction";
import { useAppKitAccount } from "@reown/appkit/react";

// GraphQL queries remain the same
const GET_GAMES_CREATED = gql`
  query GetGamesCreated($playerAddress: Bytes!) {
    gameCreateds(where: { player1: $playerAddress }) {
      gameId
      betAmount
      player1Choice
      tokenAddress
    }
  }
`;
const GET_GAMES_JOINED = gql`
  query GetGamesJoined($playerAddress: Bytes!) {
    gameJoineds(where: { player2: $playerAddress }) {
      gameId
      betAmount
    }
  }
`;

const GET_GAMES_JOINED_PLAYER1 = gql`
  query GetGamesJoined($playerAddress: Bytes!) {
    gameJoineds(where: { player1: $playerAddress }) {
      gameId
      player2
    }
  }
`;

const GET_GAMES_RESOLVED = gql`
  query GetGamesResolved($playerAddress: Bytes!) {
    gameResolveds(where: { winner: $playerAddress }) {
      gameId
      winner
      payout
    }
  }
`;
const GET_EVENTS_BY_PLAYER = gql`
  query GetEventsByPlayer($playerAddress: Bytes!) {
    events(
      where: { _or: [{ player1: $playerAddress }, { player2: $playerAddress }] }
    ) {
      gameId
      player1
      player2
      betAmount
      tokenAddress
    }
  }
`;
const GET_REWARDS_FOR_PLAYER = gql`
  query GetRewardsForPlayer($playerAddress: String!) {
    rewardClaimeds(where: { player: $playerAddress }) {
      gameId
      player
      amount
    }
  }
`;

// TypeScript Interfaces for the Game Data

interface GameCreated {
  gameId: string;
  betAmount: string; // Could be a string or number
  player1Choice: boolean; // Changed from string to boolean
  tokenAddress: string;
}

interface GameJoined {
  gameId: string;
  betAmount: string; // Same as above, might be a string or number
}

interface GameResolved {
  gameId: string;
  winner: string;
  payout: string;
}

interface Event {
  gameId: string;
  player1: string;
  player2: string;
  betAmount: string;
  tokenAddress: string;
}

interface GameStatus {
  state: number;
  createdAt: number;
  timeoutDuration: number;
  timeLeft: number;
}

interface GameJoinP {
  gameId: string;
  player2: string;
}
const MyGame = () => {
  const SUPPORTED_TOKENS = {
    STABLEAI: "0x07F41412697D14981e770b6E335051b1231A2bA8",
    DIG: "0x208561379990f106E6cD59dDc14dFB1F290016aF",
    WEB9: "0x09CA293757C6ce06df17B96fbcD9c5f767f4b2E1",
    BNKR: "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b",
    FED: "0x19975a01B71D4674325bd315E278710bc36D8e5f",
    RaTcHeT: "0x1d35741c51fb615ca70e28d3321f6f01e8d8a12d",
    GIRTH: "0xa97d71a5fdf906034d9d121ed389665427917ee4",
  };

  const { address } = useAppKitAccount();
  const [selectedTab, setSelectedTab] = useState<
    "created" | "joined" | "resolved" | "expired"
  >("created");
  const [, setError] = useState<string | null>(null);

  const [gameStatuses, setGameStatuses] = useState<Record<string, GameStatus>>(
    {}
  );

  // Separate page state for each tab
  const [pageState, setPageState] = useState({
    created: 1,
    joined: 1,
    resolved: 1,
    expired: 1, // Add page state for expired
  });

  const itemsPerPage = 5;

  const { data: createdData, loading: loadingCreated } = useQuery<{
    gameCreateds: GameCreated[];
  }>(GET_GAMES_CREATED, {
    variables: { playerAddress: address },
    skip: !address,
  });

  const { data: joinedData, loading: loadingJoined } = useQuery<{
    gameJoineds: GameJoined[];
  }>(GET_GAMES_JOINED, {
    variables: { playerAddress: address },
    skip: !address,
  });

  const { data: resolvedData, loading: loadingResolved } = useQuery<{
    gameResolveds: GameResolved[];
  }>(GET_GAMES_RESOLVED, {
    variables: { playerAddress: address },
    skip: !address,
  });

  const { data: expiredData, loading: loadingExpired } = useQuery<{
    gameExpireds: Event[];
  }>(GET_EVENTS_BY_PLAYER, {
    variables: { playerAddress: address },
    skip: !address,
  });

  // Log the expired game data
  if (expiredData) {
    console.log(expiredData);
  }

  const { data: rewardData } = useQuery<{
    rewardClaimeds: { gameId: string; player: string; amount: string }[];
  }>(GET_REWARDS_FOR_PLAYER, {
    variables: {
      playerAddress: address, // Fetch rewards for this player
    },
    skip: !address, // Skip if no address is available
  });

  const { data: joinedPData } = useQuery<{
    gameJoinedP: GameJoinP[];
  }>(GET_GAMES_JOINED_PLAYER1, {
    variables: { playerAddress: address },
    skip: !address,
  });
  console.log("data", joinedPData);

  useEffect(() => {
    const fetchGameStatuses = async () => {
      const statusMap: Record<string, GameStatus> = {};

      // Combine both gameCreateds and gameJoineds into one array
      const allGames = [
        ...(createdData?.gameCreateds || []),
        ...(joinedData?.gameJoineds || []),
      ];

      for (const game of allGames) {
        try {
          const status = await getGameStatus(Number(game.gameId));
          statusMap[game.gameId] = status;
        } catch (error) {
          console.error("Error fetching status for game:", game.gameId, error);
        }
      }

      setGameStatuses(statusMap);
    };

    // Only call fetchGameStatuses when either createdData or joinedData has data
    if (
      (createdData?.gameCreateds?.length || 0) > 0 ||
      (joinedData?.gameJoineds?.length || 0) > 0
    ) {
      fetchGameStatuses();
    }
  }, [createdData, joinedData]); // The useEffect depends on both createdData and joinedData

  function formatTimeLeft(seconds: number): string {
    const hours = Math.floor(seconds / 3600); // 1 hour = 3600 seconds
    const minutes = Math.floor((seconds % 3600) / 60); // 1 minute = 60 seconds
    const remainingSeconds = seconds % 60;

    // Format the result as "hr:min:sec"
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  const weiToEther = (wei: string): string => {
    const weiValue = BigInt(wei);
    const etherValue = Number(weiValue) / 1e18;
    return etherValue.toFixed(0);
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getTokenName = (tokenAddress: string): string => {
    const tokenName = Object.keys(SUPPORTED_TOKENS).find(
      (key) =>
        SUPPORTED_TOKENS[key as keyof typeof SUPPORTED_TOKENS].toLowerCase() ===
        tokenAddress.toLowerCase()
    );
    return tokenName || "Unknown Token";
  };

  const paginateData = (
    data: GameCreated[] | GameJoined[] | GameResolved[] | Event[],
    page: number
  ) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const tabs = [
    {
      id: "created",
      label: "Created",
      icon: Clock,
      count: createdData?.gameCreateds.length ?? 0,
    },
    {
      id: "joined",
      label: "Joined",
      icon: Users,
      count: joinedData?.gameJoineds.length ?? 0,
    },
    {
      id: "resolved",
      label: "Resolved",
      icon: Trophy,
      count: resolvedData?.gameResolveds.length ?? 0,
    },
    {
      id: "expired",
      label: "Expired",
      icon: Gift,
      count: expiredData?.gameExpireds.length ?? 0, // Count for expired tab
    },
  ] as const;

  // Handle resolving a game
  const handleClaimGame = async (gameId: string) => {
    try {
      console.log(`Claiming rewards for game ${gameId}...`);
      await claimRewards(Number(gameId)); // Assuming claimRewards is defined elsewhere
      console.log(`Successfully claimed rewards for game ${gameId}`);
    } catch (err: any) {
      console.error("Error claiming rewards:", err);
      setError(
        err instanceof Error
          ? `Failed to claim rewards: ${err.message}`
          : "Failed to claim rewards: An unknown error occurred."
      );
    }
  };
  // Handle resolving a game
  const handleCancelGame = async (gameId: string) => {
    try {
      console.log(`Claiming rewards for game ${gameId}...`);
      await cancelGame(Number(gameId)); // Assuming claimRewards is defined elsewhere
      console.log(`Successfully claimed rewards for game ${gameId}`);
    } catch (err: any) {
      console.error("Error claiming rewards:", err);
      setError(
        err instanceof Error
          ? `Failed to claim rewards: ${err.message}`
          : "Failed to claim rewards: An unknown error occurred."
      );
    }
  };

  if (!address) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  // Determine total pages based on selected tab
  const totalPages =
    selectedTab === "created"
      ? Math.ceil((createdData?.gameCreateds.length ?? 0) / itemsPerPage)
      : selectedTab === "joined"
      ? Math.ceil((joinedData?.gameJoineds.length ?? 0) / itemsPerPage)
      : selectedTab === "resolved"
      ? Math.ceil((resolvedData?.gameResolveds.length ?? 0) / itemsPerPage)
      : Math.ceil((expiredData?.gameExpireds.length ?? 0) / itemsPerPage); // Handle expired data for pagination

  const currentPage = pageState[selectedTab];

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-6">
        <div className="flex items-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-black text-xl font-bold">
              {address ? address[3] : "?"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="ml-4">
            <h2 className="text-xl text-black font-bold">
              {formatAddress(address)}
            </h2>
            <div className="flex items-center mt-1 text-gray-600">
              <span className="bg-gray-100 rounded-full px-3 py-1 text-sm">
                Active Player 🎮
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex px-4 overflow-x-auto space-x-4 py-4">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setSelectedTab(id as typeof selectedTab)}
              className={`flex items-center space-x-2 py-2 px-4 min-w-max font-medium transition-colors relative ${
                selectedTab === id
                  ? "border-b-2 border-purple-500 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
              <span className="ml-2 bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-gray-50">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Game ID
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bet Amount
                </th>
                {selectedTab === "created" && (
                  <>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Choice
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reward
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claim
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </>
                )}
                {selectedTab === "resolved" && (
                  <>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payout
                    </th>
                  </>
                )}
                {selectedTab === "joined" && (
                  <>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time Left
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reward Claim
                    </th>
                  </>
                )}

                {selectedTab === "expired" && (
                  <>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claim
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Dynamically render the table rows based on selectedTab and data */}
              {selectedTab === "created" &&
                (loadingCreated ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Loading created games...
                    </td>
                  </tr>
                ) : (
                  paginateData(
                    createdData?.gameCreateds || [],
                    currentPage
                  ).map((game) => {
                    const rewardClaim = rewardData?.rewardClaimeds.find(
                      (claim) => claim.gameId === game.gameId
                    );
                    const timeLeft = gameStatuses[game.gameId]?.timeLeft;

                    const joinP =
                      joinedPData?.gameJoinedP.find(
                        (player2) => player2.gameId === game.gameId
                      ) || null;

                    return (
                      <tr
                        key={game.gameId}
                        className="text-black hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 font-medium">{game.gameId}</td>
                        <td className="px-6 py-4">
                          {"betAmount" in (game as GameCreated)
                            ? weiToEther((game as GameCreated).betAmount)
                            : "N/A"}
                          &nbsp;
                          {"tokenAddress" in (game as GameCreated)
                            ? getTokenName((game as GameCreated).tokenAddress)
                            : ""}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-sm ${
                              (game as GameCreated).player1Choice
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {(game as GameCreated).player1Choice
                              ? "Head"
                              : "Tail"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {rewardClaim ? (
                            <span className="text-green-600 font-medium">
                              {weiToEther(rewardClaim.amount)}
                            </span>
                          ) : (
                            <span className="text-gray-500">No claim</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {rewardClaim ? (
                            <span className="text-green-600 font-medium">
                              Claimed
                            </span>
                          ) : timeLeft <= 0 ? (
                            // If time left is expired
                            joinP ? (
                              // Player 2 is present, show Refund button (use handleClaimGame)
                              <button
                                onClick={() => handleClaimGame(game.gameId)} // Claim function
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                              >
                                Refund
                              </button>
                            ) : (
                              // No Player 2, show Cancel button (use handleCancelGame)
                              <button
                                onClick={() => handleCancelGame(game.gameId)} // Cancel function
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                              >
                                Cancel
                              </button>
                            )
                          ) : // Time left > 0
                          joinP ? (
                            // Player 2 is present, show Reveal button (use handleClaimGame)
                            <button
                              onClick={() => handleClaimGame(game.gameId)} // Claim function
                              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                            >
                              Reveal
                            </button>
                          ) : (
                            // No Player 2 and time left > 0, show "GameOn" with green color
                            <span className="text-green-600 font-medium">
                              GameOn
                            </span>
                          )}
                        </td>

                        {rewardClaim ? null : (
                          <td className="px-6 py-4">
                            {timeLeft
                              ? timeLeft > 0
                                ? formatTimeLeft(timeLeft)
                                : "Expired"
                              : "Loading..."}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ))}

              {selectedTab === "joined" &&
                (loadingJoined ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Loading joined games...
                    </td>
                  </tr>
                ) : (
                  paginateData(joinedData?.gameJoineds || [], currentPage).map(
                    (game) => {
                      // Get the timeLeft based on game.gameId from gameStatuses
                      const timeLeft = gameStatuses[game.gameId]?.timeLeft;

                      // Get the rewardClaim based on game.gameId from rewardData
                      const rewardClaim = rewardData?.rewardClaimeds.find(
                        (claim) => claim.gameId === game.gameId
                      );

                      const isExpired = timeLeft <= 0; // Check if the game has expired or if timeLeft is 0 or less

                      return (
                        <tr
                          key={game.gameId}
                          className="text-black hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 font-medium">
                            {game.gameId}
                          </td>
                          <td className="px-6 py-4">
                            {"betAmount" in game
                              ? weiToEther(game.betAmount)
                              : "N/A"}
                          </td>

                          {/* Time Left */}
                          <td className="px-6 py-4">
                            {timeLeft
                              ? isExpired
                                ? "Expired" // Show "Expired" when timeLeft <= 0
                                : formatTimeLeft(timeLeft) // Display formatted time left if it's still valid
                              : "Loading..." // Display loading when timeLeft is not available
                            }
                          </td>

                          {/* Reward Name / Claim */}
                          <td className="px-6 py-4">
                            {isExpired ? (
                              <button
                                className="text-white px-4 py-2 bg-blue-500 rounded-lg font-medium"
                                onClick={() => handleClaimGame(game.gameId)} // Claim game if expired
                              >
                                Refund
                              </button>
                            ) : rewardClaim ? (
                              <span className="text-green-600 font-medium">
                                {weiToEther(rewardClaim.amount)} (Claimed)
                              </span>
                            ) : (
                              <span className="text-gray-500">No claim</span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )
                ))}

              {selectedTab === "resolved" &&
                (loadingResolved ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Loading resolved games...
                    </td>
                  </tr>
                ) : (
                  paginateData(
                    resolvedData?.gameResolveds || [],
                    currentPage
                  ).map((game) => {
                    const isWinner =
                      (game as GameResolved).winner.toLowerCase() ===
                      address.toLowerCase(); // Check if the current player is the winner
                    return (
                      <tr
                        key={game.gameId}
                        className="hover:bg-gray-50 text-black"
                      >
                        <td className="px-6 py-4 font-medium">{game.gameId}</td>

                        <td className="px-6 py-4">
                          {isWinner ? (
                            <span className="text-green-600 font-medium">
                              Won
                            </span>
                          ) : (
                            <span className="text-red-600 font-medium">
                              Lost
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-green-600 font-medium">
                            {weiToEther((game as GameResolved).payout)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ))}

              {selectedTab === "expired" &&
                (loadingExpired ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Loading expired games...
                    </td>
                  </tr>
                ) : (
                  paginateData(
                    expiredData?.gameExpireds || [],
                    currentPage
                  ).map((game) => (
                    <tr
                      key={game.gameId}
                      className="text-black hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium">{game.gameId}</td>
                    </tr>
                  ))
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between mt-4">
          <button
            onClick={() => {
              setPageState((prev) => ({
                ...prev,
                [selectedTab]: Math.max(prev[selectedTab] - 1, 1),
              }));
            }}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => {
              setPageState((prev) => ({
                ...prev,
                [selectedTab]: Math.min(prev[selectedTab] + 1, totalPages),
              }));
            }}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyGame;
