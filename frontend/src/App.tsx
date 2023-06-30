import React, { useEffect, useState } from "react";
import "@fuel-wallet/sdk";
import "./App.css";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Address, NativeAssetId, Provider, Wallet, hexlify, hashMessage, arrayify, Script, Contract } from "fuels";
import { AsnParser } from '@peculiar/asn1-schema';
import { ECDSASigValue } from '@peculiar/asn1-ecc';
import base64url from 'base64url';

import { ContractAbi, ContractAbi__factory } from "./contracts";
import { ScriptAbi__factory } from "./script_types";

// The address of the contract deployed the Fuel testnet
const CONTRACT_ID =
  "0xc433fa483a6b91c1e48f84c648ee00b0bf469a38ed65c1cad595842ea3b0bf68";


function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [pubKey, setPubKey] = useState<any[]>();
  const [script, setScript] = useState<Script<any, any>>();
  const [contract, setContract] = useState<ContractAbi>();
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [provider, setProvider] = useState<Provider>();
  // TODO: currently the Burner Wallet doesn't have an address, since a script doesn't have an address.
  // When a predicate can be connected to this workflow, the predicate address is the burner wallet address
  const [burnerWalletAddress, setBurnerWalletAddress] = useState<string>("");

  
  useEffect(() => {
    setTimeout(() => {
      checkConnection();
      setLoaded(true);
    }, 200)
  }, [connected])

  async function connect() {
    if (window.fuel) {
     try {
       await window.fuel.connect();
       const [account] = await window.fuel.accounts();
       setAccount(account);
       setConnected(true);
       console.log("Connected Fuel Wallet.")
     } catch(err) {
       console.log("error connecting: ", err);
     }
    }
   }

  // Register with WebAuthn, obtaining a public key
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

        // Extracting public key from COSE_Key-encoded ecc key
        // https://www.w3.org/TR/2021/REC-webauthn-2-20210408/ section 6.5.1.1
        let pubkeyArray = [];
        for (let i = 10; i < 42; i++) {
          pubkeyArray.push(verificationJSON.pubkey[i]);
        }
        for (let i = 45; i < 77; i++) {
          pubkeyArray.push(verificationJSON.pubkey[i]);
        }
        console.log("Public key: " + pubkeyArray);

        if (window.fuel) {

          const wallet = await window.fuel.getWallet(account);

          // CREATE SCRIPT + SET PUBKEY
          const provider = new Provider('https://beta-3.fuel.network/graphql');
          setProvider(provider);
          const configurable = { PUBKEY: pubkeyArray };
          const { abi, bin } = ScriptAbi__factory;
          const script = new Script(bin, abi, wallet);
          script.setConfigurableConstants(configurable);
          
          setScript(script);
          setPubKey(pubkeyArray);

          console.log("Script was created with pubkey.");
        }
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
      }); 
  }

  // Authenticate with WebAuthn, obtaining a signature 
  //   which is sent to the script for verification
  async function send(addr: any, amount: number) {
    const inputAddress = Address.fromDynamicInput(addr);
    const walletInputAddress = Wallet.fromAddress(inputAddress, provider);
    // Print destination wallet balance before transaction
    const initialBalance = await walletInputAddress.getBalance();
    console.log(initialBalance);

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

    const authResponse = await verificationResp.json();
    console.log(authResponse.verified);
    console.log(authResponse.hashedSignatureBase);
    
    if (authResponse.verified) {
      console.log("Authentication successful");
    } else {
      console.error("Authentication failed");
    }

    global.Buffer = global.Buffer || require('buffer').Buffer;
    const parsedSignature = AsnParser.parse(
      base64url.toBuffer(asseResp.response.signature),
      ECDSASigValue,
    ); 

    // decode the clientDataJSON into a utf-8 string
    const utf8Decoder = new TextDecoder('utf-8');
    const decodedClientData = utf8Decoder.decode(
      base64url.toBuffer(asseResp.response.clientDataJSON))

    // parse the string as an object
    const clientDataObj = JSON.parse(decodedClientData);

    //parsing the signature 
    let s = new Uint8Array(parsedSignature.s);
    let r = new Uint8Array(parsedSignature.r);

    let sig_r = [];
    if (r.byteLength == 33) {
        for (let i = 0; i < 32; i++) {
          sig_r.push(r[i+1]);
        }
    }
    
    else {
      for (let i = 0; i < 32; i++) {
        sig_r.push(r[i]);
      }
    }
    const r_string: string = hexlify(sig_r);

    let sig_s = [];
    if (s.byteLength == 33) {
        for (let i = 0; i < 32; i++) {
          sig_s.push(s[i+1]);
        }
    }
    else {
      for (let i = 0; i < 32; i++) {
        sig_s.push(s[i]);
      }
    }
    const s_string: string = hexlify(sig_s);

    const msg_hash = arrayify(hashMessage(clientDataObj.challenge));
    let msg = [];

    for (let i = 0; i < 32; i++) {
      msg.push(authResponse.hashedSignatureBase[i]);
    }
    const msg_string: string = hexlify(msg);

    console.log(msg_string);
    console.log(r_string);
    console.log(s_string);
    if (window.fuel) {
     try {
      await window.fuel.connect();
      // Invoke script for verification of signature
        if (script) {
          const wallet = await window.fuel.getWallet(account);
          const contract = ContractAbi__factory.connect(CONTRACT_ID, wallet);
      
          setContract(contract);
          console.log('Contract connected')

          const res = await script!.functions.main(pubKey, r_string, s_string, msg)
              .txParams({ gasPrice: 1, gasLimit: 500000000})
              .addContracts([contract! as Contract])
              .call();
          console.log(res);
          if (res.value.words[0] == 1) {
            console.log("Signature verification true");
          } else {
            console.log("Signature verification false");
          }

          // TODO when actual transfer of funds is added: Check balance of someAddress was indeed increased
          const destinationBalance = await walletInputAddress.getBalance(NativeAssetId);
          console.log(destinationBalance);
        }
     } catch(err) {
       console.log("error connecting: ", err);
     }
    }
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
              <button style={buttonStyle} onClick={connect}>Connect Fuel Wallet</button>

              <button style={buttonStyle} onClick={btnRegBegin}>
              Create Burner Wallet
              </button><br />

              {burnerWalletAddress &&
                  <div>
                    <p>Burner Wallet Address:</p> 
                    <p>{burnerWalletAddress}</p>
                  </div>
              }

              <br></br>

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
