import React, { useEffect, useState } from "react";
import "@fuel-wallet/sdk";
import "./App.css";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Account, JsonFlatAbi, NativeAssetId, Predicate, Provider, Wallet, WalletLocked, WalletUnlocked, getRandomB256, hexlify } from "fuels";
import { PredicateAbi__factory } from './types';


function App() {
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
  
  return (
    <>
      <div className="App">
            <>
              <button style={buttonStyle} onClick={btnRegBegin}>
              Register
              </button>

              <button style={buttonStyle} onClick={btnAuthBegin}>
              Authenticate
              </button>

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
