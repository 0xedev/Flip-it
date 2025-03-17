import { ethers } from "ethers";
import { ABI, ADDRESS } from "./contract";

// Set up provider and contract for public access (read-only)
export const publicProvider = new ethers.JsonRpcProvider(
  "https://base-mainnet.g.alchemy.com/v2/os5WiDtgiyV3YXhsy2P-Cc0IX5IwFbYy"
);

export const fallbackProvider = new ethers.JsonRpcProvider(
  "https://base-mainnet.infura.io/v3/b17a040a14bc48cfb3928a73d26f3617"
);

export const publicContract = new ethers.Contract(ADDRESS, ABI, publicProvider);

// Function to set up signer and contract for wallet interaction
async function setupContractWithSigner() {
  try {
    if (window.ethereum) {
      // Type assertion to tell TypeScript that window.ethereum is Eip1193Provider
      const provider = new ethers.BrowserProvider(
        window.ethereum as unknown as ethers.Eip1193Provider
      );
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ADDRESS, ABI, signer);
      return { signer, contract };
    } else {
      throw new Error(
        "Ethereum provider is not available. Please install a wallet like MetaMask."
      );
    }
  } catch (error) {
    console.error("Error setting up contract with signer:", error);
    throw error;
  }
}

// Function to handle contract errors with additional info
interface ContractError extends Error {
  code?: string;
  transaction?: any;
  revert?: string;
}

function handleContractError(error: ContractError) {
  if (error.code === "CALL_EXCEPTION") {
    console.error("Transaction data:", error.transaction);
    if (error.revert) {
      console.error("Revert reason:", error.revert);
    }
  } else if (error.code === "ACTION_REJECTED") {
    console.error("User rejected the action:", error);
  } else {
    console.error("Unexpected error:", error);
  }
}
// Function to monitor bet status
export const getBetStatus = async (requestId: string) => {
  try {
    const { contract } = await setupContractWithSigner();
    const status = await contract.getBetStatus(requestId);
    return status;
  } catch (error) {
    console.error("Error getting bet status:", error);
    handleContractError(error as ContractError);
    throw error;
  }
};

export const getGameOutcome = async (requestId: string) => {
  try {
    const { contract } = await setupContractWithSigner();
    const outcome = await contract.getGameOutcome(requestId);
    return outcome;
  } catch (error) {
    console.error("Error getting game outcome:", error);
    handleContractError(error as ContractError);
    throw error;
  }
};

export const flip = async (
  tokenAddress: string,
  tokenAmount: string,
  face: boolean
) => {
  try {
    const { signer, contract } = await setupContractWithSigner();

    // Convert betAmount to the correct token decimals
    const tokenAmountInWei = ethers.parseUnits(tokenAmount, 18);

    // Create token contract instance
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address owner) external view returns (uint256)",
      ],
      signer
    );

    // Check balance
    const balance = await tokenContract.balanceOf(await signer.getAddress());
    if (balance < tokenAmountInWei) {
      throw new Error("Insufficient token balance");
    }

    // Check if the contract already has sufficient allowance
    const signerAddress = await signer.getAddress();
    const currentAllowance = await tokenContract.allowance(
      signerAddress,
      ADDRESS
    );

    // Only approve if the current allowance is less than the bet amount
    if (currentAllowance < tokenAmountInWei) {
      // For better UX, we approve a large amount (or max) to avoid frequent approvals
      // Using MaxUint256 for unlimited approval
      const maxApproval = ethers.MaxUint256; // or ethers.parseUnits("1000000", 18) for a large fixed amount

      console.log("Approving tokens for future bets...");
      const approveTx = await tokenContract.approve(ADDRESS, maxApproval);
      await approveTx.wait();
      console.log("Token approval successful!");
    }

    // Approve tokens
    // const approveTx = await tokenContract.approve(ADDRESS, tokenAmountInWei);
    // await approveTx.wait();

    // Send the flip transaction
    console.log("Placing bet...");
    const tx = await contract.flip(face, tokenAddress, tokenAmountInWei);

    const receipt = await tx.wait();

    // Get the requestId from the event
    const betSentEvent = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find((event: any) => event && event.name === "BetSent");

    const requestId = betSentEvent ? betSentEvent.args.requestId : null;

    return {
      receipt,
      requestId,
    };
  } catch (error) {
    console.error("Error in flip function:", error);
    handleContractError(error as ContractError);
    throw error;
  }
};

export const approveToken = async (tokenAddress: string) => {
  try {
    const { signer } = await setupContractWithSigner();

    // Create token contract instance
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
      ],
      signer
    );

    // Use maximum approval to avoid future approval transactions
    const maxApproval = ethers.MaxUint256;

    // Send approval transaction
    const approveTx = await tokenContract.approve(ADDRESS, maxApproval);
    const receipt = await approveTx.wait();

    return {
      success: true,
      receipt,
      message: "Token approved successfully for unlimited betting!",
    };
  } catch (error) {
    console.error("Error approving token:", error);
    handleContractError(error as ContractError);
    throw error;
  }
};
