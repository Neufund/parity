// Copyright 2015-2017 Parity Technologies (UK) Ltd.
// This file is part of Parity.

// Parity is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Parity.  If not, see <http://www.gnu.org/licenses/>.

use ethcore::log_entry::{LocalizedLogEntry, LogEntry};
use v1::types::{Bytes, H160, H256, U256};
/// Log
#[derive(Debug, Serialize, PartialEq, Eq, Hash, Clone)]
pub struct LogDetails{
	/// H160
	pub address: H160,
	/// Topics
	pub topics: Vec<H256>,
	/// Data
	pub data: Bytes,
	/// Block Hash
	#[serde(rename="blockHash")]
	pub block_hash: Option<H256>,
	/// Block Number
	#[serde(rename="blockNumber")]
	pub block_number: Option<U256>,
	/// Transaction Hash
	#[serde(rename="transactionHash")]
	pub transaction_hash: Option<H256>,
	/// Transaction Index
	#[serde(rename="transactionIndex")]
	pub transaction_index: Option<U256>,
	/// Log Index in Block
	#[serde(rename="logIndex")]
	pub log_index: Option<U256>,
	/// Log Index in Transaction
	#[serde(rename="transactionLogIndex")]
	pub transaction_log_index: Option<U256>,
	/// Log Type
	#[serde(rename="type")]
	pub log_type: String,

	#[serde(rename="timestamp")]
	pub timestamp: u64,

	#[serde(rename="value")]
	pub value: U256
}


impl From<LocalizedLogEntry> for LogDetails {
	fn from(e: LocalizedLogEntry) -> LogDetails {
		LogDetails {
			address: e.entry.address.into(),
			topics: e.entry.topics.into_iter().map(Into::into).collect(),
			data: e.entry.data.into(),
			block_hash: Some(e.block_hash.into()),
			block_number: Some(e.block_number.into()),
			transaction_hash: Some(e.transaction_hash.into()),
			transaction_index: Some(e.transaction_index.into()),
			log_index: Some(e.log_index.into()),
			transaction_log_index: Some(e.transaction_log_index.into()),
			log_type: "mined".to_owned(),
			timestamp: 123,
			value: 0.into()
		}
	}
}

impl From<LogEntry> for LogDetails {
	fn from(e: LogEntry) -> LogDetails {
		LogDetails {
			address: e.address.into(),
			topics: e.topics.into_iter().map(Into::into).collect(),
			data: e.data.into(),
			block_hash: None,
			block_number: None,
			transaction_hash: None,
			transaction_index: None,
			log_index: None,
			transaction_log_index: None,
			log_type: "pending".to_owned(),
			timestamp: 123,
			value: 0.into()
		}
	}
}
