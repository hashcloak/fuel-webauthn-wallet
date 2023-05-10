import React, { useEffect, useState } from "react";
import "@fuel-wallet/sdk";
import "./App.css";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Account, NativeAssetId, Provider, Wallet, WalletLocked } from "fuels";
import { PredicateAbi__factory } from './types';


function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [account, setAccount] = useState<string>("");
  const [counter, setCounter] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    setTimeout(() => {
      checkConnection();
      setLoaded(true);
    }, 200)

  }, [connected])


  async function connect() {
    // Connect to testnet beta-3
    const provider = new Provider('https://beta-3.fuel.network/graphql');
    const predicate = PredicateAbi__factory.createInstance(provider);
    console.log(predicate.address.toB256());

    if (window.fuel) {
     try {
        await window.fuel.connect();
        const [account] = await window.fuel.accounts();
        const wallet = await window.fuel!.getWallet(account);
        // Fund the predicate
        const response1 = await wallet.transfer(predicate.address, 100000, NativeAssetId, {
          gasLimit: 164,
          gasPrice: 1,
        });
        await response1.wait();

        // Try to spend the funds in the predicate
        const walletBalanceBefore = await wallet.getBalance();
        console.log("walletBalanceBefore", walletBalanceBefore);

        const tx = await predicate
          .setData({has_account: true, total_complete: 100})
          .transfer(wallet.address, 30, NativeAssetId, {
            gasLimit: 3000,
            gasPrice: 1,
          });
        await tx.waitForResult();

        // This balance should be greater than "walletBalanceBefore", if the predicate was successfully spent
        const walletBalanceAfter = await wallet.getBalance();
        console.log("walletBalanceAfter", walletBalanceAfter);

        setAccount(account);
        setConnected(true);
     } catch(err) {
       console.log("error connecting: ", err);
     }
    }
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
        console.log(verificationJSON);
        if (verificationJSON && verificationJSON.verified) {
          console.log("Registration successful");
        } else {
          console.error("Registration failed");
        }
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
      }); 
  }

  async function btnAuthBegin() {

    const resp = await fetch('/generate-authentication-options');

    let asseResp;
    try {
      const opts = await resp.json();

      asseResp = await startAuthentication(opts);
    } catch (error) {
      throw error;
    }

    const verificationResp = await fetch('/verify-authentication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(asseResp),
    });

    const verificationJSON = await verificationResp.json();
    console.log(verificationJSON);
    if (verificationJSON && verificationJSON.verified) {
      console.log("Authentication successful");
    } else {
      console.error("Authentication failed");
    }

  }
  


  if (!loaded) return null
  
  return (
    <>
      <div className="App">
        {
          connected ? (
            <>

              <button style={buttonStyle} onClick={btnRegBegin}>
              Register
              </button>

              <button style={buttonStyle} onClick={btnAuthBegin}>
              Authenticate
              </button>

            </>
          ) : (
            <button style={buttonStyle} onClick={connect}>Connect</button>
          )
        }
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
