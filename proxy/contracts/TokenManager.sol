pragma solidity ^0.4.24;

import "./Ownable.sol";
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Capped.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';

interface ProxyForSchain {
    function postOutgoingMessage(string dstChainID, address dstContract, uint amount, address to, bytes data) external;
}

contract ERC20OnChain is ERC20Detailed, ERC20Capped {
    constructor(string memory name, string memory symbol, uint8 decimals, uint256 cap) 
        ERC20Detailed(name, symbol, decimals)
        ERC20Capped(cap)
        public 
    {

    }
}

/*interface ERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function mint(address to, uint256 amount) external returns (bool);
    function totalSupply() external view returns (uint256);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function balanceOf(address who) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}*/

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

    mapping(bytes32 => address) public tokenManagerAddresses;

    mapping(bytes32 => mapping(address => ContractOnSchain)) public tokens;

    // The maximum amount of ETH clones this contract can create
    // It is 102000000 which is the current total ETH supply

    // TODO: TOKEN_RESERVE = 102000000 * (10 ** 18);

    //uint public TOKEN_RESERVE = 102000000 * (10 ** 18); //ether
    uint public TOKEN_RESERVE = 100 * (10 ** 18); //ether

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000;

    // Owner of this schain. For mainnet
    //address public owner;


    event MoneyReceivedMessage(address sender, string FromSchainID, address to, uint amount, bytes data);

    event Error(address sender, string fromSchainID, address to, uint amount, bytes data, string message);


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

    // This is called by schain owner.
    // Exit to main net
    function exitToMain(address to, bytes data) public payable {
        require(msg.value > 0);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage("Mainnet", tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], msg.value, to, data);
    }

    function exitToMainERC20OnChain(address contractHere, address to, uint amount) public {
        require(tokens[keccak256(abi.encodePacked("Mainnet"))][contractHere].created);
        require(tokens[keccak256(abi.encodePacked("Mainnet"))][contractHere].contractOnSchain != address(0));
        require(ERC20OnChain(contractHere).allowance(msg.sender, address(this)) >= amount);
        require(ERC20OnChain(contractHere).transferFrom(msg.sender, address(this), amount));

        bytes memory data;

        data = abi.encodePacked(byte(3), bytes32(contractHere), bytes32(to), bytes32(amount));
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage("Mainnet", tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], 0, tokens[keccak256(abi.encodePacked("Mainnet"))][contractHere].contractOnSchain, data);
    }

    function transferToSchain(string schainID, address to, bytes data) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value > 0);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], msg.value, to, data);
    }

    // Receive money from main net and Schain

    function postMessage(address sender, string memory fromSchainID, address to, uint amount, bytes data) public {
        require(msg.sender == proxyForSchainAddress);
        require(keccak256(abi.encodePacked(fromSchainID)) != keccak256(abi.encodePacked(chainID)));
        require(sender == tokenManagerAddresses[keccak256(abi.encodePacked(fromSchainID))]);
        require(to != address(0));
        
        if (data.length == 0) {
            emit Error(sender, fromSchainID, to, amount, data, "Invalid data");
            return;
        }
        address contractThere;
        emit MoneyReceivedMessage(sender, fromSchainID, to, amount, data);
        TransactionOperation operation = fallbackOperationTypeConvert(data);
        if (operation == TransactionOperation.transferETH) {
            require(address(to).send(amount));
            return;
        } else if (operation == TransactionOperation.transferERC20) {
            //address contractThere;
            address receiver;
            uint amountOfTokens;
            (contractThere, receiver, amountOfTokens) = fallbackDataTransferParser(data);
            require(tokens[keccak256(abi.encodePacked(fromSchainID))][to].created);
            if (tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain == address(0)) {
                tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain = contractThere;
            }
            require(tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain == contractThere);
            if (ERC20OnChain(to).balanceOf(address(this)) >= amountOfTokens) {
                require(ERC20OnChain(to).transfer(receiver, amountOfTokens));
            } else {
                require(ERC20OnChain(to).mint(receiver, amountOfTokens));
            }
            return;
        } else if (operation == TransactionOperation.createERC20) {
            require(to == address(0));
            //address contractThere;
            (to, contractThere) = createERC20(data);
            tokens[keccak256(abi.encodePacked(fromSchainID))][to].created = true;
            tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain = contractThere;

        } else if (operation == TransactionOperation.transferERC721) {
            
        } else if (operation == TransactionOperation.createERC721) {

        }
    }

    function createERC20(bytes data) internal returns (address, address) {
        address contractThere;
        string memory name;
        string memory symbol;
        uint8 decimals;
        uint256 totalSupply;
        (contractThere, name, symbol, decimals, totalSupply) = fallbackDataCreateERC20Parser(data);
        ERC20OnChain newERC20 = new ERC20OnChain(name, symbol, decimals, totalSupply);
        return (address(newERC20), contractThere);
    }

    function fallbackOperationTypeConvert(bytes data) internal pure returns (TransactionOperation) {
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

    function fallbackDataTransferParser(bytes data) internal pure returns (address, address, uint) {
        bytes32 contractThere;
        bytes32 to;
        bytes32 amount;
        assembly {
            contractThere := mload(add(data, 33))
            to := mload(add(data, 65))
            amount := mload(add(data, 97))
        }
        return (address(contractThere), address(to), uint(amount));
    }

    function fallbackDataCreateERC20Parser(bytes data) internal pure returns (address, string memory name, string memory symbol, uint8, uint256) {
        bytes32 contractThere;
        bytes1 decimals;
        bytes32 totalSupply;
        bytes32 nameLength;
        bytes32 symbolLength;
        assembly {
            contractThere := mload(add(data, 33))
            nameLength := mload(add(data, 65))
        }
        name = new string(uint(nameLength));
        for (uint i = 0; i < uint(nameLength); i++) {
            bytes(name)[i] = data[65 + i];
        }
        uint lengthOfName = uint(nameLength);
        assembly {
            symbolLength := mload(add(data, add(97, lengthOfName)))

        }
        symbol = new string(uint(symbolLength));
        for (i = 0; i < uint(symbolLength); i++) {
            bytes(symbol)[i] = data[97 + lengthOfName + i];
        }
        uint lengthOfSymbol = uint(symbolLength);
        assembly {
            decimals := mload(add(data, add(129, add(lengthOfName, lengthOfSymbol))))
            totalSupply := mload(add(data, add(130, add(lengthOfName, lengthOfSymbol))))
        }
        return (address(contractThere), name, symbol, uint8(decimals), uint256(totalSupply));
    }
}