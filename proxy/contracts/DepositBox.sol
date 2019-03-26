pragma solidity ^0.4.24;

import "./Ownable.sol";

interface Proxy {
    function postOutgoingMessage(string dstChainID, address dstContract, uint amount, address to, bytes data) external;
}

// This contract runs on the main net and accepts deposits

contract DepositBox is Ownable {

    //address public skaleManagerAddress;

    address public proxyAddress;

    mapping(bytes32 => address) public tokenManagerAddresses;

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000; // 0;

    //mapping(address => uint) public etherBox;

    //mapping(address => mapping(address => uint)) public allowed;

    event MoneyReceivedMessage(address sender, string fromSchainID, address to, uint amount, bytes data);

    event Error(address sender, string fromSchainID, address to, uint amount, bytes data, string message);

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

    function deposit(string schainID, address to, bytes data) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value > 0);
        Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], msg.value, to, data);
    }

    function postMessage(address sender, string fromSchainID, address to, uint amount, bytes data) public {
        require(msg.sender == proxyAddress);
        require(keccak256(abi.encodePacked(fromSchainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(sender == tokenManagerAddresses[keccak256(abi.encodePacked(fromSchainID))]);
        require(to != address(0));
        require(amount > GAS_AMOUNT_POST_MESSAGE * tx.gasprice);
        //
        //require(address(to).send(amount));
        if (!(amount - GAS_AMOUNT_POST_MESSAGE * tx.gasprice <= address(this).balance)) {
            emit Error(sender, fromSchainID, to, amount, data, "Not enough money to finish this transaction");
            return;
        }

        emit MoneyReceivedMessage(sender, fromSchainID, to, amount, data);
        require(address(owner).send(GAS_AMOUNT_POST_MESSAGE * tx.gasprice));
        /*uint length;
        assembly {
            length := extcodesize(to)
        }
        if (length == 0) {*/
            require(address(to).send(amount - GAS_AMOUNT_POST_MESSAGE * tx.gasprice));
            /*return;
        }
        require(MessageReceiver(to).postMessage(sender, schainID, to, amount - GAS_AMOUNT_POST_MESSAGE * tx.gasprice, data));*/
    }
}
