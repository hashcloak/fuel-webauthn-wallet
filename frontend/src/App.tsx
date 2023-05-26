import React, { useEffect, useState } from "react";
import "@fuel-wallet/sdk";
import "./App.css";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Account, Address, JsonFlatAbi, NativeAssetId, Predicate, Provider, Wallet, WalletLocked, WalletUnlocked, getRandomB256, hexlify, hashMessage, arrayify } from "fuels";
import { PredicateAbi__factory } from './types';
import { AsnParser } from '@peculiar/asn1-schema';
import { ECDSASigValue } from '@peculiar/asn1-ecc';
import base64url from 'base64url';
import { signature_bytesInput } from "./types/factories/PredicateAbi__factory";

function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [pubKey, setPubKey] = useState<any[]>();
  const [predicate, setPredicate] = useState<Predicate<any>>();
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [provider, setProvider] = useState<Provider>();
  const [burnerWalletAddress, setBurnerWalletAddress] = useState<string>("");

  // const [msgHash, setMsgHash] = useState<any[]>();
  // const [sigR, setSigR] = useState<any[]>();
  // const [sigS, setSigS] = useState<any[]>();

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
        const response1 = await wallet.transfer(predicate!.address, 100000, NativeAssetId, {
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
    // console.log(verificationJSON);

    if (verificationJSON && verificationJSON.verified) {
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

    // console.log(clientDataObj);
    // console.log(clientDataObj.challenge);
    // console.log(hashMessage(clientDataObj.challenge));
    // console.log(arrayify(hashMessage(clientDataObj.challenge)));
    // console.log(new TextEncoder().encode(clientDataObj.challenge));
    // console.log(new Uint8Array(parsedSignature.r));
    // console.log(new Uint8Array(parsedSignature.s).byteLength);

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
      msg.push(msg_hash[i]);
    }
    const msg_string: string = hexlify(msg);

    //input to the predicate
    const predicateValidation: signature_bytesInput = {
      msg: msg_string,
      r: r_string,
      s: s_string,
    };

    if (window.fuel) {
     try {
      await window.fuel.connect();
        if (predicate) {
          const tx = await predicate!.
            setData(predicateValidation).
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

        // Extracting public key from COSE_Key-encoded ecc key
        // https://www.w3.org/TR/2021/REC-webauthn-2-20210408/ section 6.5.1.1
        let pubkeyArray = [];
        for (let i = 10; i < 42; i++) {
          pubkeyArray.push(verificationJSON.pubkey[i]);
        }
        for (let i = 45; i < 77; i++) {
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
