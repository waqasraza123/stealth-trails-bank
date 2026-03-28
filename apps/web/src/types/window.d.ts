type EthereumRequestArguments = {
  method: string;
  params?: readonly unknown[] | object;
};

type EthereumEventCallback = (...args: readonly unknown[]) => void;

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (request: EthereumRequestArguments) => Promise<unknown>;
  on: (event: string, callback: EthereumEventCallback) => void;
  removeListener: (event: string, callback: EthereumEventCallback) => void;
}

interface Window {
  ethereum?: EthereumProvider;
}
