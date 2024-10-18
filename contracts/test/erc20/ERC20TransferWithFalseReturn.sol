// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.27;

import "./ERC20WithoutTransfer.sol";

interface IERC20TransferWithFalseReturn is IERC20WithoutTransfer {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract ERC20TransferWithFalseReturn is IERC20TransferWithFalseReturn, ERC20WithoutTransfer {

    // solhint-disable-next-line no-empty-blocks
    constructor(string memory tokenName, string memory tokenSymbol) ERC20WithoutTransfer(tokenName, tokenSymbol) {}

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            allowance(sender, msg.sender) - amount
        );
        return false;
    }
}
