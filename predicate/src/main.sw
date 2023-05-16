predicate;

configurable {
    PUBKEY: [u8; 72] = [0u8; 72]
}

// TODO this should verify signature for pubkey
fn main(pubkey: [u8; 72]) -> bool {
    PUBKEY[0] == pubkey[0]
}
