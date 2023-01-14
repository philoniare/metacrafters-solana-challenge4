// import functionalities
import React from 'react';
import * as buffer from "buffer";
import './App.css';
import {
  PublicKey,
  Connection,
  Transaction,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Keypair,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {useEffect , useState } from "react";

window.Buffer = buffer.Buffer;
// create types
type DisplayEncoding = "utf8" | "hex";

type PhantomEvent = "disconnect" | "connect" | "accountChanged";
type PhantomRequestMethod =
    | "connect"
    | "disconnect"
    | "signTransaction"
    | "signAllTransactions"
    | "signMessage";

interface ConnectOpts {
  onlyIfTrusted: boolean;
}

// create a provider interface (hint: think of this as an object) to store the Phantom Provider
interface PhantomProvider {
  publicKey: PublicKey | null;
  isConnected: boolean | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (
      message: Uint8Array | string,
      display?: DisplayEncoding
  ) => Promise<any>;
  connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: PhantomEvent, handler: (args: any) => void) => void;
  request: (method: PhantomRequestMethod, params: any) => Promise<unknown>;
}

/**
 * @description gets Phantom provider, if it exists
 */
const getProvider = (): PhantomProvider | undefined => {
  if ("solana" in window) {
    // @ts-ignore
    const provider = window.solana as any;
    if (provider.isPhantom) return provider as PhantomProvider;
  }
};

function App() {
  // create state variable for the provider
  const [provider, setProvider] = useState<PhantomProvider | undefined>(
      undefined
  );

  // create state variable for the wallet key
  const [walletKey, setWalletKey] = useState<PublicKey | undefined>(
      undefined
  );


  const [createdAccount, setCreatedAccount] = useState<Keypair | undefined>(undefined);
  const [createdAccountBalance, setCreatedAccountBalance] = useState(0);

  const [connection, setConnection] = useState<Connection | undefined>(undefined);

  // this is the function that runs whenever the component updates (e.g. render, refresh)
  useEffect(() => {
    const provider = getProvider();

    // if the phantom provider exists, set this as the provider
    if (provider) {
      setProvider(provider);
      setConnection(new Connection(clusterApiUrl("devnet"), "confirmed"))
    }
    else setProvider(undefined);


  }, []);

  const disconnectWallet = async () => {
    // @ts-ignore
    const { solana } = window;

    // checks if phantom wallet exists
    if (solana) {
      // disconnects wallet
      await solana.disconnect();
      // sets walletKey to null
      setWalletKey(undefined);
    }
  }

  /**
   * @description prompts user to connect wallet if it exists.
   * This function is called when the connect wallet button is clicked
   */
  const connectWallet = async () => {
    // @ts-ignore
    const { solana } = window;

    // checks if phantom wallet exists
    if (solana) {
      try {
        // connects wallet and returns response which includes the wallet public key
        const response = await solana.connect();
        // update walletKey to be the public key
        setWalletKey(response.publicKey);
      } catch (err) {
        // { code: 4001, message: 'User rejected the request.' }
      }
    }
  };

  const transferToWallet = async (to: PublicKey, lamports: number, from?: Keypair) => {
    if(from) {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: from.publicKey,
          toPubkey: to,
          lamports,
        })
      );

      // Sign transaction
      if(connection) {
        await sendAndConfirmTransaction(
          connection,
          transaction,
          [from]
        );
      }
    }
  }

  const getWalletBalance = async (publicKey: PublicKey) => {
    try {
      if(connection) {
        // Make a wallet (keypair) from privateKey and get its balance
        const walletBalance = await connection.getBalance(
          publicKey
        );
        return walletBalance;
      }
    } catch (err) {
      console.log(err);
    }
  };

  const createAccount = async () => {
    let account = Keypair.generate();

    if(connection) {
      const publicKey = new PublicKey(account.publicKey);
      let sig = await connection.requestAirdrop(
        publicKey,
        2 * LAMPORTS_PER_SOL
      );
      let latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: sig
      });

      setCreatedAccount(account);
      const balance = await getWalletBalance(publicKey);
      if(balance) {
        setCreatedAccountBalance(balance);
      }
    }
  }

  // HTML code for the app
  return (
      <div className="App">
        {provider && walletKey && (
            <div style={{textAlign: "right"}}>
              <button
                  style={{
                    fontSize: "16px",
                    padding: "15px",
                    fontWeight: "bold",
                    borderRadius: "5px",
                  }}
                  onClick={disconnectWallet}
              >
                Disconnect
              </button>
            </div>)
        }

        <div style={{marginBottom: '10px'}}>
          <button
              style={{
                fontSize: "16px",
                padding: "15px",
                fontWeight: "bold",
                borderRadius: "5px",
              }}
              onClick={createAccount}
          >
            Create a new Solana account
          </button>
          {createdAccount && (
            <div>Created account: {createdAccount.publicKey.toString()} with balance: {createdAccountBalance}</div>
          )}
        </div>


        {provider && !walletKey && (
            <button
                style={{
                  fontSize: "16px",
                  padding: "15px",
                  fontWeight: "bold",
                  borderRadius: "5px",
                }}
                onClick={connectWallet}
            >
              Connect to Phantom Wallet
            </button>
        )}
        {provider && walletKey && <div>
          <p>Connected account: {provider.publicKey?.toString()}</p>
          <button
              style={{
                fontSize: "16px",
                padding: "15px",
                fontWeight: "bold",
                borderRadius: "5px",
              }}
              onClick={() => transferToWallet(walletKey, LAMPORTS_PER_SOL, createdAccount)}
          >
            Transfer to new wallet
          </button>
        </div> }

        {!provider && (
            <p>
              No provider found. Install{" "}
              <a href="https://phantom.app/">Phantom Browser extension</a>
            </p>
        )}
      </div>
  );
}

export default App;