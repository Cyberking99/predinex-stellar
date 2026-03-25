#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Symbol};

mod test;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Pool(u32),
    UserBet(u32, Address),
    PoolCounter,
    Token,
}

#[derive(Clone)]
#[contracttype]
pub struct Pool {
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub outcome_a_name: String,
    pub outcome_b_name: String,
    pub total_a: i128,
    pub total_b: i128,
    pub settled: bool,
    pub winning_outcome: Option<u32>,
    pub created_at: u64,
    pub settled_at: Option<u64>,
    pub expiry: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct UserBet {
    pub amount_a: i128,
    pub amount_b: i128,
    pub total_bet: i128,
}

#[contract]
pub struct PredinexContract;

#[contractimpl]
impl PredinexContract {
    pub fn initialize(env: Env, token: Address) {
        if env.storage().persistent().has(&DataKey::Token) {
            panic!("Already initialized");
        }
        env.storage().persistent().set(&DataKey::Token, &token);
    }

    pub fn create_pool(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        outcome_a: String,
        outcome_b: String,
        duration: u64,
    ) -> u32 {
        creator.require_auth();

        let pool_id = Self::get_pool_counter(&env);

        let created_at = env.ledger().timestamp();
        let expiry = created_at + duration;

        let pool = Pool {
            creator: creator.clone(),
            title,
            description,
            outcome_a_name: outcome_a,
            outcome_b_name: outcome_b,
            total_a: 0,
            total_b: 0,
            settled: false,
            winning_outcome: None,
            created_at,
            settled_at: None,
            expiry,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        env.storage()
            .persistent()
            .set(&DataKey::PoolCounter, &(pool_id + 1));

        env.events()
            .publish((Symbol::new(&env, "create_pool"), pool_id), creator);

        pool_id
    }

    pub fn place_bet(env: Env, user: Address, pool_id: u32, outcome: u32, amount: i128) {
        user.require_auth();

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        if pool.settled {
            panic!("Pool already settled");
        }

        if env.ledger().timestamp() >= pool.expiry {
            panic!("Pool expired");
        }

        if outcome > 1 {
            panic!("Invalid outcome");
        }

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_address);

        token_client.transfer(&user, &env.current_contract_address(), &amount);

        if outcome == 0 {
            pool.total_a += amount;
        } else {
            pool.total_b += amount;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);

        let mut user_bet = env
            .storage()
            .persistent()
            .get::<_, UserBet>(&DataKey::UserBet(pool_id, user.clone()))
            .unwrap_or(UserBet {
                amount_a: 0,
                amount_b: 0,
                total_bet: 0,
            });

        if outcome == 0 {
            user_bet.amount_a += amount;
        } else {
            user_bet.amount_b += amount;
        }
        user_bet.total_bet += amount;

        env.storage()
            .persistent()
            .set(&DataKey::UserBet(pool_id, user.clone()), &user_bet);

        env.events().publish(
            (Symbol::new(&env, "place_bet"), pool_id, user),
            (outcome, amount),
        );
    }

    pub fn settle_pool(env: Env, caller: Address, pool_id: u32, winning_outcome: u32) {
        caller.require_auth();

        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        if caller != pool.creator {
            panic!("Unauthorized");
        }

        if pool.settled {
            panic!("Already settled");
        }

        if winning_outcome > 1 {
            panic!("Invalid outcome");
        }

        pool.settled = true;
        pool.winning_outcome = Some(winning_outcome);
        pool.settled_at = Some(env.ledger().timestamp());

        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);

        env.events()
            .publish((Symbol::new(&env, "settle_pool"), pool_id), winning_outcome);
    }

    pub fn claim_winnings(env: Env, user: Address, pool_id: u32) -> i128 {
        user.require_auth();

        let pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .expect("Pool not found");

        if !pool.settled {
            panic!("Pool not settled");
        }

        let user_bet = env
            .storage()
            .persistent()
            .get::<_, UserBet>(&DataKey::UserBet(pool_id, user.clone()))
            .expect("No bet found");

        let winning_outcome = pool.winning_outcome.expect("No winning outcome");

        let user_winning_bet = if winning_outcome == 0 {
            user_bet.amount_a
        } else {
            user_bet.amount_b
        };

        if user_winning_bet == 0 {
            panic!("No winnings to claim");
        }

        let pool_winning_total = if winning_outcome == 0 {
            pool.total_a
        } else {
            pool.total_b
        };
        let total_pool_balance = pool.total_a + pool.total_b;

        // Fee calculation (simplified 2% fee as in Clarity contract)
        let fee = (total_pool_balance * 2) / 100;
        let net_pool_balance = total_pool_balance - fee;

        let winnings = (user_winning_bet * net_pool_balance) / pool_winning_total;

        let token_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Token)
            .expect("Not initialized");
        let token_client = token::Client::new(&env, &token_address);

        token_client.transfer(&env.current_contract_address(), &user, &winnings);

        // Remove user bet to prevent double claim
        env.storage()
            .persistent()
            .remove(&DataKey::UserBet(pool_id, user.clone()));

        env.events().publish(
            (Symbol::new(&env, "claim_winnings"), pool_id, user),
            winnings,
        );

        winnings
    }

    pub fn get_pool(env: Env, pool_id: u32) -> Option<Pool> {
        env.storage().persistent().get(&DataKey::Pool(pool_id))
    }

    fn get_pool_counter(env: &Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PoolCounter)
            .unwrap_or(1)
    }
}
