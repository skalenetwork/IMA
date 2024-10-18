// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.27;

import "./ERC20WithoutTransfer.sol";

interface IERC20TransferWithoutReturn is IERC20WithoutTransfer {
    function transferFrom(address sender, address recipient, uint256 amount) external;
}

contract ERC20TransferWithoutReturn is IERC20TransferWithoutReturn, ERC20WithoutTransfer {

    // solhint-disable-next-line no-empty-blocks
    constructor(string memory tokenName, string memory tokenSymbol) ERC20WithoutTransfer(tokenName, tokenSymbol) {}

    function transferFrom(address sender, address recipient, uint256 amount) public override {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            allowance(sender, msg.sender) - amount
        );
    }
}
