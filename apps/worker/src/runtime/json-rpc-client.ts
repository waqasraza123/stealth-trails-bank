import axios, { type AxiosInstance } from "axios";
import type { BroadcastReceipt } from "./worker-types";

type JsonRpcSuccessResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

type JsonRpcErrorResponse = {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
  };
};

type JsonRpcReceiptResponse = {
  transactionHash: string;
  blockNumber: string | null;
  status: string | null;
  from: string;
  to: string | null;
};

function parseHexQuantity(value: string, fieldName: string): bigint {
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`${fieldName} must be a valid hex quantity.`);
  }

  return BigInt(value);
}

export function createJsonRpcClient(rpcUrl: string, timeoutMs: number) {
  let nextRequestId = 0;
  const httpClient: AxiosInstance = axios.create({
    baseURL: rpcUrl,
    timeout: timeoutMs,
    headers: {
      "content-type": "application/json"
    }
  });

  async function callJsonRpc<T>(
    method: string,
    params: readonly unknown[]
  ): Promise<T> {
    const response = await httpClient.post<
      JsonRpcSuccessResponse<T> | JsonRpcErrorResponse
    >("", {
      jsonrpc: "2.0",
      id: ++nextRequestId,
      method,
      params
    });

    if ("error" in response.data) {
      throw new Error(
        `RPC request failed for ${method}: ${response.data.error.message}`
      );
    }

    return response.data.result;
  }

  return {
    async getBlockNumber(): Promise<bigint> {
      const result = await callJsonRpc<string>("eth_blockNumber", []);

      return parseHexQuantity(result, "eth_blockNumber result");
    },

    async getTransactionReceipt(txHash: string): Promise<BroadcastReceipt | null> {
      const result = await callJsonRpc<JsonRpcReceiptResponse | null>(
        "eth_getTransactionReceipt",
        [txHash]
      );

      if (!result || !result.blockNumber) {
        return null;
      }

      return {
        txHash: result.transactionHash,
        fromAddress: result.from ?? null,
        toAddress: result.to ?? null,
        blockNumber: parseHexQuantity(result.blockNumber, "receipt.blockNumber"),
        succeeded: result.status === "0x1"
      };
    }
  };
}
