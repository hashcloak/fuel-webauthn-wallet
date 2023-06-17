# Fuel Webauthn Wallet

Simple webapp that has a connection with the Fuel blockchain (Wallet in browser and predicate loaded) & webauthn integrated.

## Description of current functionality (Fuel side)

There is a smart contract deployd on beta-3 testnet (id = 0xc433fa483a6b91c1e48f84c648ee00b0bf469a38ed65c1cad595842ea3b0bf68), contract code can be found [here](https://github.com/hashcloak/fuel-crypto/blob/verifying_contract/contract/src/main.sw). 

Then there is a script that calls that smart contract. This is currently called from the frontend. 

The next step is to create a predicate that calls the script / verifies the script was executed successfully.

### Next steps

#### Make sure verification in script works 
The script is called correctly, as in the parameters have the right size and come from the correct origin. However, the signature verification fails. There might be an issue with data conversion as everything in the frontend is written differently than in Rust (script). 
This is an example of test values, but once again they are in Rust: https://github.com/hashcloak/fuel-crypto/blob/p256/testing/p256_tests/verifying_test/tests/harness.rs#L155
Note: with these test values directly used in the script, verification passes

#### Create Predicate

The predicate will represent the Burner address and should call the script / make sure the script was executed successfully. 

#### Use of Fuel wallet

With this setup, a Fuel wallet is required (for loading Contract and Script). Is there a way around this? Is this functionality OK?

## App Functionality

- Connect Fuel Wallet; this is necessary to instantiate the Script that is used
- Create Burner Wallet; does WebAuthn registration + instantiates script with created public key
- Send funds; does WebAuthn authentication + call the main function on the script with the signature received from WebAuthn. Since the script needs the contract, also the contract is loaded in this step. 

For loading both script and contract a Fuel wallet is required. When the Fuel wallet extension is added to the browser, a request for connection pops up at the first time of running. 

## Codebase explanation + instructions

The (WIP!) codebase consists of several parts:
- predicate; this has to be updated. The original idea was to do verification directly in the script but that is too heavy of an operation at this moment for a predicate to take. So it will be changed to calling the contract. Folder p256 was added initially to have direct access to the necessary cryptography, but will probably not be necessary
script; calls the smart contract deployed on beta-3 testnet, additionally does a check that the set (configurable) pubkey is the same as the one of the signature
- server; this is where the calls to webauthn live. Absolutely not production ready, it even has some hardcoded `expectedOrigin`s. This does registration and authentication, following an example repo
- frontend; the visual part that ties it all together. Calls both the server that does WebAuthn stuff & creates the predicate that is the burner wallet

<!-- ### 1a. Predicate code

THIS WAS SOLUTION OPTION A, WHICH DOESN'T WORK WITH CURRENT STATE OF ECOSYSTEM.

Reference [here](https://fuellabs.github.io/fuels-ts/guide/predicates/). Build the predicate:

```
cd predicate
forc build
```

Then generate the necessary files for the frontend based on the predicate:
```
cd ../frontend
npm install
npx fuels typegen -i ../**/**/*-abi.json  -o ./src/types --predicate
```

Make sure that in `frontend/src/types/index.ts` only 1 line similar to:
`
export { PredicateAbi__factory } from './factories/PredicateAbi__factory';
`
exists. Remove any redundant lines.  -->

### 1. Script code

Solution B: have the verification in a smart contract, and let the script call the verification function. The predicate should use/verify execution of script. 

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

### 2. WebAuthn Server

Example code: https://github.com/MasterKale/SimpleWebAuthn/tree/master/example

This server code expects the frontend to run on port 3000. If this is not the case, change the hardcoded `expectedOrigin` in `server/src/index.ts`. 

```
cd server
npm install
npm start
```

### 3. Frontend

Tutorial: https://fuelbook.fuel.network/master/quickstart/frontend.html

Needs to run on fuels >= 0.42.0.

Make sure that the typings for the script have been generated and that in `frontend/src/script_types/index.ts` only 1 `ScriptAbi__factory` is exported. 
Furthermore, the server must be running on 127.0.0.1:8000, if it is somewhere else, this has to be adjusted in `frontend/package.json`, specifically `"proxy": "http://127.0.0.1:8000"`. 

Open the app in a browser where the Fuel wallet extension has been added and WebAuthn is supported. Open the console in the Developer Tools to see additional messages. 

```
cd frontend
# npm install <-- this has probably already been run in a previous step
npm start
```
