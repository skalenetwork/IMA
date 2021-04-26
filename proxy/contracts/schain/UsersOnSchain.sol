// SPDX-License-Identifier: AGPL-3.0-only

/*
    UsersOnSchain.sol - SKALE Manager
    Copyright (C) 2021-Present SKALE Labs
    @author Dmytro Stebaiev
    @author Artem Payvin
    @author Vadim Yavorsky

    SKALE Manager is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SKALE Manager is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with SKALE Manager.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./PermissionsForSchain.sol";
import "../Messages.sol";

/**
 * @title UsersOnSchain
 * @dev Contract contains logic to perform automatic self-recharging ether for nodes
 */
contract UsersOnSchain is PermissionsForSchain {

    string private _chainID;
    uint public constant TIME_LIMIT_PER_MESSAGE = 5 minutes;

    mapping(address => bool) private _unfrozenUsers;
    mapping(address => uint) private _lastMessageTimeStamp;

    constructor(
        string memory newChainID,
        address newLockAndDataAddress
    )
        public
        PermissionsForSchain(newLockAndDataAddress)
    {
        _chainID = newChainID;
    }

    function postMessage(
        string calldata fromSchainID,
        address,
        bytes calldata data
    )
        external
        returns (bool)
    {
        require(msg.sender == getProxyForSchainAddress(), "Sender must be MessageProxy");
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(
            schainHash != keccak256(abi.encodePacked(getChainID())),
            "Receiver chain is incorrect"
        );
        Messages.MessageType operation = Messages.getMessageType(data);
        require(operation == Messages.MessageType.FREEZE_STATE, "The message should contain a frozen state");
        Messages.FreezeStateMessage memory message =  Messages.decodeFreezeStateMessage(data);
        require(_unfrozenUsers[message.receiver] != message.isUnfrozen, "Freezing states must be different");
        _unfrozenUsers[message.receiver] = message.isUnfrozen;
        return true;
    }

    function checkAllowedToSendMessage(address receiver) external {
        require(msg.sender == getProxyForSchainAddress(), "Sender must be MessageProxy");
        require(_unfrozenUsers[receiver], "Recipient must be unfrozen");
        require(
            _lastMessageTimeStamp[receiver] + TIME_LIMIT_PER_MESSAGE < block.timestamp,
            "Trying to send messages too often"
        );
        _lastMessageTimeStamp[receiver] = block.timestamp;
    }

    /**
     * @dev Returns chain ID.
     */
    function getChainID() public view returns ( string memory cID ) {
        if ((keccak256(abi.encodePacked(_chainID))) == (keccak256(abi.encodePacked(""))) ) {
            return SkaleFeatures(getSkaleFeaturesAddress())
                .getConfigVariableString("skaleConfig.sChain.schainName");
        }
        return _chainID;
    }

    /**
     * @dev Returns MessageProxy address.
     */
    function getProxyForSchainAddress() public view returns ( address ow ) {
        address proxyForSchainAddress = LockAndDataForSchain(
            getLockAndDataAddress()
        ).getMessageProxy();
        if (proxyForSchainAddress != address(0) )
            return proxyForSchainAddress;
        return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
            "skaleConfig.contractSettings.IMA.MessageProxy"
        );
    }

}
