#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, Vec};

/// Errors returned by the SpendingPolicy contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// Policy not found for the given agent address.
    PolicyNotFound = 1,
    /// Caller is not the policy owner.
    NotOwner = 2,
    /// Agent is paused (circuit breaker active).
    AgentPaused = 3,
    /// Transaction exceeds per-transaction limit.
    TxLimitExceeded = 4,
    /// Transaction would exceed daily budget.
    DailyLimitExceeded = 5,
}

/// On-chain spending policy for a monitored agent wallet.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Policy {
    /// Who owns/manages this policy (the AgentGuard operator).
    pub owner: Address,
    /// The agent wallet being constrained.
    pub agent: Address,
    /// Maximum USDC allowed per day (in stroops, 1 USDC = 1_000_000).
    pub daily_limit: i128,
    /// Maximum USDC per single transaction (in stroops).
    pub max_tx: i128,
    /// Whether the agent is paused (circuit breaker).
    pub paused: bool,
    /// USDC spent today (in stroops) — rolling counter.
    pub spent_today: i128,
    /// Ledger timestamp of last daily reset.
    pub last_reset: u64,
    /// Total transactions blocked by this policy.
    pub total_blocked: u32,
    /// Total transactions allowed by this policy.
    pub total_allowed: u32,
}

/// Storage key for policies, keyed by agent address.
#[contracttype]
pub enum DataKey {
    Policy(Address),
}

const DAY_IN_SECONDS: u64 = 86_400;

#[contract]
pub struct SpendingPolicyContract;

#[contractimpl]
impl SpendingPolicyContract {
    /// Create a new spending policy for an agent wallet.
    /// Only the owner can manage this policy afterward.
    pub fn create_policy(
        env: Env,
        owner: Address,
        agent: Address,
        daily_limit: i128,
        max_tx: i128,
    ) {
        // Require the owner to authorize this call
        owner.require_auth();

        let policy = Policy {
            owner,
            agent: agent.clone(),
            daily_limit,
            max_tx,
            paused: false,
            spent_today: 0,
            last_reset: env.ledger().timestamp(),
            total_blocked: 0,
            total_allowed: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Policy(agent), &policy);
    }

    /// Check if a proposed spend would be allowed (read-only query).
    /// Returns true if allowed, false if it would be blocked.
    /// Also resets the daily counter if a new day has started.
    pub fn check_spend(env: Env, agent: Address, amount: i128) -> Result<bool, Error> {
        let mut policy: Policy = env
            .storage()
            .persistent()
            .get(&DataKey::Policy(agent.clone()))
            .ok_or(Error::PolicyNotFound)?;

        // Reset daily counter if new day
        let now = env.ledger().timestamp();
        if now - policy.last_reset > DAY_IN_SECONDS {
            policy.spent_today = 0;
            policy.last_reset = now;
            env.storage()
                .persistent()
                .set(&DataKey::Policy(agent), &policy);
        }

        // Check rules
        if policy.paused {
            return Ok(false);
        }
        if amount > policy.max_tx {
            return Ok(false);
        }
        if policy.spent_today + amount > policy.daily_limit {
            return Ok(false);
        }

        Ok(true)
    }

    /// Record a spend — updates the daily counter and stats.
    /// Called by the monitoring system after a legitimate transaction.
    pub fn record_spend(env: Env, caller: Address, agent: Address, amount: i128) -> Result<(), Error> {
        caller.require_auth();

        let mut policy: Policy = env
            .storage()
            .persistent()
            .get(&DataKey::Policy(agent.clone()))
            .ok_or(Error::PolicyNotFound)?;

        if caller != policy.owner {
            return Err(Error::NotOwner);
        }

        // Reset daily counter if new day
        let now = env.ledger().timestamp();
        if now - policy.last_reset > DAY_IN_SECONDS {
            policy.spent_today = 0;
            policy.last_reset = now;
        }

        policy.spent_today += amount;
        policy.total_allowed += 1;

        env.storage()
            .persistent()
            .set(&DataKey::Policy(agent), &policy);

        Ok(())
    }

    /// Pause an agent — circuit breaker. Only callable by the policy owner.
    pub fn pause_agent(env: Env, caller: Address, agent: Address) -> Result<(), Error> {
        caller.require_auth();

        let mut policy: Policy = env
            .storage()
            .persistent()
            .get(&DataKey::Policy(agent.clone()))
            .ok_or(Error::PolicyNotFound)?;

        if caller != policy.owner {
            return Err(Error::NotOwner);
        }

        policy.paused = true;
        policy.total_blocked += 1;

        env.storage()
            .persistent()
            .set(&DataKey::Policy(agent), &policy);

        Ok(())
    }

    /// Resume a paused agent. Only callable by the policy owner.
    pub fn resume_agent(env: Env, caller: Address, agent: Address) -> Result<(), Error> {
        caller.require_auth();

        let mut policy: Policy = env
            .storage()
            .persistent()
            .get(&DataKey::Policy(agent.clone()))
            .ok_or(Error::PolicyNotFound)?;

        if caller != policy.owner {
            return Err(Error::NotOwner);
        }

        policy.paused = false;

        env.storage()
            .persistent()
            .set(&DataKey::Policy(agent), &policy);

        Ok(())
    }

    /// Get the current policy state for an agent (read-only).
    pub fn get_policy(env: Env, agent: Address) -> Result<Policy, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Policy(agent))
            .ok_or(Error::PolicyNotFound)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_create_and_check() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(SpendingPolicyContract, ());
        let client = SpendingPolicyContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let agent = Address::generate(&env);

        // Create policy: $5 daily, $1 per tx (in stroops)
        client.create_policy(&owner, &agent, &5_000_000, &1_000_000);

        // Check a $0.50 spend — should be allowed
        let result = client.check_spend(&agent, &500_000);
        assert_eq!(result, true);

        // Check a $2.00 spend — exceeds per-tx limit
        let result = client.check_spend(&agent, &2_000_000);
        assert_eq!(result, false);
    }

    #[test]
    fn test_pause_and_resume() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(SpendingPolicyContract, ());
        let client = SpendingPolicyContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let agent = Address::generate(&env);

        client.create_policy(&owner, &agent, &5_000_000, &1_000_000);

        // Should be allowed before pause
        assert_eq!(client.check_spend(&agent, &500_000), true);

        // Pause
        client.pause_agent(&owner, &agent);

        // Should be blocked after pause
        assert_eq!(client.check_spend(&agent, &500_000), false);

        // Resume
        client.resume_agent(&owner, &agent);

        // Should be allowed again
        assert_eq!(client.check_spend(&agent, &500_000), true);
    }
}
