// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxy.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
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

pragma solidity 0.6.12;

interface IMessageProxy {
    // internal functions can be executed from specific key
    function addConnectedChain(string calldata schainName) external;
    function removeConnectedChain(string calldata schainName) external;

    function postOutgoingMessage(
        bytes32 targetChainHash,
        address targetContract,
        bytes calldata data
    ) external;
    function registerExtraContract(string calldata schainName, address contractOnMainnet) external;
    function removeExtraContract(string calldata schainName, address contractOnMainnet) external;
    function isConnectedChain(string calldata schainName) external view returns (bool);
    function isContractRegistered(string calldata schainName, address contractAddress) external view returns (bool);
    function getOutgoingMessagesCounter(string calldata targetSchainName) external view returns (uint256);
    function getIncomingMessagesCounter(string calldata fromSchainName) external view returns (uint256);
}