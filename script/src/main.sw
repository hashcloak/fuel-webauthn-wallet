// script;

// use p256::{
//     modular_helper::to_bytes,
//     field::FieldElement,
//     scalar::Scalar,
//     affine::AffinePoint,
//     ecdsa::Signature,
//     verifyingkey::{
//         PublicKey,
//         VerifyingKey,
//     }
// };

// configurable {
//     PUBKEY: [u8; 64] = [0u8; 64]
// }

// pub struct signature_bytes {
//     msg: b256,
//     r: b256,
//     s: b256,
// }

// pub fn decompose(val: b256) -> (u64, u64, u64, u64) {
//   asm(r1: __addr_of(val)) { r1: (u64, u64, u64, u64) }
// }

// fn verify_msg(signature: Signature, verify_key: VerifyingKey, msg: b256) -> bool {
    
// // returns bytes in big endian
//     let (l0, l1, l2, l3) = decompose(msg);
//     let mut res: [u8;32] = [0u8;32];
//     let reduced: [u64;4] = [l3, l2, l1, l0];
//     let mut i = 4;
//     let mut j = 0;
//     while j < 32 {
//         i -= 1; // to prevent overflow at last run
//         res[j] = reduced[i] >> 56;
//         res[j + 1] = reduced[i] >> 48;
//         res[j + 2] = reduced[i] >> 40;
//         res[j + 3] = reduced[i] >> 32;
//         res[j + 4] = reduced[i] >> 24;
//         res[j + 5] = reduced[i] >> 16;
//         res[j + 6] = reduced[i] >> 8;
//         res[j + 7] = reduced[i];        
//         j += 8;
//     }

//     let result = VerifyingKey::verify_prehash_with_pubkey(verify_key, res, signature);
    
//     result
// }

//   fn verify_signature(pubkey: PublicKey, sign: Signature, msg: b256) -> bool {
//     let vk = VerifyingKey {
//         inner: pubkey,
//     };
//     let mut verified = false;
//     verified = verify_msg(sign, vk, msg);

//     verified
//   }

//   fn main(pubkey: PublicKey, sign: Signature, msg: b256) -> bool {
//     return verify_signature(pubkey, sign, msg);
//   }

// Above one runs into error without details
/*
error connecting:  Error
    at new A (config-98500486.js:507:172909)
    at t.<anonymous> (config-98500486.js:507:176725)
    at h (config-98500486.js:507:175218)
    at Object.next (config-98500486.js:507:174501)
    at c (config-98500486.js:507:174059)
*/

script;

use p256::{
    modular_helper::to_bytes,
    field::FieldElement,
    scalar::Scalar,
    affine::AffinePoint,
    ecdsa::Signature,
    verifyingkey::{
        PublicKey,
        VerifyingKey,
    }
};

use std::constants::ZERO_B256;
use std::logging::log;

abi P256SignatureVerification {
  #[storage()]
  fn verify_signature(pubkey: PublicKey, sign: Signature, msg: b256) -> bool;
}

fn main(pubkey: PublicKey, sign: Signature, msg: b256) -> u8 {
  log(pubkey.point.x.ls[0]);
  log(pubkey.point.x.ls[1]);
  log(msg);
  let t = 16602909452612575158;
  log(t);
  /*
40004070
66885643
2921
  */
  //"0x040eb5af56547c176b3bd2c3985fb71b8801e24dd152f30443eddd39a210c16a"

    // // With SHA-256, message = "sample":
    // // sha256 of "sample" af2bdbe1aa9b6ec1e2ade1d694f41fc71a831d0268e9891562113d8a62add1bf
    // let hash1 = 0xaf2bdbe1aa9b6ec1e2ade1d694f41fc71a831d0268e9891562113d8a62add1bf;
    // // [
    // //     175, 43, 219, 225, 170, 155, 110, 193, 226, 173, 225, 214, 148, 244, 31, 199, 26, 131,
    // //     29, 2, 104, 233, 137, 21, 98, 17, 61, 138, 98, 173, 209, 191,
    // // ];
    // let r1 = Scalar {
    //     ls: [
    //         14072920526640068374,
    //         11325576126734727569,
    //         1243237162801856982,
    //         17281590685529975037,
    //     ],
    // };
    // let s1 = Scalar {
    //     ls: [
    //         5603792056925998504,
    //         17575579964503225350,
    //         15291629082155065189,
    //         17855396570382826561,
    //     ],
    // };

    // // pubkey
    // let a = AffinePoint {
    //     x: FieldElement {
    //         ls: [
    //             16602909452612575158,
    //             13855808666783054444,
    //             14511138361138572648,
    //             6989257567681289521,
    //         ],
    //     },
    //     y: FieldElement {
    //         ls: [
    //             8620948056189575833,
    //             17505968991938453329,
    //             11825020959996820580,
    //             8720092648338668697,
    //         ],
    //     },
    //     infinity: 0,
    // };

    // let a = PublicKey { point: a };
    // let vk = VerifyingKey {
    //     inner: a,
    // };
    // let sign1 = Signature { r: r1, s: s1 };
      

    let contract_address = 0xc433fa483a6b91c1e48f84c648ee00b0bf469a38ed65c1cad595842ea3b0bf68;
    let caller = abi(P256SignatureVerification, contract_address);
    // let amount_to_send = 200;
    // let recipient_address = Address::from(0xefdd5488ca92730d3144648c0f3ee8e7cbca089681d07eb2586d55d80ce182a7);
    // if (caller.verify_signature{gas: 500000000}(a, sign1, hash1)) {
    if (caller.verify_signature{gas: 500000000}(pubkey, sign, msg)) {
      return 42;
    } else {
      return 21;
    }
}
