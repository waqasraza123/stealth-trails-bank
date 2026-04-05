import { ethers } from "ethers";

export function generateEthereumAddress(): { address: string } {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address };
}
