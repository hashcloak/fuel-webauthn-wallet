import React, { useEffect, useState } from "react";
import "@fuel-wallet/sdk";
import "./App.css";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Account, Address, JsonFlatAbi, NativeAssetId, Predicate, Provider, Wallet, WalletLocked, WalletUnlocked, getRandomB256, hexlify } from "fuels";
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

  //to use the predicate in different async functions.
  let pred: any;
  let pubKey: any;

  async function fundPredicate() {
    if (window.fuel) {
     try {
        await window.fuel.connect();
        const [account] = await window.fuel.accounts();
        const wallet = await window.fuel!.getWallet(account);
        // Fund the predicate
        const response1 = await wallet.transfer(pred.address, 10000, NativeAssetId, {
          gasLimit: 164,
          gasPrice: 1,
        });
        await response1.wait();
        console.log("predicateAddress from fundPredicate: " + pred.address);
        setAccount(account);
        setConnected(true);
     } catch(err) {
       console.log("error connecting: ", err);
     }
    }
   }

   async function send(addr: any) {
    const someAddress = Address.fromDynamicInput(addr);
    console.log(someAddress);

    if (window.fuel) {
     try {
      await window.fuel.connect();
        // Try to spend the funds in the predicate
        console.log(pred.address);
        const tx = await pred
          .setData(pubKey)
          .transfer(someAddress, 300, NativeAssetId, {
            gasLimit: 3000,
            gasPrice: 1,
          });
        await tx.waitForResult();

        setAccount(account);
        setConnected(true);
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
        const configurable = { PUBKEY: pubkeyArray };
        const { abi, bin } = PredicateAbi__factory;
        const predicate = new Predicate(bin, abi, provider, configurable);
        pred = predicate;
        pubKey = pubkeyArray;
        // set predicate data to be the same as the configurable constant
        predicate.setData(configurable.PUBKEY);

        console.log("Burner Wallet Address is: " + predicate.address);
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
  

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const addr = e.target.address.value;
    // console.log(addr);
    send(addr);
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
              Register
              </button><br />

              <button style={buttonStyle} onClick={btnAuthBegin}>
              Authenticate
              </button><br />

              <button style={buttonStyle} onClick={fundPredicate}>
              fundPredicate
              </button><br /><br />

              <form onSubmit={handleSubmit}><input type="text" name = "address" placeholder ="wallet address" /><br />
              <button style={buttonStyle}><br />
              send
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
