pragma solidity ^0.5.0;

import "./Ownable.sol";

interface TokenFactoryForSchain {
    function createERC20(bytes calldata data) external returns (address payable);
}

interface ProxyForSchain {
    function postOutgoingMessage(string calldata dstChainID, address dstContract, uint amount, address to, bytes calldata data) external;
}

interface StandartERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function mint(address to, uint256 amount) external returns (bool);
    function cap() external returns (uint256);
    function totalSupply() external view returns (uint256);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function balanceOf(address who) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

// This contract runs on schains and accepts messages from main net creates ETH clones.
// When the user exits, it burns them

contract TokenManager is Ownable {

    struct ContractOnSchain { 
        bool created;
        address contractOnSchain;
    }

    enum TransactionOperation {transferETH, transferERC20, transferERC721, createERC20, createERC721}

    // ID of this schain,
    string public chainID;

    address public proxyForSchainAddress;

    address public tokenFactoryAddress;

    mapping(bytes32 => address) public tokenManagerAddresses;

    mapping(bytes32 => mapping(address => ContractOnSchain)) public tokens;

    // The maximum amount of ETH clones this contract can create
    // It is 102000000 which is the current total ETH supply

    // TODO: TOKEN_RESERVE = 102000000 * (10 ** 18);

    //uint public TOKEN_RESERVE = 102000000 * (10 ** 18); //ether
    uint public TOKEN_RESERVE = 10 * (10 ** 18); //ether

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000;

    // Owner of this schain. For mainnet
    //address public owner;


    event MoneyReceivedMessage(address sender, string FromSchainID, address to, uint amount, bytes data);

    event ERC20TokenCreated(string FromSchainID, address contractThere, address contractHere);

    event Error(address sender, string fromSchainID, address to, uint amount, bytes data, string message);


    /// Create a new token manager

    constructor(string memory newChainID, address depositBox, address newProxyAddress) public payable {
        require(msg.value == TOKEN_RESERVE);
        //require(address(this).balance < TOKEN_RESERVE + 0.01 ether);
        chainID = newChainID;
        tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))] = depositBox;
        proxyForSchainAddress = newProxyAddress;
    }

    function() external {
        revert();
    }

    function addSchain(string memory schainID, address tokenManagerAddress) public {
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] == address(0));
        require(tokenManagerAddress != address(0));
        tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] = tokenManagerAddress;
    }

    function addDepositBox(address depositBoxAddress) public {
        require(depositBoxAddress != address(0));
        require(tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))] != depositBoxAddress);
        tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))] = depositBoxAddress;
    }

    function setTokenFactory(address newTokenFactoryAddress) public onlyOwner {
        tokenFactoryAddress = newTokenFactoryAddress;
    }

    // This is called by schain owner.
    // Exit to main net
    function exitToMain(address to, bytes memory data) public payable {
        require(msg.value > 0);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage("Mainnet", tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], msg.value, to, data);
    }

    function exitToMainERC20(address contractHere, address to, uint amount) public {
        require(tokens[keccak256(abi.encodePacked("Mainnet"))][contractHere].created);
        require(tokens[keccak256(abi.encodePacked("Mainnet"))][contractHere].contractOnSchain != address(0));
        require(StandartERC20(contractHere).allowance(msg.sender, address(this)) >= amount);
        require(StandartERC20(contractHere).transferFrom(msg.sender, address(this), amount));

        bytes memory data;

        data = abi.encodePacked(bytes1(uint8(3)), bytes32(bytes20(contractHere)), bytes32(bytes20(to)), bytes32(amount));
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage("Mainnet", tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], 0, tokens[keccak256(abi.encodePacked("Mainnet"))][contractHere].contractOnSchain, data);
    }

    function transferToSchain(string memory schainID, address to, bytes memory data) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value > 0);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], msg.value, to, data);
    }

    function transferToSchainERC20(string memory schainID, address contractHere, address to, uint amount) public {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(StandartERC20(contractHere).allowance(msg.sender, address(this)) >= amount);
        require(StandartERC20(contractHere).transferFrom(msg.sender, address(this), amount));

        bytes memory data;

        if (!tokens[keccak256(abi.encodePacked(schainID))][contractHere].created) {
            string memory name = StandartERC20(contractHere).name();
            uint8 decimals = StandartERC20(contractHere).decimals();
            string memory symbol = StandartERC20(contractHere).symbol();
            uint totalSupply = StandartERC20(contractHere).totalSupply();
            data = abi.encodePacked(bytes1(uint8(2)), bytes32(bytes20(contractHere)), bytes(name).length, name, bytes(symbol).length, symbol, decimals, totalSupply);
            ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], 0, address(0), data);
            tokens[keccak256(abi.encodePacked(schainID))][contractHere].created = true;
        }

        data = abi.encodePacked(bytes1(uint8(3)), bytes32(bytes20(contractHere)), bytes32(bytes20(to)), bytes32(amount));
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], 0, tokens[keccak256(abi.encodePacked(schainID))][contractHere].contractOnSchain, data);
    }

    // Receive money from main net and Schain

    function postMessage(address sender, string memory fromSchainID, address payable to, uint amount, bytes memory data) public {
        require(msg.sender == proxyForSchainAddress);
        require(keccak256(abi.encodePacked(fromSchainID)) != keccak256(abi.encodePacked(chainID)));
        require(sender == tokenManagerAddresses[keccak256(abi.encodePacked(fromSchainID))]);
        require(to != address(0));
        
        if (data.length == 0) {
            emit Error(sender, fromSchainID, to, amount, data, "Invalid data");
            return;
        }
        emit MoneyReceivedMessage(sender, fromSchainID, to, amount, data);
        TransactionOperation operation = fallbackOperationTypeConvert(data);
        address contractThere = fallbackContractThereParser(data);
        if (operation == TransactionOperation.transferETH) {
            require(address(to).send(amount));
            return;
        } else if (operation == TransactionOperation.transferERC20) {
            //address contractThere;
            address receiver;
            uint amountOfTokens;
            (receiver, amountOfTokens) = fallbackDataTransferParser(data);
            require(tokens[keccak256(abi.encodePacked(fromSchainID))][to].created);
            if (tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain == address(0)) {
                tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain = contractThere;
            }
            require(tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain == contractThere);
            if (StandartERC20(to).balanceOf(address(this)) >= amountOfTokens) {
                require(StandartERC20(to).transfer(receiver, amountOfTokens));
            } else {
                require(StandartERC20(to).mint(receiver, amountOfTokens));
            }
            return;
        } else if (operation == TransactionOperation.createERC20) {
            require(to == address(0));
            //address contractThere;
            to = TokenFactoryForSchain(tokenFactoryAddress).createERC20(data);
            tokens[keccak256(abi.encodePacked(fromSchainID))][to].created = true;
            tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain = contractThere;
            emit ERC20TokenCreated(fromSchainID, contractThere, to);
        } else if (operation == TransactionOperation.transferERC721) {
            
        } else if (operation == TransactionOperation.createERC721) {

        }
    }

    function fallbackOperationTypeConvert(bytes memory data) internal pure returns (TransactionOperation) {
        bytes1 operationType;
        assembly {
            operationType := mload(add(data, 0x20))
        }
        require(operationType == 0x01 || operationType == 0x03 || operationType == 0x05, "Operation type is not identified");
        if (operationType == 0x01) {
            return TransactionOperation.transferETH;
        } else if (operationType == 0x02) {
            return TransactionOperation.createERC20;
        } else if (operationType == 0x03) {
            return TransactionOperation.transferERC20;
        } else if (operationType == 0x04) {
            return TransactionOperation.createERC721;
        } else if (operationType == 0x05) {
            return TransactionOperation.transferERC721;
        }
    }
    
    function fallbackContractThereParser(bytes memory data) internal pure returns (address) {
        bytes32 contractThere;
        assembly {
            contractThere := mload(add(data, 33))
        }
        return (address(bytes20(contractThere)));
    }

    function fallbackDataTransferParser(bytes memory data) internal pure returns (address, uint) {
        bytes32 to;
        bytes32 amount;
        assembly {
            to := mload(add(data, 65))
            amount := mload(add(data, 97))
        }
        return (address(bytes20(to)), uint(amount));
    }

}