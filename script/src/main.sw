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


configurable {
    PUBKEY: [u8; 64] = [0u8; 64]
}

pub fn bytes_to_u64s(bytes: [u8; 32]) -> [u64;4] {
    // Scalar: ls: [u64; 4] is in little endian
    let mut i = 0;
    let mut j = 4;
    let mut u64s: [u64;4] = [0;4];
    while i < 32 {
      u64s[j-1] = (bytes[i + 0] << 56)
        .binary_or(bytes[i + 1] << 48)
        .binary_or(bytes[i + 2] << 40)
        .binary_or(bytes[i + 3] << 32)
        .binary_or(bytes[i + 4] << 24)
        .binary_or(bytes[i + 5] << 16)
        .binary_or(bytes[i + 6] << 8)
        .binary_or(bytes[i + 7]);
      j -= 1;
      i += 8;
    }
    u64s
}

pub fn decompose(val: b256) -> (u64, u64, u64, u64) {
  asm(r1: __addr_of(val)) { r1: (u64, u64, u64, u64) }
}

abi P256SignatureVerification {
  #[storage()]
  fn verify_signature(pubkey: PublicKey, sign: Signature, msg: b256) -> bool;
}

fn get_pubkey() -> PublicKey {
    let mut pub_x_bytes = [0u8;32];
    let mut pub_y_bytes = [0u8;32];

    let mut i = 0; 
    while i < 32 {
        pub_x_bytes[i] = PUBKEY[i];
        pub_y_bytes[i] = PUBKEY[i+32];
        i = i + 1;
    }

    let pub_x = FieldElement{ls: bytes_to_u64s(pub_x_bytes)};
    let pub_y = FieldElement{ls: bytes_to_u64s(pub_y_bytes)};

    let public_key = AffinePoint{x: pub_x, y: pub_y, infinity: 0};
    PublicKey { point: public_key }
}

fn main(pubkey: [u8; 64], r: b256, s: b256, msg: b256) -> bool {
  // check pubkey is equal to PUBKEY
    let mut i = 0; 
    while i < 64 {
        assert(PUBKEY[i] == pubkey[i]);
        i = i + 1;
    }

    let (r0, r1, r2, r3) = decompose(r);
    let (s0, s1, s2, s3) = decompose(s);
    let r_scalar = Scalar { ls: [r3, r2, r1, r0] };
    let s_scalar = Scalar { ls: [s3, s2, s1, s0] };
    let sign = Signature { r: r_scalar, s: s_scalar };

    let contract_address = 0xc433fa483a6b91c1e48f84c648ee00b0bf469a38ed65c1cad595842ea3b0bf68;
    let caller = abi(P256SignatureVerification, contract_address);

    return caller.verify_signature{gas: 500000000}(get_pubkey(), sign, msg);
}