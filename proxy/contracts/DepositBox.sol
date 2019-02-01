pragma solidity ^0.4.24;

import "./Ownable.sol";

interface Proxy {
    function postOutgoingMessage(string dstChainID, address dstContract, uint amount, address to) external;
}

// This contract runs on the main net and accepts deposits

contract DepositBox is Ownable {

    //address public skaleManagerAddress;

    address public proxyAddress;

    mapping(bytes32 => address) public tokenManagerAddresses;

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000; // 0;

    //mapping(address => uint) public etherBox;

    //mapping(address => mapping(address => uint)) public allowed;

    event MoneyReceivedMessage(address sender, string FromSchainID, address to, uint amount);

    /// Create a new deposit box
    constructor(address newProxyAddress) public {
        proxyAddress = newProxyAddress;
    }

    function() public {
        revert();
    }

    function addSchain(string schainID, address tokenManagerAddress) public {
        //require(msg.sender == owner);
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] == address(0));
        require(tokenManagerAddress != address(0));
        tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] = tokenManagerAddress;
    }

    function deposit(string schainID, address to) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value > 0);
        Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], msg.value, to);
    }

    function postMessage(address sender, string fromSchainID, address to, uint amount) public {
        require(msg.sender == proxyAddress);
        require(keccak256(abi.encodePacked(fromSchainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(sender == tokenManagerAddresses[keccak256(abi.encodePacked(fromSchainID))]);
        require(to != address(0));
        require(amount > GAS_AMOUNT_POST_MESSAGE * tx.gasprice);
        emit MoneyReceivedMessage(sender, fromSchainID, to, amount);
        //
        //require(address(to).send(amount));
        require(address(to).send(amount - GAS_AMOUNT_POST_MESSAGE * tx.gasprice));
        require(address(owner).send(GAS_AMOUNT_POST_MESSAGE * tx.gasprice));
    }
}
