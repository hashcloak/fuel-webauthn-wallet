import React, { useEffect, useState } from "react";
import "@fuel-wallet/sdk";
import "./App.css";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Address, NativeAssetId, Predicate, Provider, Wallet, hexlify, hashMessage, arrayify, Script, Contract } from "fuels";
import { AsnParser } from '@peculiar/asn1-schema';
import { ECDSASigValue } from '@peculiar/asn1-ecc';
import base64url from 'base64url';
// import { signature_bytesInput } from "./types/factories/PredicateAbi__factory";
// 
import { ContractAbi, ContractAbi__factory } from "./contracts";
import { ScriptAbi__factory } from "./script_types";

// The address of the contract deployed the Fuel testnet
const CONTRACT_ID =
  "0xc433fa483a6b91c1e48f84c648ee00b0bf469a38ed65c1cad595842ea3b0bf68";


function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [pubKey, setPubKey] = useState<any[]>();
  const [predicate, setPredicate] = useState<Predicate<any>>();
  const [script, setScript] = useState<Script<any, any>>();
  const [contract, setContract] = useState<ContractAbi>();
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

  async function connect() {
    if (window.fuel) {
     try {
       await window.fuel.connect();
       const [account] = await window.fuel.accounts();
       setAccount(account);
       setConnected(true);
     } catch(err) {
       console.log("error connecting: ", err);
     }
    }
   }

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

    console.log(msg_string);
    console.log(r_string);
    console.log(s_string);
    /*
    0xd489d2839a0521a1094dd62eef579a3571169e14961d25899efc008738951dd0
    0x4728bed0f88c1a7b46c192dff9a81098c4795b77a5d92bf2a8c564336a5994eb
    0xb49cf2e3ab2ba820c2b229025ec8102a2ad74b94e81ed3d38ca674ec77cfabc2
    */

    if (window.fuel) {
     try {
      await window.fuel.connect();
      // Invoke script
        if (script) {
          // FYI 
          // u64 = 16602909452612575158
          // equals bn([230, 105, 98, 46, 96, 242, 159, 182])
          
          const wallet = await window.fuel.getWallet(account);
          const contract = ContractAbi__factory.connect(CONTRACT_ID, wallet);
      
          setContract(contract);
          console.log('Contract connected')

          const res = await script!.functions.main(pubKey, r_string, s_string, msg_string)
              .txParams({ gasPrice: 1, gasLimit: 500000000})
              .addContracts([contract! as Contract])
              .call();
          console.log(res);

          // TODO WHEN IT WORKS Check balance of someAddress was indeed increased
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

        if (window.fuel) {

          const wallet = await window.fuel.getWallet(account);

          // CREATE SCRIPT + SET PUBKEY
          const provider = new Provider('https://beta-3.fuel.network/graphql');
          setProvider(provider);
          const configurable = { PUBKEY: pubkeyArray };
          const { abi, bin } = ScriptAbi__factory;
          const script = new Script(bin, abi, wallet);
          script.setConfigurableConstants(configurable);
          
          console.log(script.functions);

          // TODO create predicate and let that be the burner address
          // The predicate calls the script or verifies that the script was executed
          // setBurnerWalletAddress();

          setScript(script);
          setPubKey(pubkeyArray);
        }
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

              {/* <button style={buttonStyle} onClick={fundPredicate}>
              Fund burner wallet (in order to test)
              </button><br /><br /> */}

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
