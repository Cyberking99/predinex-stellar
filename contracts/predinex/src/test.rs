#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_create_pool() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PredinexContract, ());
    let client = PredinexContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Market 1");
    let description = String::from_str(&env, "Desc 1");
    let outcome_a = String::from_str(&env, "Yes");
    let outcome_b = String::from_str(&env, "No");
    let duration = 3600;

    let pool_id = client.create_pool(
        &creator,
        &title,
        &description,
        &outcome_a,
        &outcome_b,
        &duration,
    );
    assert_eq!(pool_id, 1);

    let pool = client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.creator, creator);
    assert_eq!(pool.title, title);
}

#[test]
fn test_place_bet() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PredinexContract, ());
    let client = PredinexContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token::Client::new(&env, &token_id.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id.address());

    client.initialize(&token_id.address());

    let creator = Address::generate(&env);
    let user = Address::generate(&env);

    token_admin_client.mint(&user, &1000);

    let title = String::from_str(&env, "Market 1");
    let description = String::from_str(&env, "Desc 1");
    let outcome_a = String::from_str(&env, "Yes");
    let outcome_b = String::from_str(&env, "No");
    let duration = 3600;

    let pool_id = client.create_pool(
        &creator,
        &title,
        &description,
        &outcome_a,
        &outcome_b,
        &duration,
    );

    client.place_bet(&user, &pool_id, &0, &100);

    let pool = client.get_pool(&pool_id).unwrap();
    assert_eq!(pool.total_a, 100);
    assert_eq!(token.balance(&user), 900);
    assert_eq!(token.balance(&contract_id), 100);
}

#[test]
fn test_settle_and_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PredinexContract, ());
    let client = PredinexContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token::Client::new(&env, &token_id.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id.address());

    client.initialize(&token_id.address());

    let creator = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    token_admin_client.mint(&user1, &1000);
    token_admin_client.mint(&user2, &1000);

    let title = String::from_str(&env, "Market 1");
    let description = String::from_str(&env, "Desc 1");
    let outcome_a = String::from_str(&env, "Yes");
    let outcome_b = String::from_str(&env, "No");
    let duration = 3600;

    let pool_id = client.create_pool(
        &creator,
        &title,
        &description,
        &outcome_a,
        &outcome_b,
        &duration,
    );

    client.place_bet(&user1, &pool_id, &0, &100);
    client.place_bet(&user2, &pool_id, &1, &100);

    // Settle with outcome 0 (A wins)
    client.settle_pool(&creator, &pool_id, &0);

    let pool = client.get_pool(&pool_id).unwrap();
    assert!(pool.settled);
    assert_eq!(pool.winning_outcome, Some(0));

    // User 1 claims
    let winnings = client.claim_winnings(&user1, &pool_id);

    // Total pool = 200. Fee (2%) = 4. Net = 196.
    // User1 bet 100 on winning outcome (0). Total winners = 100.
    // Share = 100 * 196 / 100 = 196.
    assert_eq!(winnings, 196);
    assert_eq!(token.balance(&user1), 900 + 196);
}

#[test]
fn test_invariant_two_sided_pool_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PredinexContract, ());
    let client = PredinexContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token::Client::new(&env, &token_id.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id.address());

    client.initialize(&token_id.address());

    let creator = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    token_admin_client.mint(&user1, &1000);
    token_admin_client.mint(&user2, &1000);

    let title = String::from_str(&env, "Market 1");
    let description = String::from_str(&env, "Desc 1");
    let outcome_a = String::from_str(&env, "Yes");
    let outcome_b = String::from_str(&env, "No");
    let duration = 3600;

    let pool_id = client.create_pool(
        &creator,
        &title,
        &description,
        &outcome_a,
        &outcome_b,
        &duration,
    );

    // Initial total system balance
    let initial_total = token.balance(&user1) + token.balance(&user2) + token.balance(&contract_id);

    // Betting phase
    client.place_bet(&user1, &pool_id, &0, &200);
    client.place_bet(&user2, &pool_id, &1, &300);

    // Invariant 1: Betting conserves funds
    let current_total = token.balance(&user1) + token.balance(&user2) + token.balance(&contract_id);
    assert_eq!(initial_total, current_total);

    // Settle pool (Outcome 0 wins)
    client.settle_pool(&creator, &pool_id, &0);

    // Invariant 2: Settling conserves funds
    let current_total = token.balance(&user1) + token.balance(&user2) + token.balance(&contract_id);
    assert_eq!(initial_total, current_total);

    // Claiming phase
    client.claim_winnings(&user1, &pool_id);

    // Invariant 3: Claiming conserves funds
    let final_total = token.balance(&user1) + token.balance(&user2) + token.balance(&contract_id);
    assert_eq!(initial_total, final_total);

    // Verify treasury (contract balance)
    // Total pool = 500. Fee (2%) = 10. Net = 490.
    // User1 won, so user1 gets 490. Contract keeps 10.
    assert_eq!(token.balance(&contract_id), 10);
}

#[test]
fn test_invariant_multi_user_staggered_claims() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PredinexContract, ());
    let client = PredinexContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token::Client::new(&env, &token_id.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id.address());

    client.initialize(&token_id.address());

    let creator = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let user4 = Address::generate(&env);

    token_admin_client.mint(&user1, &1000);
    token_admin_client.mint(&user2, &2000);
    token_admin_client.mint(&user3, &3000);
    token_admin_client.mint(&user4, &4000);

    let pool_id = client.create_pool(
        &creator,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "A"),
        &String::from_str(&env, "B"),
        &3600,
    );

    // Helper macro/function not easily defined inside test due to ownership without passing env, 
    // so we compute manually or make a local closure. Wait, token is a client, we can clone it or just write a small helper.
    let get_system_balance = || -> i128 {
        token.balance(&user1)
            + token.balance(&user2)
            + token.balance(&user3)
            + token.balance(&user4)
            + token.balance(&contract_id)
    };

    let initial_total = get_system_balance();

    // Betting
    client.place_bet(&user1, &pool_id, &0, &500);
    client.place_bet(&user2, &pool_id, &1, &1000);
    client.place_bet(&user3, &pool_id, &0, &1500);
    client.place_bet(&user4, &pool_id, &1, &2000);

    assert_eq!(initial_total, get_system_balance());

    // Settle (Outcome 1 wins)
    client.settle_pool(&creator, &pool_id, &1);
    assert_eq!(initial_total, get_system_balance());

    // Staggered Claims
    // Total pool = 5000. Fee (2%) = 100. Net pool = 4900.
    // Winning pool total (outcome 1) = 3000.
    
    // User 2 claims. Bet = 1000. Share = 1000 * 4900 / 3000 = 1633.
    client.claim_winnings(&user2, &pool_id);
    assert_eq!(initial_total, get_system_balance());

    // User 4 claims. Bet = 2000. Share = 2000 * 4900 / 3000 = 3266.
    client.claim_winnings(&user4, &pool_id);
    assert_eq!(initial_total, get_system_balance());

    // Final treasury balance
    // User2 got 1633, User4 got 3266. Total paid out = 4899.
    // Total deposited = 5000. Contract balance should be 5000 - 4899 = 101.
    // (100 fee + 1 remaining from truncation)
    assert_eq!(token.balance(&contract_id), 101);
}
