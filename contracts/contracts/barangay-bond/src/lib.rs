#![no_std]
use soroban_sdk::{contract, contractimpl, contractevent, contracttype, Address, Env, String, token};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    ProjectCount,
    Project(u32),
    IsYouth(Address),
    IsSK(Address),
    Voted(u32, u32, Address), // (project_id, milestone_index, voter)
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Project {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub budget: i128,
    pub creator: Address,
    pub milestone_1_proof: String,
    pub milestone_1_votes_approve: u32,
    pub milestone_1_votes_reject: u32,
    pub milestone_1_status: u32, // 0 = PendingProof, 1 = PendingApproval, 2 = Approved, 3 = Rejected
    pub milestone_2_proof: String,
    pub milestone_2_votes_approve: u32,
    pub milestone_2_votes_reject: u32,
    pub milestone_2_status: u32, // 0 = PendingProof, 1 = PendingApproval, 2 = Approved, 3 = Rejected
    pub status: u32, // 0 = Phase1Released, 1 = Milestone1ProofUploaded, 2 = Milestone1Approved (Phase2Released / Completed)
}

// Contract Events Definition
#[contractevent]
pub struct ResidentVerifiedEvent {
    #[topic]
    pub resident: Address,
    pub is_youth: bool,
}

#[contractevent]
pub struct SKOfficialVerifiedEvent {
    #[topic]
    pub official: Address,
    pub is_sk: bool,
}

#[contractevent]
pub struct ProjectCreatedEvent {
    #[topic]
    pub id: u32,
    #[topic]
    pub creator: Address,
    pub budget: i128,
}

#[contractevent]
pub struct MilestoneProofSubmittedEvent {
    #[topic]
    pub project_id: u32,
    pub milestone_index: u32,
    pub proof_url: String,
}

#[contractevent]
pub struct MilestoneVotedEvent {
    #[topic]
    pub project_id: u32,
    #[topic]
    pub voter: Address,
    pub approve: bool,
}

#[contractevent]
pub struct MilestoneApprovedEvent {
    #[topic]
    pub project_id: u32,
    pub milestone_index: u32,
    pub amount_released: i128,
}

#[contractevent]
pub struct MilestoneRejectedEvent {
    #[topic]
    pub project_id: u32,
    pub milestone_index: u32,
}

#[contract]
pub struct BarangayBondContract;

#[contractimpl]
impl BarangayBondContract {
    pub fn initialize(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::ProjectCount, &0u32);
    }

    pub fn verify_resident(env: Env, resident: Address, is_youth: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::IsYouth(resident.clone());
        env.storage().persistent().set(&key, &is_youth);
        bump_persistent(&env, &key);
        
        ResidentVerifiedEvent {
            resident: resident.clone(),
            is_youth,
        }.publish(&env);
    }

    pub fn verify_sk_official(env: Env, official: Address, is_sk: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::IsSK(official.clone());
        env.storage().persistent().set(&key, &is_sk);
        bump_persistent(&env, &key);

        SKOfficialVerifiedEvent {
            official: official.clone(),
            is_sk,
        }.publish(&env);
    }

    pub fn create_project(env: Env, sk_official: Address, name: String, budget: i128, description: String) -> u32 {
        sk_official.require_auth();

        let is_sk_key = DataKey::IsSK(sk_official.clone());
        bump_persistent(&env, &is_sk_key);
        let is_sk = env.storage().persistent().get(&is_sk_key).unwrap_or(false);
        if !is_sk {
            panic!("Caller is not a verified SK Official");
        }
        if budget <= 0 {
            panic!("Budget must be positive");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        // 1. Lock the budget in the contract escrow
        client.transfer(&sk_official, &env.current_contract_address(), &budget);

        // 2. Release 50% mobilization fund (Phase 1)
        let mobilization = budget / 2;
        if mobilization > 0 {
            client.transfer(&env.current_contract_address(), &sk_official, &mobilization);
        }

        let mut project_count: u32 = env.storage().instance().get(&DataKey::ProjectCount).unwrap();
        project_count += 1;
        env.storage().instance().set(&DataKey::ProjectCount, &project_count);

        let new_project = Project {
            id: project_count,
            name,
            description,
            budget,
            creator: sk_official.clone(),
            milestone_1_proof: String::from_str(&env, ""),
            milestone_1_votes_approve: 0,
            milestone_1_votes_reject: 0,
            milestone_1_status: 0, // PendingProof
            milestone_2_proof: String::from_str(&env, ""),
            milestone_2_votes_approve: 0,
            milestone_2_votes_reject: 0,
            milestone_2_status: 0, // PendingProof
            status: 0, // Phase1Released
        };

        let proj_key = DataKey::Project(project_count);
        env.storage().persistent().set(&proj_key, &new_project);
        bump_persistent(&env, &proj_key);
        
        ProjectCreatedEvent {
            id: project_count,
            creator: sk_official.clone(),
            budget,
        }.publish(&env);

        project_count
    }

    pub fn submit_milestone_proof(env: Env, sk_official: Address, project_id: u32, milestone_index: u32, proof_url: String) {
        sk_official.require_auth();

        let proj_key = DataKey::Project(project_id);
        bump_persistent(&env, &proj_key);
        let mut project: Project = env.storage().persistent().get(&proj_key).expect("Project not found");
        if project.creator != sk_official {
            panic!("Caller is not the project creator");
        }
        if milestone_index != 1 {
            panic!("Only Milestone 1 proof submission is supported in this version");
        }
        if project.status != 0 {
            panic!("Project is not in Phase 1 state");
        }
        if project.milestone_1_status != 0 {
            panic!("Milestone 1 proof already submitted or approved");
        }

        project.milestone_1_proof = proof_url.clone();
        project.milestone_1_status = 1; // PendingApproval
        project.status = 1; // Milestone1ProofUploaded

        env.storage().persistent().set(&proj_key, &project);
        
        MilestoneProofSubmittedEvent {
            project_id,
            milestone_index,
            proof_url,
        }.publish(&env);
    }

    pub fn vote_milestone(env: Env, voter: Address, project_id: u32, milestone_index: u32, approve: bool) {
        voter.require_auth();

        let voter_key = DataKey::IsYouth(voter.clone());
        bump_persistent(&env, &voter_key);
        let is_youth = env.storage().persistent().get(&voter_key).unwrap_or(false);
        if !is_youth {
            panic!("Voter is not a verified youth resident");
        }

        let proj_key = DataKey::Project(project_id);
        bump_persistent(&env, &proj_key);
        let mut project: Project = env.storage().persistent().get(&proj_key).expect("Project not found");
        if milestone_index != 1 {
            panic!("Only voting on Milestone 1 is supported");
        }
        if project.milestone_1_status != 1 {
            panic!("Milestone 1 is not pending approval");
        }

        let vote_key = DataKey::Voted(project_id, milestone_index, voter.clone());
        let has_voted = env.storage().persistent().get(&vote_key).unwrap_or(false);
        if has_voted {
            panic!("Already voted on this milestone");
        }

        if approve {
            project.milestone_1_votes_approve += 1;
        } else {
            project.milestone_1_votes_reject += 1;
        }

        env.storage().persistent().set(&vote_key, &true);
        bump_persistent(&env, &vote_key);
        
        MilestoneVotedEvent {
            project_id,
            voter: voter.clone(),
            approve,
        }.publish(&env);

        // Simple threshold: if we reach 2 approval votes, it releases remaining 50% funds.
        if project.milestone_1_votes_approve >= 2 {
            project.milestone_1_status = 2; // Approved
            project.status = 2; // Milestone 1 Approved (Completed)

            let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            let client = token::Client::new(&env, &token_addr);

            // Release Phase 2 funds (the remaining budget)
            let remaining_budget = project.budget - (project.budget / 2);
            client.transfer(&env.current_contract_address(), &project.creator, &remaining_budget);

            MilestoneApprovedEvent {
                project_id,
                milestone_index,
                amount_released: remaining_budget,
            }.publish(&env);
        } else if project.milestone_1_votes_reject >= 2 {
            project.milestone_1_status = 3; // Rejected

            MilestoneRejectedEvent {
                project_id,
                milestone_index,
            }.publish(&env);
        }

        env.storage().persistent().set(&proj_key, &project);
    }

    pub fn get_project(env: Env, project_id: u32) -> Project {
        let key = DataKey::Project(project_id);
        bump_persistent(&env, &key);
        env.storage().persistent().get(&key).expect("Project not found")
    }

    pub fn is_resident_verified(env: Env, resident: Address) -> bool {
        let key = DataKey::IsYouth(resident);
        bump_persistent(&env, &key);
        env.storage().persistent().get(&key).unwrap_or(false)
    }

    pub fn is_sk_official(env: Env, official: Address) -> bool {
        let key = DataKey::IsSK(official);
        bump_persistent(&env, &key);
        env.storage().persistent().get(&key).unwrap_or(false)
    }

    pub fn get_project_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::ProjectCount).unwrap_or(0)
    }

    pub fn refund_project(env: Env, sk_official: Address, project_id: u32) {
        sk_official.require_auth();

        let proj_key = DataKey::Project(project_id);
        bump_persistent(&env, &proj_key);

        let mut project: Project = env.storage().persistent().get(&proj_key).expect("Project not found");
        if project.creator != sk_official {
            panic!("Caller is not the project creator");
        }
        if project.milestone_1_status != 3 {
            panic!("Project milestone is not in Rejected state");
        }
        if project.status == 3 {
            panic!("Project budget has already been refunded");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        // Refund the remaining 50% budget back to the creator
        let remaining_budget = project.budget - (project.budget / 2);
        client.transfer(&env.current_contract_address(), &sk_official, &remaining_budget);

        project.status = 3; // Refunded
        env.storage().persistent().set(&proj_key, &project);
    }
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, 100000, 500000);
}

mod test;
