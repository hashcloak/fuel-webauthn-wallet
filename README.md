# Fuel Webauthn Wallet

This is a proof of concept that shows a "Burner wallet" could be created using a WebAuthn public key and transactions could be authorized using a WebAuthn signature. 

The current implementation can get a WebAuthn public key, which is set as a configurable constant in a script. Furthermore, it can verify a p256 signature obtained from WebAuthn through a script which calls a Smart Contract that runs verification. 

There is no Burner wallet address, or actual transfer of funds *yet*. See notes below on how this can be realized. 


## Note on implementation using a Predicate

The ideal version of this app uses a predicate that has a configurable constant set to the public key and does signature verification. This is not possible yet, due to large predicate bytecode that such functionality creates at the moment, see GitHub issue [here](https://github.com/FuelLabs/sway/issues/4631). 

An improved version of the current solution would also be to add a predicate into the mix; namely one that verifies the script of the transaction that is calling it. This can be added once we have a clear example of this, currently WIP according to [this forum post](https://forum.fuel.network/t/how-to-call-a-script-from-a-predicate/2771). 

In both cases, the burner wallet address would be the predicate address. Funds could be sent there and transfer of funds can be authorized using the WebAuthn signature. 

## Current architecture

There are several components to the current implementation:

- A simple frontend that uses WebAuthn. This is a React app using [simplewebauthn](https://github.com/MasterKale/SimpleWebAuthn/tree/master) library. The actions that can be done are Connect Fuel Wallet, Create Burner Wallet and Send funds. To create a burner wallet, at this moment it is still necessary to have and connect a Fuel wallet. This will change once the predicate support is added.
- A WebAuthn server, also using [simplewebauthn](https://github.com/MasterKale/SimpleWebAuthn/tree/master) library. Not production ready, it even has some hardcoded `expectedOrigin`s. This does registration and authentication, following the example repo
- p256 Sway library in [fuel-crypto](https://github.com/hashcloak/fuel-crypto/tree/p256) with all needed arithmetic to work with the p256 public key and signature that WebAuthn provides.
- A Smart Contract (in Sway) that does signature verification. This is deployed on beta-3 testnet (id = 0xc433fa483a6b91c1e48f84c648ee00b0bf469a38ed65c1cad595842ea3b0bf68), contract code can be found [here](https://github.com/hashcloak/fuel-crypto/blob/verifying_contract/contract/src/main.sw). 
- A Script (in Sway) that takes the signature obtained from WebAuthn and calls the Smart Contract for verification of the signature.

## App Functionality

- Connect Fuel Wallet; this is necessary to instantiate the Script & Smart Contract that are used
- Create Burner Wallet; does WebAuthn registration + instantiates script with created public key
- Send funds; does WebAuthn authentication + calls the main function on the script with the signature received from WebAuthn. Since the script needs the contract, also the contract is loaded in this step. The result if true or false, depending whether the signature could be verified

For loading both script and contract a Fuel wallet is required. When the Fuel wallet extension is added to the browser, a request for connection pops up at the first time of clicking Connect Fuel Wallet. 

## Build & Run

### 0. Update submodule

This repo uses the `p256` functionality of `fuel-crypto` library. 

```
git submodule update --init --recursive
```

### 1. Script code

Note: Tested with Sway version `0.39.1`.

Build the script:

```
cd script
forc build
```

Then generate the necessary files for the frontend based on the script:
```
cd ../frontend
npm install
npx fuels typegen -i ../**/**/script-abi.json  -o ./src/script_types --script
```

Make sure that in `frontend/src/script_types/index.ts` only 1 line similar to:
`
export { ScriptAbi__factory } from './factories/ScriptAbi__factory';
`
exists. Remove any redundant lines. 

Note that the script depends on the Smart Contract being deployed on beta-3 and uses a hardcoded address for that. Furthermore, the necessary `ContractAbi__factory` was generated and added to this repo. This can be repeated manually using the contract code [here](https://github.com/hashcloak/fuel-crypto/blob/verifying_contract/contract/src/main.sw). 

### 2. WebAuthn Server

Example code [here](https://github.com/MasterKale/SimpleWebAuthn/tree/master/example).

This server code expects the frontend to run on port 3000. If this is not the case, change the hardcoded `expectedOrigin` in `server/src/index.ts`. 

```
cd ../server
npm install
npm start
```

### 3. Frontend

Tutorial to create a frontend for Fuel [here](https://fuelbook.fuel.network/master/quickstart/frontend.html).

Note: needs to run on fuels >= `0.42.0`.

Make sure that the typings for the script have been generated and that in `frontend/src/script_types/index.ts` only 1 `ScriptAbi__factory` is exported. 
Furthermore, the server must be running on 127.0.0.1:8000, if it is somewhere else, this has to be adjusted in `frontend/package.json`, specifically `"proxy": "http://127.0.0.1:8000"`. 

Open the app in a browser where the Fuel wallet extension has been added and WebAuthn is supported. Open the console in the Developer Tools to see printed messages. 

```
cd ../frontend
# npm install <-- this has probably already been run in a previous step
npm start
```

### 4. Test steps

1. Click on Connect Fuel Wallet. Make sure to be running the webapp in a browser that has the Fuel Wallet extension. 
2. The Fuel Wallet extension opens up and asks for permission to connect. Accept this to continue. In the console (Developer tools) the message `Connected Fuel Wallet.` should pop up after connecting. 
3. Click on Create Burner wallet. This should open up a popup in the browser "Create a passkey for localhost". This is the registration process with WebAuthn and can be completed for example with a fingerprint. When succesfull `Registration successful`, the public key and `Script was created with pubkey` is printed to the console. 
4. Fill out a fuel address and a transfer amount, for now these are just dummy values which are not actually needed.
5. Click on Send funds. This should open up the WebAuthn popup in the browser once again and require authentication in the same way registration was done. 
6. After successful verification with WebAuthn, the Fuel Wallet extension opens up and requires approval. This is in order to call the script. 
7. Wait for a bit until the script was executed.
8. Upon completion the `FunctionInvocationResult` is printed to the console. In the `value`, the first of the `words` will give the boolean result of what was run in the script (0 or 1). Additionally, this value is read out and Verification signatur true of false is written to the console.

When repeating the steps, make sure to restart the `server` in between registrations. The server only supports 1 registration per device, but this can be adjusted in the `server` code. 