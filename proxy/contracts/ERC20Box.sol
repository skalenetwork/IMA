pragma solidity ^0.4.24;

import "./Ownable.sol";

interface Proxy {
    function postOutgoingMessage(string dstChainID, address dstContract, uint amount, address to, bytes data) external;
}

interface ERC20 {
    function transferFrom(address from, address to, uint amount) external returns (bool);
    function transfer(address to, uint amount) external;
}

contract ERC20Box is Ownable {

    address public proxyAddress;
    
    //mapping(bytes32 => address) erc20ManagerAddresses;

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000;

    constructor(address newProxyAddress) {
        proxyAddress = newProxyAddress;
    }

    function() public {
        revert();
    }

    function takeERC20(address from, uint amount) public {
        require(ERC20(from).transferFrom(msg.sender, address(this), amount));
    }

    function deposit(string schainID, address to, bytes data) public {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        //require(ERC20(from).transferFrom(msg.sender, address(this), amount));
        Proxy(proxyAddress).postOutgoingMessage(schainID, to, 0, address(0), data);
    }

    function postMessage(address sender, string fromSchainID, address to, uint amount, bytes data) public  {
        address(to).call(data);
    }
}
