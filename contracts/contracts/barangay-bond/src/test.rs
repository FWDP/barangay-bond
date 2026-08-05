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

#[test]
fn test_barangay_bond_rejection_and_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let admin_user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = sac.address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);
    let token_token_client = token::Client::new(&env, &token_id);

    let contract_id = env.register(BarangayBondContract, ());
    let client = BarangayBondContractClient::new(&env, &contract_id);

    client.initialize(&admin_user, &token_id);

    let sk_official = Address::generate(&env);
    let youth_1 = Address::generate(&env);
    let youth_2 = Address::generate(&env);

    client.verify_sk_official(&sk_official, &true);
    client.verify_resident(&youth_1, &true);
    client.verify_resident(&youth_2, &true);

    // Mint tokens
    token_client.mint(&sk_official, &1000i128);

    // Create Project
    let project_name = String::from_str(&env, "Community Gym Refurbish");
    let project_desc = String::from_str(&env, "Buying basketball hoops");
    let project_budget = 400i128;

    let project_id = client.create_project(&sk_official, &project_name, &project_budget, &project_desc);

    // Initial project creation splits budget:
    // SK official balance = 1000 - 400 + 200 = 800
    // Contract balance = 200
    assert_eq!(token_token_client.balance(&sk_official), 800i128);
    assert_eq!(token_token_client.balance(&contract_id), 200i128);

    // SK Official submits milestone 1 proof
    let proof_url = String::from_str(&env, "https://ipfs.io/ipfs/GymProof");
    client.submit_milestone_proof(&sk_official, &project_id, &1, &proof_url);

    // Youth reject the milestone
    client.vote_milestone(&youth_1, &project_id, &1, &false);
    client.vote_milestone(&youth_2, &project_id, &1, &false);

    let proj = client.get_project(&project_id);
    assert_eq!(proj.milestone_1_status, 3); // Rejected

    // SK official claims refund for remaining escrow
    client.refund_project(&sk_official, &project_id);

    // Balances checked:
    // Contract returns 200 to SK official.
    // SK official total = 800 + 200 = 1000
    // Contract balance = 0
    assert_eq!(token_token_client.balance(&sk_official), 1000i128);
    assert_eq!(token_token_client.balance(&contract_id), 0i128);

    let proj = client.get_project(&project_id);
    assert_eq!(proj.status, 3); // Refunded
}

#[test]
#[should_panic(expected = "Caller is not the project creator")]
fn test_unauthorized_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let admin_user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = sac.address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register(BarangayBondContract, ());
    let client = BarangayBondContractClient::new(&env, &contract_id);
    client.initialize(&admin_user, &token_id);

    let sk_official = Address::generate(&env);
    let malicious_sk = Address::generate(&env);
    let youth_1 = Address::generate(&env);
    let youth_2 = Address::generate(&env);

    client.verify_sk_official(&sk_official, &true);
    client.verify_sk_official(&malicious_sk, &true);
    client.verify_resident(&youth_1, &true);
    client.verify_resident(&youth_2, &true);

    token_client.mint(&sk_official, &1000i128);

    let project_name = String::from_str(&env, "Community Gym");
    let project_desc = String::from_str(&env, "Basketball");
    let project_budget = 400i128;

    let project_id = client.create_project(&sk_official, &project_name, &project_budget, &project_desc);

    let proof_url = String::from_str(&env, "https://ipfs.io/ipfs/GymProof");
    client.submit_milestone_proof(&sk_official, &project_id, &1, &proof_url);

    // Reject project
    client.vote_milestone(&youth_1, &project_id, &1, &false);
    client.vote_milestone(&youth_2, &project_id, &1, &false);

    // Malicious SK tries to call refund (should panic)
    client.refund_project(&malicious_sk, &project_id);
}

#[test]
#[should_panic(expected = "Already voted on this milestone")]
fn test_double_voting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin_user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = sac.address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register(BarangayBondContract, ());
    let client = BarangayBondContractClient::new(&env, &contract_id);
    client.initialize(&admin_user, &token_id);

    let sk_official = Address::generate(&env);
    let youth_1 = Address::generate(&env);

    client.verify_sk_official(&sk_official, &true);
    client.verify_resident(&youth_1, &true);

    token_client.mint(&sk_official, &1000i128);

    let project_name = String::from_str(&env, "Community Gym");
    let project_desc = String::from_str(&env, "Basketball");
    let project_budget = 400i128;

    let project_id = client.create_project(&sk_official, &project_name, &project_budget, &project_desc);

    let proof_url = String::from_str(&env, "https://ipfs.io/ipfs/GymProof");
    client.submit_milestone_proof(&sk_official, &project_id, &1, &proof_url);

    // Vote once
    client.vote_milestone(&youth_1, &project_id, &1, &true);
    // Vote again (should panic)
    client.vote_milestone(&youth_1, &project_id, &1, &true);
}

#[test]
#[should_panic(expected = "Milestone 1 is not pending approval")]
fn test_vote_after_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let admin_user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = sac.address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register(BarangayBondContract, ());
    let client = BarangayBondContractClient::new(&env, &contract_id);
    client.initialize(&admin_user, &token_id);

    let sk_official = Address::generate(&env);
    let youth_1 = Address::generate(&env);
    let youth_2 = Address::generate(&env);

    client.verify_sk_official(&sk_official, &true);
    client.verify_resident(&youth_1, &true);
    client.verify_resident(&youth_2, &true);

    token_client.mint(&sk_official, &1000i128);

    let project_name = String::from_str(&env, "Community Gym");
    let project_desc = String::from_str(&env, "Basketball");
    let project_budget = 400i128;

    let project_id = client.create_project(&sk_official, &project_name, &project_budget, &project_desc);

    let proof_url = String::from_str(&env, "https://ipfs.io/ipfs/GymProof");
    client.submit_milestone_proof(&sk_official, &project_id, &1, &proof_url);

    // Reject project
    client.vote_milestone(&youth_1, &project_id, &1, &false);
    client.vote_milestone(&youth_2, &project_id, &1, &false);

    // Refund
    client.refund_project(&sk_official, &project_id);

    // Try voting again (should panic)
    client.vote_milestone(&youth_1, &project_id, &1, &true);
}
