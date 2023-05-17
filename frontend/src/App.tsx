import React, { useEffect, useState } from "react";
import "@fuel-wallet/sdk";
import "./App.css";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Account, Address, JsonFlatAbi, NativeAssetId, Predicate, Provider, Wallet, WalletLocked, WalletUnlocked, getRandomB256, hexlify } from "fuels";
import { PredicateAbi__factory } from './types';


function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [pubKey, setPubKey] = useState<any[]>();
  const [predicate, setPredicate] = useState<Predicate<any>>();
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [provider, setProvider] = useState<Provider>();
  const [burnerWalletAddress, setBurnerWalletAddress] = useState<string>("");

  useEffect(() => {
    setTimeout(() => {
      checkConnection();
      setLoaded(true);
    }, 200)

  }, [connected])

  async function fundPredicate() {
    if (window.fuel) {
     try {
        await window.fuel.connect();
        const [account] = await window.fuel.accounts();
        const wallet = await window.fuel!.getWallet(account);

        const walletPredicate = Wallet.fromAddress(predicate!.address, provider);
        const initial = await walletPredicate.getBalance();
        console.log(initial);

        // Fund the predicate
        const response1 = await wallet.transfer(predicate!.address, 10000, NativeAssetId, {
          gasLimit: 164,
          gasPrice: 1,
        });
        await response1.wait();
        const after = await walletPredicate.getBalance();
        console.log(after);

        console.log("predicateAddress from fundPredicate: " + predicate?.address);
        setAccount(account);
        setConnected(true);
     } catch(err) {
       console.log("error connecting: ", err);
     }
    }
   }

   async function send(addr: any, amount: number) {
    const inputAddress = Address.fromDynamicInput(addr);
    const walletInputAddress = Wallet.fromAddress(inputAddress, provider);
    // Print destination wallet balance before transaction
    const initialBalance = await walletInputAddress.getBalance();
    console.log(initialBalance);

    if (window.fuel) {
     try {
      await window.fuel.connect();
        if (predicate) {
          const tx = await predicate!.
            setData(pubKey).
            transfer(inputAddress, amount, NativeAssetId, {gasPrice: 1});
          const result = await tx.waitForResult();

          if (result.status.type =='success') {
            console.log('success');
          } else {
            console.log('fail');
          }

          // Check balance of someAddress was indeed increased
          const destinationBalance = await walletInputAddress.getBalance(NativeAssetId);
          console.log(destinationBalance);
        }
     } catch(err) {
       console.log("error connecting: ", err);
     }
    }
   }

  async function btnRegBegin() {
    fetch("/generate-registration-options")
      .then(async (res) => {
        const resp = await fetch('/generate-registration-options');

        let attResp;
        try {
          const opts = await resp.json();
          attResp = await startRegistration(opts);
        } catch (error) {
          throw error;
        }

        const verificationResp = await fetch('/verify-registration', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attResp),
        });

        const verificationJSON = await verificationResp.json();

        if (verificationJSON && verificationJSON.verified) {
          console.log("Registration successful");
        } else {
          console.error("Registration failed");
        }

        let pubkeyArray = [];
        for (let i = 0; i < 72; i++) {
          pubkeyArray.push(verificationJSON.pubkey[i]);
        }
        console.log(pubkeyArray);
        
        // Create Burner Wallet
        const provider = new Provider('https://beta-3.fuel.network/graphql');
        setProvider(provider);
        const configurable = { PUBKEY: pubkeyArray };
        const { abi, bin } = PredicateAbi__factory;
        const pred = new Predicate(bin, abi, provider, configurable);
        setBurnerWalletAddress(pred.address.toString());

        setPredicate(pred);
        setPubKey(pubkeyArray);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
      }); 
  }

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const addr = e.target.address.value;
    const amount = e.target.amount.value;
    send(addr, amount);
  }

  async function checkConnection() {
    if (window.fuel) {
      const isConnected = await window.fuel.isConnected();
      if (isConnected) {
        const [account] = await window.fuel.accounts();
        setAccount(account);
        setConnected(true);
      }
    }
  }

  if (!loaded) return null

  return (
    <>
      <div className="App">
            <>
              <button style={buttonStyle} onClick={btnRegBegin}>
              Create Burner Wallet
              </button><br />

              {burnerWalletAddress &&
                  <div>
                    <p>Burner Wallet Address:</p> 
                    <p>{burnerWalletAddress}</p>
                  </div>
              }

              <button style={buttonStyle} onClick={fundPredicate}>
              Fund burner wallet (in order to test)
              </button><br /><br />

              <form onSubmit={handleSubmit}>
                <input type="text" name = "address" placeholder ="destination address" /><br /><br />
                <input type="number" id="amount" name="amount" min="1" placeholder ="transfer amount"></input><br />
              <button style={buttonStyle}><br />
              Send funds
              </button>
              </form>
            </>
      </div>
    </>
  );
}

export default App;

const buttonStyle = {
  borderRadius: "48px",
  marginTop: "10px",
  backgroundColor: "#03ffc8",
  fontSize: "20px",
  fontWeight: "600",
  color: "rgba(0, 0, 0, .88)",
  border: "none",
  outline: "none",
  height: "60px",
  width: "400px",
  cursor: "pointer"
}
