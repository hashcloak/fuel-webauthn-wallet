import React, { useEffect, useState } from "react";
import "@fuel-wallet/sdk";
import "./App.css";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Account, Address, JsonFlatAbi, NativeAssetId, Predicate, Provider, Wallet, WalletLocked, WalletUnlocked, getRandomB256, hexlify, hashMessage, arrayify, BN, bn, BigNumberish, Script, Contract, AbstractContract, ContractFactory } from "fuels";
import { PredicateAbi__factory } from './types';
import { AsnParser } from '@peculiar/asn1-schema';
import { ECDSASigValue } from '@peculiar/asn1-ecc';
import base64url from 'base64url';
// import { signature_bytesInput } from "./types/factories/PredicateAbi__factory";
// 
import { ContractAbi__factory } from "./contracts";
import { AffinePointInput, ContractAbi, FieldElementInput, PublicKeyInput, ScalarInput, SignatureInput } from "./contracts/ContractAbi";
import { VerifyPublicKeyInput, sign } from "crypto";
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

          let hash1 = '0xaf2bdbe1aa9b6ec1e2ade1d694f41fc71a831d0268e9891562113d8a62add1bf';
          // [
          //   175, 43, 219, 225, 170, 155, 110, 193, 226, 173, 225, 214, 148, 244, 31, 199, 26, 131,
          //   29, 2, 104, 233, 137, 21, 98, 17, 61, 138, 98, 173, 209, 191,
          // ];
          const x: FieldElementInput = {
            ls: [
                bn([182, 159, 242, 96, 46, 98, 105, 230]), // 16602909452612575158
                bn([230, 105, 98, 46, 96, 242, 159, 182]), // 16602909452612575158 THIS WORKS
                // bn([108, 250, 97, 59, 146, 184, 73, 192]), //13855808666783054444
                bn([104, 109, 53, 198, 116, 235, 97, 201]),//14511138361138572648,
                bn([49, 157, 90, 37, 186, 212, 254, 96])//6989257567681289521,
            ],
          };
          const y: FieldElementInput = {
            ls: [
              bn([153, 34, 70, 212, 148, 194, 163, 119]), //8620948056189575833
              bn([81, 159, 126, 45, 12, 178, 241, 242]), //17505968991938453329
              bn([100, 188, 40, 86, 233, 233, 26, 164]), //11825020959996820580
              bn([153, 188, 184, 8, 16, 254, 3, 121]) //8720092648338668697
            ],
          };
          const a: AffinePointInput = {
            x: x, y: y, infinity: 0
          };
          const p: PublicKeyInput = {
            point: a
          };
          const vk = {
            inner: p,
          };
  
          let r1 : ScalarInput = {
            ls: [
              bn([22, 55, 175, 78, 168, 14, 77, 195]),//14072920526640068374
              bn([145, 249, 170, 86, 123, 135, 44, 157]),//11325576126734727569
              bn([214, 129, 94, 212, 156, 221, 64, 17]),//1243237162801856982
              bn([253, 168, 182, 172, 42, 139, 212, 239])//17281590685529975037
            ],
          };
          let s1 : ScalarInput = {
              ls: [
                bn([168, 205, 58, 132, 47, 171, 196, 77]),//5603792056925998504
                bn([6, 244, 175, 185, 219, 0, 233, 243]),//17575579964503225350
                bn([101, 159, 226, 182, 161, 199, 54, 212]),//15291629082155065189
                bn([65, 124, 101, 45, 148, 28, 203, 247])//17855396570382826561
              ],
          };
          let sign1 : SignatureInput = { r: r1, s: s1 };
          //old params p, sign1, msg
          const res = await script!.functions.main(p, sign1, msg)
              .txParams({ gasPrice: 1, gasLimit: 500000000})
              .addContracts([contract! as Contract])
              .call();
          // console.log(value); //42,0,0 WORKS!!!!
          // So what works now is calling a script that calls the contract CONTINUE HERE
          console.log(res);

          // const tx = await predicate!.
          //   setData(pubKey).
          //   transfer(inputAddress, amount, NativeAssetId, {gasPrice: 1});
          // const result = await tx.waitForResult();

          // if (result.status.type =='success') {
          //   console.log('success');
          // } else {
          //   console.log('fail');
          // }

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

        // USING PREDICATE
        // Create Burner Wallet
        // const provider = new Provider('https://beta-3.fuel.network/graphql');
        // setProvider(provider);
        // const configurable = { PUBKEY: pubkeyArray };
        // const { abi, bin } = PredicateAbi__factory;
        // const pred = new Predicate(bin, abi, provider, configurable);

        // setBurnerWalletAddress(pred.address.toString());

        // setPredicate(pred);
        // setPubKey(pubkeyArray);
        if (window.fuel) {

          const wallet = await window.fuel.getWallet(account);

          // CREATE SCRIPT
          const provider = new Provider('https://beta-3.fuel.network/graphql');
          setProvider(provider);
          const configurable = { PUBKEY: pubkeyArray };
          const { abi, bin } = ScriptAbi__factory;
          const script = new Script(bin, abi, wallet);
          // script.setConfigurableConstants(configurable);
          
          console.log(script.functions);

          // THIS IS WRONG, IT JUST TAKES THE SAME WALLET ADDRESS
          setBurnerWalletAddress(wallet.address.toString());

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

  async function connectContract() {
    if (window.fuel) {
      const wallet = await window.fuel.getWallet(account);
      const contract = ContractAbi__factory.connect(CONTRACT_ID, wallet);
      
      setContract(contract);
      console.log('Contract connected')

      let hash1 = '0xaf2bdbe1aa9b6ec1e2ade1d694f41fc71a831d0268e9891562113d8a62add1bf';
      // [
      //   175, 43, 219, 225, 170, 155, 110, 193, 226, 173, 225, 214, 148, 244, 31, 199, 26, 131,
      //   29, 2, 104, 233, 137, 21, 98, 17, 61, 138, 98, 173, 209, 191,
      // ];

      // TODO How to get the right values here?
      const fe_x: FieldElementInput = {
        ls: [
            bn([182, 159, 242, 96, 46, 98, 105, 230]), // 16602909452612575158
            bn([108, 250, 97, 59, 146, 184, 73, 192]), //13855808666783054444
            bn([104, 109, 53, 198, 116, 235, 97, 201]),//14511138361138572648,
            bn([49, 157, 90, 37, 186, 212, 254, 96])//6989257567681289521,
        ],
      };
      const fe_y: FieldElementInput = {
        ls: [
          bn([153, 34, 70, 212, 148, 194, 163, 119]), //8620948056189575833
          bn([81, 159, 126, 45, 12, 178, 241, 242]), //17505968991938453329
          bn([100, 188, 40, 86, 233, 233, 26, 164]), //11825020959996820580
          bn([153, 188, 184, 8, 16, 254, 3, 121]) //8720092648338668697
        ],
      };
      const a: AffinePointInput = {
        x: fe_x, y: fe_y, infinity: 0
      };
      const pubkey: PublicKeyInput = {
        point: a
      };
      const vk = {
        inner: pubkey,
      };

      let r1 : ScalarInput = {
        ls: [
          bn([22, 55, 175, 78, 168, 14, 77, 195]),//14072920526640068374
          bn([145, 249, 170, 86, 123, 135, 44, 157]),//11325576126734727569
          bn([214, 129, 94, 212, 156, 221, 64, 17]),//1243237162801856982
          bn([253, 168, 182, 172, 42, 139, 212, 239])//17281590685529975037
        ],
      };
      let s1 : ScalarInput = {
          ls: [
            bn([168, 205, 58, 132, 47, 171, 196, 77]),//5603792056925998504
            bn([6, 244, 175, 185, 219, 0, 233, 243]),//17575579964503225350
            bn([101, 159, 226, 182, 161, 199, 54, 212]),//15291629082155065189
            bn([65, 124, 101, 45, 148, 28, 203, 247])//17855396570382826561
          ],
      };
      let sign1 : SignatureInput = { r: r1, s: s1 };
      
      try {
        let res = await contract.functions.verify_signature(pubkey, sign1, hash1).txParams({ gasPrice: 1, gasLimit: 500000000}).call();
        console.log('signature verified called');
        console.log(res);
      } catch(err) {
        console.log("error sending transaction...", err);
        /*error sending transaction... Error: Expected returnReceipt

        {
          "doc": "https://docs.rs/fuel-asm/latest/fuel_asm/enum.PanicReason.html#variant.OutOfGas",
          "reason": "OutOfGas"
        }

        Receipts:
        [
          {
            "type": "Call",
            "from": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "to": "0xc433fa483a6b91c1e48f84c648ee00b0bf469a38ed65c1cad595842ea3b0bf68",
            "amount": "0x0",
            "assetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "gas": "0xbebbf8a",
            "param1": "0x9ee5b619",
            "param2": "0x3868",
            "pc": "0x43f8",
            "is": "0x43f8"
          },
          {
            "type": "Panic",
            "id": "0xc433fa483a6b91c1e48f84c648ee00b0bf469a38ed65c1cad595842ea3b0bf68",
            "reason": "0x22d4d2450000000",
            "pc": "0xe63f4",
            "is": "0x43f8",
            "contractId": "0x0000000000000000000000000000000000000000000000000000000000000000"
          },
          {
            "type": "ScriptResult",
            "result": "0x2",
            "gasUsed": "0xbebc0c5"
          }
        ]
        */
      }
    } else {
      console.log('No wallet connected')
    }
  }

  if (!loaded) return null

  return (
    <>
      <div className="App">
            <>
              <button style={buttonStyle} onClick={connect}>Connect Fuel Wallet</button>

              <button style={buttonStyle} onClick={connectContract}>Connect Contract</button>

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
