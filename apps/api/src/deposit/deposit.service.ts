import { Injectable } from "@nestjs/common";
import { loadBlockchainWalletRuntimeConfig } from "@stealth-trails-bank/config/api";
import { ethers } from "ethers";
import { CreateDepositDto } from "./dto/create-deposit.dto";
import { CustomJsonResponse } from "../types/CustomJsonResponse";

@Injectable()
export class DepositService {
  private readonly rpcUrl: string;
  private readonly privateKey: string;

  constructor() {
    const runtimeConfig = loadBlockchainWalletRuntimeConfig();

    this.rpcUrl = runtimeConfig.rpcUrl;
    this.privateKey = runtimeConfig.ethereumPrivateKey;
  }

  async create(
    createDepositDto: CreateDepositDto
  ): Promise<CustomJsonResponse> {
    const { asset, amount, address } = createDepositDto;

    return this.depositToBlockchain(asset, amount, address);
  }

  async depositToBlockchain(
    asset: string,
    amount: number,
    address: string
  ): Promise<CustomJsonResponse> {
    const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    const wallet = new ethers.Wallet(this.privateKey, provider);

    if (asset === "ethereum") {
      const transaction = await wallet.sendTransaction({
        to: address,
        value: ethers.utils.parseEther(amount.toString())
      });

      return {
        status: "success",
        message: "Deposit successful",
        data: {
          transactionHash: transaction.hash
        }
      };
    }

    if (asset === "usdc") {
      console.log("USDC transfer not yet implemented.");
      return {
        status: "success",
        message: "USDC deposit stub executed"
      };
    }

    if (asset === "usdt") {
      console.log("USDT transfer not yet implemented.");
      return {
        status: "success",
        message: "USDT deposit stub executed"
      };
    }

    console.log("Unsupported asset type.");

    return {
      status: "failed",
      message: "Unsupported asset type"
    };
  }
}
