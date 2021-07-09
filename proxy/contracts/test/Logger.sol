// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   Logger.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Dmytro Stebaiev
 *
 *   SKALE IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */


pragma solidity 0.8.6;


library Logger {

    uint256 public constant FREE_MEM_PTR = 0x40;
    uint256 public constant FN_NUM_LOG_TEXT_MESSAGE = 0x12;

    function logTextMessage( uint256 messageType, string memory strTextMessage ) public view returns ( uint256 rv ) {
        uint256 fmp = FREE_MEM_PTR;
        uint256 fnc = FN_NUM_LOG_TEXT_MESSAGE;
        address who = msg.sender;
        uint256 blocks = (bytes(strTextMessage).length + 31) / 32 + 1;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let p := mload(fmp)
            let ptr := p
            // who
            mstore(ptr, who)
            ptr := add(ptr, 32)
            // type
            mstore(ptr, messageType )
            ptr := add(ptr, 32)
            // message
            for { let i := 0 } lt( i, blocks ) { i := add(1, i) } {
                let where := add(ptr, mul(32, i))
                let what := mload(add( strTextMessage, mul(32, i)))
                mstore(where, what)
            }
            rv := staticcall(not(0), fnc, p, add( 64, mul(blocks, 32) ), p, 32)
        }
    }

    function logMessage( string memory strMessage ) public view returns  (uint256 rv) {
        rv = logTextMessage(0, strMessage);
    }

    function logDebug  ( string memory strMessage ) public view returns  (uint256 rv) {
        rv = logTextMessage(1, strMessage);
    }

    function logTrace  ( string memory strMessage ) public view returns  (uint256 rv) {
        rv = logTextMessage(2, strMessage);
    }

    function logWarning( string memory strMessage ) public view returns  (uint256 rv) {
        rv = logTextMessage(3, strMessage);
    }

    function logError  ( string memory strMessage ) public view returns  (uint256 rv) {
        rv = logTextMessage(4, strMessage);
    }

    function logFatal  ( string memory strMessage ) public view returns  (uint256 rv) {
        rv = logTextMessage(5, strMessage);
    }
}