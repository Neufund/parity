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

/* global WebAssembly */

import secp256k1 from 'secp256k1';
import { keccak_256 as keccak256 } from 'js-sha3';
import { bytesToHex } from '~/api/util/format';
import KeccakWasm from './keccak.wasm';

const NOOP = () => {};

function align (mem) {
  return (Math.ceil(mem / 8) * 8) | 0;
}

const STATIC_BASE = 1024;
const STATICTOP = STATIC_BASE + 3776;
const STACK_BASE = align(STATICTOP + 16);
const STACKTOP = STACK_BASE;
const DYNAMICTOP_PTR = 0;
const WASM_PAGE_SIZE = 65536;
const TOTAL_STACK = 20 * WASM_PAGE_SIZE; // 5242880;
const TOTAL_MEMORY = 16777216;
const STACK_MAX = STACK_BASE + TOTAL_STACK;
const wasmMemory = new WebAssembly.Memory({
  initial: TOTAL_MEMORY / WASM_PAGE_SIZE,
  maximum: TOTAL_MEMORY / WASM_PAGE_SIZE
});
const wasmTable = new WebAssembly.Table({
  initial: 8,
  maximum: 8,
  element: 'anyfunc'
});
const wasmHeap = new Uint8Array(wasmMemory.buffer);

function abort (what) {
  throw new Error(what || 'WASM abort');
}

function abortOnCannotGrowMemory () {
  abort(`Cannot enlarge memory arrays.`);
}

function enlargeMemory () {
  abortOnCannotGrowMemory();
}

function getTotalMemory () {
  return TOTAL_MEMORY;
}

function memcpy (dest, src, len) {
  wasmHeap.set(wasmHeap.subarray(src, src + len), dest);

  return dest;
}

const keccakWasm = new KeccakWasm({
  global: {},
  env: {
    DYNAMICTOP_PTR,
    STACKTOP,
    STACK_MAX,
    abort,
    enlargeMemory,
    getTotalMemory,
    abortOnCannotGrowMemory,
    ___lock: NOOP,
    ___syscall6: () => 0,
    ___setErrNo: (no) => no,
    _abort: abort,
    ___syscall140: () => 0,
    _emscripten_memcpy_big: memcpy,
    ___syscall54: () => 0,
    ___unlock: NOOP,
    _llvm_trap: abort.bind(null, 'trap'),
    ___syscall146: () => 0,
    'memory': wasmMemory,
    'table': wasmTable,
    tableBase: 0,
    memoryBase: STATIC_BASE
  }
});

console.log(keccakWasm.exports);

const isWorker = typeof self !== 'undefined';

// Stay compatible between environments
if (!isWorker) {
  const scope = typeof global === 'undefined' ? window : global;

  scope.self = scope;
}

// keythereum should never be used outside of the browser
let keythereum = require('keythereum');

if (isWorker) {
  keythereum = self.keythereum;
}

function route ({ action, payload }) {
  if (action in actions) {
    return actions[action](payload);
  }

  return null;
}

const actions = {
  phraseToWallet (phrase) {
    const phraseUtf8 = Buffer.from(phrase, 'utf8');
    const inputPtr = keccakWasm.exports._malloc(Math.max(32, phraseUtf8.length));
    const outputPtr = keccakWasm.exports._malloc(32);

    wasmHeap.set(phraseUtf8, inputPtr);

    const secret = wasmHeap.subarray(outputPtr, outputPtr + 32);

    keccakWasm.exports._brain_base(inputPtr, phraseUtf8.length, outputPtr);

    // for (let i = 0; i < 16384; i += 2) {
    //   // wasmHeap.copyWithin(inputPtr, outputPtr, outputPtr + 32);
    //   keccakWasm.exports._keccak256(outputPtr, 32, inputPtr);
    //   keccakWasm.exports._keccak256(inputPtr, 32, outputPtr);
    // }

    while (true) {
      wasmHeap.copyWithin(inputPtr, outputPtr, outputPtr + 32);
      keccakWasm.exports._keccak256(inputPtr, 32, outputPtr);

      // secret = keccak256.array(secret);

      const secretBuf = Buffer.from(secret);

      if (secp256k1.privateKeyVerify(secretBuf)) {
        // No compression, slice out last 64 bytes
        const publicBuf = secp256k1.publicKeyCreate(secretBuf, false).slice(-64);
        const address = keccak256.array(publicBuf).slice(12);

        if (address[0] !== 0) {
          continue;
        }

        const wallet = {
          secret: bytesToHex(secretBuf),
          public: bytesToHex(publicBuf),
          address: bytesToHex(address)
        };

        // keccakWasm.exports._free(inputPtr);
        // keccakWasm.exports._free(outputPtr);

        return wallet;
      }
    }
  },

  verifySecret (secret) {
    const key = Buffer.from(secret.slice(2), 'hex');

    return secp256k1.privateKeyVerify(key);
  },

  createKeyObject ({ key, password }) {
    key = Buffer.from(key);
    password = Buffer.from(password);

    const iv = keythereum.crypto.randomBytes(16);
    const salt = keythereum.crypto.randomBytes(32);
    const keyObject = keythereum.dump(password, key, salt, iv);

    return JSON.stringify(keyObject);
  },

  decryptPrivateKey ({ keyObject, password }) {
    password = Buffer.from(password);

    try {
      const key = keythereum.recover(password, keyObject);

      // Convert to array to safely send from the worker
      return Array.from(key);
    } catch (e) {
      return null;
    }
  }
};

self.onmessage = function ({ data }) {
  try {
    const result = route(data);

    postMessage([null, result]);
  } catch (err) {
    postMessage([err, null]);
  }
};

// Emulate a web worker in Node.js
class KeyWorker {
  postMessage (data) {
    // Force async
    setTimeout(() => {
      try {
        const result = route(data);

        this.onmessage({ data: [null, result] });
      } catch (err) {
        this.onmessage({ data: [err, null] });
      }
    }, 0);
  }

  onmessage (event) {
    // no-op to be overriden
  }
}

if (exports != null) {
  exports.KeyWorker = KeyWorker;
}
