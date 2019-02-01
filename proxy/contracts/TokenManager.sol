pragma solidity ^0.4.24;

import "./Ownable.sol";

interface ProxyForSchain {
    function postOutgoingMessage(string dstChainID, address dstContract, uint amount, address to) external;
}

// This contract runs on schains and accepts messages from main net creates ETH clones.
// When the user exits, it burns them

contract TokenManager is Ownable {

    // ID of this schain,
    string public chainID;

    address public proxyForSchainAddress;

    mapping(bytes32 => address) public tokenManagerAddresses;

    // The maximum amount of ETH clones this contract can create
    // It is 102000000 which is the current total ETH supply

    // TODO: TOKEN_RESERVE = 102000000 * (10 ** 18);

    uint public TOKEN_RESERVE = 102000000 * (10 ** 18); //ether

    // Owner of this schain. For mainnet
    //address public owner;


    event MoneyReceivedMessage(address sender, string FromSchainID, address to, uint amount);


    /// Create a new token manager

    constructor(string newChainID, address depositBox, address newProxyAddress) public payable {
        require(msg.value == TOKEN_RESERVE);
        //require(address(this).balance < TOKEN_RESERVE + 0.01 ether);
        chainID = newChainID;
        tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))] = depositBox;
        proxyForSchainAddress = newProxyAddress;
    }

    function() public {
        revert();
    }

    function addSchain(string schainID, address tokenManagerAddress) public {
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] == address(0));
        require(tokenManagerAddress != address(0));
        tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] = tokenManagerAddress;
    }

    function addDepositBox(address depositBoxAddress) public {
        require(depositBoxAddress != address(0));
        require(tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))] != depositBoxAddress);
        tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))] = depositBoxAddress;
    }

    // This is called by  schain owner.
    // Exit to main net
    function exitToMain(address to) public payable {
        require(msg.value > 0);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage("Mainnet", tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], msg.value, to);
    }

    function transferToSchain(string schainID, address to) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value > 0);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], msg.value, to);
    }

    // Receive money from main net and Schain

    function postMessage(address sender, string fromSchainID, address to, uint amount) public {
        require(keccak256(abi.encodePacked(fromSchainID)) != keccak256(abi.encodePacked(chainID)));
        require(sender == tokenManagerAddresses[keccak256(abi.encodePacked(fromSchainID))]);
        //require(msg.sender == owner);
        require(to != address(0));
        emit MoneyReceivedMessage(sender, fromSchainID, to, amount);
        require(address(to).send(amount));
    }
}
