import { ApolloClient, InMemoryCache } from "@apollo/client";

const client = new ApolloClient({
  uri: "https://api.studio.thegraph.com/query/104328/betflip/version/latest", // Replace with your subgraph URL
  cache: new InMemoryCache(),
});

export default client;

