#![no_std]
use soroban_sdk::{contract, contractimpl, contractevent, contracttype, Address, Env, String, token, Vec};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    ProjectCount,
    Project(u32),
    ProjectMilestone(u32, u32), // (project_id, milestone_index)
    IsYouth(Address),
    IsSK(Address),
    Voted(u32, u32, Address),   // (project_id, milestone_index, voter)
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Project {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub budget: i128,
    pub creator: Address,
    pub total_phases: u32,
    pub current_phase: u32, // Next phase index to be proofed and approved (1-indexed)
    pub status: u32,        // 0 = Active, 1 = Completed, 2 = Refunded
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Milestone {
    pub index: u32,
    pub percentage: u32,
    pub proof_url: String,
    pub votes_approve: u32,
    pub votes_reject: u32,
    pub status: u32,        // 0 = PendingProof, 1 = PendingApproval, 2 = Approved, 3 = Rejected
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

    pub fn verify_resident(env: Env, admin: Address, resident: Address, is_youth: bool) {
        admin.require_auth();

        let key = DataKey::IsYouth(resident.clone());
        env.storage().persistent().set(&key, &is_youth);
        bump_persistent(&env, &key);
        
        ResidentVerifiedEvent {
            resident: resident.clone(),
            is_youth,
        }.publish(&env);
    }

    pub fn verify_sk_official(env: Env, admin: Address, official: Address, is_sk: bool) {
        admin.require_auth();

        let key = DataKey::IsSK(official.clone());
        env.storage().persistent().set(&key, &is_sk);
        bump_persistent(&env, &key);

        SKOfficialVerifiedEvent {
            official: official.clone(),
            is_sk,
        }.publish(&env);
    }

    pub fn create_project(
        env: Env,
        admin: Address,
        sk_official: Address,
        name: String,
        budget: i128,
        description: String,
        milestones: Vec<u32>, // percentages of milestones e.g. [40, 30, 30]
    ) -> u32 {
        admin.require_auth();

        if budget <= 0 {
            panic!("Budget must be positive");
        }

        let milestone_count = milestones.len();
        if milestone_count == 0 {
            panic!("Project must have at least one milestone");
        }

        // Verify percentages sum to exactly 100
        let mut pct_sum: u32 = 0;
        for pct in milestones.iter() {
            pct_sum += pct;
        }
        if pct_sum != 100 {
            panic!("Milestone percentages must sum to 100");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        // 1. Lock the budget from Barangay Admin Treasury into the contract escrow
        client.transfer(&admin, &env.current_contract_address(), &budget);

        let mut project_count: u32 = env.storage().instance().get(&DataKey::ProjectCount).unwrap();
        project_count += 1;
        env.storage().instance().set(&DataKey::ProjectCount, &project_count);

        let is_completed = milestone_count == 1;

        let new_project = Project {
            id: project_count,
            name,
            description,
            budget,
            creator: sk_official.clone(),
            total_phases: milestone_count,
            current_phase: if is_completed { 1 } else { 2 },
            status: if is_completed { 1 } else { 0 }, // 1 = Completed if only 1 phase, else 0 = Active
        };

        let proj_key = DataKey::Project(project_count);
        env.storage().persistent().set(&proj_key, &new_project);
        bump_persistent(&env, &proj_key);

        // Store milestones
        let mut idx: u32 = 1;
        for pct in milestones.iter() {
            let milestone = Milestone {
                index: idx,
                percentage: pct,
                proof_url: String::from_str(&env, ""),
                votes_approve: 0,
                votes_reject: 0,
                status: if idx == 1 { 2 } else { 0 }, // Phase 1 is approved/released upfront
            };
            let ms_key = DataKey::ProjectMilestone(project_count, idx);
            env.storage().persistent().set(&ms_key, &milestone);
            bump_persistent(&env, &ms_key);
            idx += 1;
        }

        // Release first milestone funds (Phase 1) upfront to the SK Official
        let first_pct = milestones.get(0).unwrap();
        let mobilization = (budget * first_pct as i128) / 100;
        if mobilization > 0 {
            client.transfer(&env.current_contract_address(), &sk_official, &mobilization);
        }

        ProjectCreatedEvent {
            id: project_count,
            creator: sk_official.clone(),
            budget,
        }.publish(&env);

        project_count
    }

    pub fn submit_milestone_proof(
        env: Env,
        sk_official: Address,
        project_id: u32,
        milestone_index: u32,
        proof_url: String,
    ) {
        sk_official.require_auth();

        let proj_key = DataKey::Project(project_id);
        bump_persistent(&env, &proj_key);
        let mut project: Project = env.storage().persistent().get(&proj_key).expect("Project not found");
        if project.creator != sk_official {
            panic!("Caller is not the project creator");
        }
        if project.status != 0 {
            panic!("Project is not in active state");
        }
        if milestone_index != project.current_phase {
            panic!("Proof submitted for wrong milestone index");
        }

        let ms_key = DataKey::ProjectMilestone(project_id, milestone_index);
        bump_persistent(&env, &ms_key);
        let mut milestone: Milestone = env.storage().persistent().get(&ms_key).expect("Milestone not found");
        if milestone.status != 0 {
            panic!("Milestone proof already submitted or approved");
        }

        milestone.proof_url = proof_url.clone();
        milestone.status = 1; // PendingApproval

        env.storage().persistent().set(&ms_key, &milestone);
        env.storage().persistent().set(&proj_key, &project);

        MilestoneProofSubmittedEvent {
            project_id,
            milestone_index,
            proof_url,
        }.publish(&env);
    }

    pub fn vote_milestone(
        env: Env,
        voter: Address,
        project_id: u32,
        milestone_index: u32,
        approve: bool,
    ) {
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
        if project.status != 0 {
            panic!("Project is not active");
        }
        if milestone_index != project.current_phase {
            panic!("Voting on wrong milestone index");
        }

        let ms_key = DataKey::ProjectMilestone(project_id, milestone_index);
        bump_persistent(&env, &ms_key);
        let mut milestone: Milestone = env.storage().persistent().get(&ms_key).expect("Milestone not found");
        if milestone.status != 1 {
            panic!("Milestone is not pending approval");
        }

        let vote_key = DataKey::Voted(project_id, milestone_index, voter.clone());
        let has_voted = env.storage().persistent().get(&vote_key).unwrap_or(false);
        if has_voted {
            panic!("Already voted on this milestone");
        }

        if approve {
            milestone.votes_approve += 1;
        } else {
            milestone.votes_reject += 1;
        }

        env.storage().persistent().set(&vote_key, &true);
        bump_persistent(&env, &vote_key);

        MilestoneVotedEvent {
            project_id,
            voter: voter.clone(),
            approve,
        }.publish(&env);

        // Simple threshold: 2 approval votes to release funds
        if milestone.votes_approve >= 2 {
            milestone.status = 2; // Approved

            let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            let client = token::Client::new(&env, &token_addr);

            // Release milestone percentage of the budget
            let amount = (project.budget * milestone.percentage as i128) / 100;
            if amount > 0 {
                client.transfer(&env.current_contract_address(), &project.creator, &amount);
            }

            MilestoneApprovedEvent {
                project_id,
                milestone_index,
                amount_released: amount,
            }.publish(&env);

            // Advance current_phase or complete project
            if project.current_phase == project.total_phases {
                project.status = 1; // Completed
            } else {
                project.current_phase += 1;
            }
        } else if milestone.votes_reject >= 2 {
            milestone.status = 3; // Rejected

            MilestoneRejectedEvent {
                project_id,
                milestone_index,
            }.publish(&env);
        }

        env.storage().persistent().set(&ms_key, &milestone);
        env.storage().persistent().set(&proj_key, &project);
    }

    pub fn get_project(env: Env, project_id: u32) -> Project {
        let key = DataKey::Project(project_id);
        bump_persistent(&env, &key);
        env.storage().persistent().get(&key).expect("Project not found")
    }

    pub fn get_milestone(env: Env, project_id: u32, milestone_index: u32) -> Milestone {
        let key = DataKey::ProjectMilestone(project_id, milestone_index);
        bump_persistent(&env, &key);
        env.storage().persistent().get(&key).expect("Milestone not found")
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
        if project.status != 0 {
            panic!("Project is not in active state");
        }

        // Check if the current milestone index is rejected
        let ms_key = DataKey::ProjectMilestone(project_id, project.current_phase);
        bump_persistent(&env, &ms_key);
        let milestone: Milestone = env.storage().persistent().get(&ms_key).expect("Milestone not found");
        if milestone.status != 3 {
            panic!("Current project milestone is not in Rejected state");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        // Refund all remaining escrow balance back to the creator
        let mut remaining_pct: u32 = 0;
        for idx in project.current_phase..=project.total_phases {
            let k = DataKey::ProjectMilestone(project_id, idx);
            if let Some(ms) = env.storage().persistent().get::<DataKey, Milestone>(&k) {
                remaining_pct += ms.percentage;
            }
        }
        let refund_amount = (project.budget * remaining_pct as i128) / 100;
        if refund_amount > 0 {
            client.transfer(&env.current_contract_address(), &sk_official, &refund_amount);
        }

        project.status = 2; // Refunded
        env.storage().persistent().set(&proj_key, &project);
    }
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, 100000, 500000);
}

mod test;
