use v1::types::LogDetails;
use ethereum_types::U256;
use ethcore::client::{BlockChainClient, BlockId, TransactionId};

pub fn value(client:&BlockChainClient, log:&LogDetails) -> Option<U256> {
	return log.transaction_hash.clone()
		.map(|transaction_hash| TransactionId::Hash(transaction_hash.into()))
		.and_then(|transaction_id| client.transaction(transaction_id))
		.map(|transaction| transaction.value);
}

pub fn timestamp(client:&BlockChainClient, log:&LogDetails) -> Option<u64> {
	return log.block_hash.clone()
		.and_then(|block_hash| {
			let block_id_hash = BlockId::Hash(block_hash.into());
			client.block_header(block_id_hash)
		})
		.map(|header| header.timestamp());
}
