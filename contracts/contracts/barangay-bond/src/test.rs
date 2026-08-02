#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

#[test]
fn test_barangay_bond_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // Register Token contract (mock token)
    let admin_user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = sac.address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);
    let token_token_client = token::Client::new(&env, &token_id);

    // Register BarangayBond contract using latest API
    let contract_id = env.register(BarangayBondContract, ());
    let client = BarangayBondContractClient::new(&env, &contract_id);

    // Initialize contract
    client.initialize(&admin_user, &token_id);

    // Create test accounts
    let sk_official = Address::generate(&env);
    let youth_1 = Address::generate(&env);
    let youth_2 = Address::generate(&env);

    // Admin verifies roles
    client.verify_sk_official(&sk_official, &true);
    client.verify_resident(&youth_1, &true);
    client.verify_resident(&youth_2, &true);

    assert!(client.is_sk_official(&sk_official));
    assert!(client.is_resident_verified(&youth_1));
    assert!(client.is_resident_verified(&youth_2));

    // Mint tokens to SK official for budget locking
    let initial_balance = 1000i128;
    token_client.mint(&sk_official, &initial_balance);
    assert_eq!(token_token_client.balance(&sk_official), initial_balance);

    // Create Project
    let project_name = String::from_str(&env, "Community Center WiFi");
    let project_desc = String::from_str(&env, "Free high-speed WiFi for youth");
    let project_budget = 400i128;

    let project_id = client.create_project(&sk_official, &project_name, &project_budget, &project_desc);
    assert_eq!(project_id, 1);
    assert_eq!(client.get_project_count(), 1);

    // Escrow checks:
    // Original balance = 1000
    // Locked budget = 400 (locked in contract) -> SK Official has 600
    // Released Phase 1 mobilization fund (50%) = 200 -> SK Official gets 200 back, total 800
    // Contract has remaining 200 (50%) as escrow
    assert_eq!(token_token_client.balance(&sk_official), 800i128);
    assert_eq!(token_token_client.balance(&contract_id), 200i128);

    let proj = client.get_project(&project_id);
    assert_eq!(proj.name, project_name);
    assert_eq!(proj.creator, sk_official);
    assert_eq!(proj.status, 0); // Phase1Released
    assert_eq!(proj.milestone_1_status, 0); // PendingProof

    // SK Official submits milestone 1 proof
    let proof_url = String::from_str(&env, "https://ipfs.io/ipfs/QmSomeHash");
    client.submit_milestone_proof(&sk_official, &project_id, &1, &proof_url);

    let proj = client.get_project(&project_id);
    assert_eq!(proj.status, 1); // Milestone1ProofUploaded
    assert_eq!(proj.milestone_1_status, 1); // PendingApproval
    assert_eq!(proj.milestone_1_proof, proof_url);

    // Youth vote
    client.vote_milestone(&youth_1, &project_id, &1, &true);
    let proj = client.get_project(&project_id);
    assert_eq!(proj.milestone_1_votes_approve, 1);
    assert_eq!(proj.status, 1); // Not fully approved yet (needs 2 approvals)

    // Second youth votes approval -> triggers budget release and project completion
    client.vote_milestone(&youth_2, &project_id, &1, &true);
    let proj = client.get_project(&project_id);
    assert_eq!(proj.milestone_1_votes_approve, 2);
    assert_eq!(proj.milestone_1_status, 2); // Approved
    assert_eq!(proj.status, 2); // Approved & Completed

    // Check balances after Phase 2 release
    // Contract transfers remaining 200 to SK official
    // SK Official total = 800 + 200 = 1000
    // Contract balance = 0
    assert_eq!(token_token_client.balance(&sk_official), 1000i128);
    assert_eq!(token_token_client.balance(&contract_id), 0i128);
}
