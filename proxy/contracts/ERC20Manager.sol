pragma solidity ^0.4.24;

import "./Ownable.sol";

interface ProxyForSchain {
    function postOutgoingMessage(string dstChainID, address dstContract, uint amount, address to, bytes data) external;
}

interface ERC20 {
    function transferFrom(address from, address to, uint amount) external returns (bool);
}

contract ERC20Manager is Ownable {
    string public chainID;

    address public proxyForSchainAddress;

    //address public erc20Address;

    //mapping(bytes32 => address) public erc20ManagerAddresses;

    constructor(string newChainID, /*address erc20Box,*/ address newProxyAddress) public {
        chainID = newChainID;
        proxyForSchainAddress = newProxyAddress;
    }

    function() public {
        revert();
    }

    function takeErc20(address from, uint amount) public {
        //erc20Address = from;
        require(ERC20(from).transferFrom(msg.sender, address(this), amount));
    }

    function exitToMain(address to, bytes data) public {
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage("Mainnet", to, 0, address(0), data);
    }

    function transferToSchain(string schainID, address to, bytes data) public {
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(schainID, to, 0, address(0), data);
    }

    function postMessage(address sender, string fromSchainID, address to, uint amount, bytes data) {
        address(to).call(data);
    }
}
