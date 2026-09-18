export const SolanaMobileWalletAdapterWalletName = "SolanaMobileWalletAdapter";
export const SolanaMobileWalletAdapterRemoteWalletName = "SolanaMobileWalletAdapterRemote";

export const createDefaultAddressSelector = () => ({
  select: async (accounts: string[]) => accounts[0],
});

export const createDefaultAuthorizationResultCache = () => ({
  get: () => null,
  set: () => {},
  clear: () => {},
});

export const createDefaultWalletNotFoundHandler = () => () => {};

export class SolanaMobileWalletAdapter {
  name = SolanaMobileWalletAdapterWalletName;
  url = "https://solanamobile.com";
  icon = "";
  supportedTransactionVersions = new Set(["legacy", 0]);
  publicKey = null;
  connecting = false;
  connected = false;
  readyState = "Unsupported";
  on() {}
  off() {}
  emit() {}
  connect = async () => {};
  disconnect = async () => {};
  sendTransaction = async () => "";
  signTransaction = async (tx: any) => tx;
  signAllTransactions = async (txs: any[]) => txs;
  signMessage = async (msg: Uint8Array) => msg;
}

export function base64FromUint8Array() {
  return "";
}
