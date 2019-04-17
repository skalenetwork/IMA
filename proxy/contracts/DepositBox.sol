pragma solidity ^0.5.0;

import "./Ownable.sol";
import 'openzeppelin-solidity/contracts/token/ERC721/IERC721Full.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';


interface Proxy {
    function postOutgoingMessage(
        string calldata dstChainID, 
        address dstContract, 
        uint amount, 
        address to, 
        bytes calldata data
        ) 
        external;
}

// This contract runs on the main net and accepts deposits

contract DepositBox is Ownable {

    //address public skaleManagerAddress;

    struct ContractOnSchain { 
        bool created;
        address contractOnSchain;
    }

    enum TransactionOperation {transferETH, transferERC20, transferERC721}

    address public proxyAddress;

    mapping(bytes32 => address) public tokenManagerAddresses;

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000; // 0;

    mapping(bytes32 => mapping(address => ContractOnSchain)) public tokens;

    //mapping(address => mapping(address => uint)) public allowed;

    event MoneyReceivedMessage(
        address sender, 
        string fromSchainID, 
        address to, 
        uint amount, 
        bytes data
    );

    event Error(
        address sender, 
        string fromSchainID, 
        address to, 
        uint amount, 
        bytes data, 
        string message
    );

    /// Create a new deposit box
    constructor(address newProxyAddress) public {
        proxyAddress = newProxyAddress;
    }

    function() external {
        revert();
    }

    function addSchain(string memory schainID, address tokenManagerAddress) public {
        //require(msg.sender == owner);
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] == address(0));
        require(tokenManagerAddress != address(0));
        tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] = tokenManagerAddress;
    }

    function depositERC20(string memory schainID, address contractHere, address to, uint amount) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * 1000000000); // average tx.gasprice
        require(ERC20Detailed(contractHere).allowance(msg.sender, address(this)) >= amount);
        require(ERC20Detailed(contractHere).transferFrom(msg.sender, address(this), amount));

        bytes memory data;

        if (!tokens[keccak256(abi.encodePacked(schainID))][contractHere].created) {
            string memory name = ERC20Detailed(contractHere).name();
            uint8 decimals = ERC20Detailed(contractHere).decimals();
            string memory symbol = ERC20Detailed(contractHere).symbol();
            uint totalSupply = ERC20Detailed(contractHere).totalSupply();
            data = abi.encodePacked(
                bytes1(uint8(2)), 
                bytes32(bytes20(contractHere)), 
                bytes(name).length, 
                name, 
                bytes(symbol).length, 
                symbol, 
                decimals, 
                totalSupply
            );
            Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], 0, address(0), data);
            tokens[keccak256(abi.encodePacked(schainID))][contractHere].created = true;
        }

        data = abi.encodePacked(bytes1(uint8(3)), bytes32(bytes20(contractHere)), bytes32(bytes20(to)), bytes32(amount));
        Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], 0, tokens[keccak256(abi.encodePacked(schainID))][contractHere].contractOnSchain, data);
    }

    function rawDepositERC20(string memory schainID, address contractHere, address contractThere, address to, uint amount) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * 1000000000); // average tx.gasprice
        require(ERC20Detailed(contractHere).allowance(msg.sender, address(this)) >= amount);
        require(ERC20Detailed(contractHere).transferFrom(msg.sender, address(this), amount));

        bytes memory data;

        data = abi.encodePacked(bytes1(uint8(3)), bytes32(bytes20(contractHere)), bytes32(bytes20(to)), bytes32(amount));
        Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], 0, tokens[keccak256(abi.encodePacked(schainID))][contractHere].contractOnSchain, data);

    }

    function depositERC721(string memory schainID, address contractHere, address to, uint tokenId) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * 1000000000); // average tx.gasprice
        require(IERC721Full(contractHere).getApproved(tokenId) == address(this));
        IERC721Full(contractHere).transferFrom(msg.sender, address(this), tokenId);

        bytes memory data;

        if (!tokens[keccak256(abi.encodePacked(schainID))][contractHere].created) {
            string memory name = IERC721Full(contractHere).name();
            string memory symbol = IERC721Full(contractHere).symbol();
            data = abi.encodePacked(
                bytes1(uint8(5)), 
                bytes32(bytes20(contractHere)), 
                bytes(name).length, 
                name, 
                bytes(symbol).length, 
                symbol
            );
            Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], 0, address(0), data);
            tokens[keccak256(abi.encodePacked(schainID))][contractHere].created = true;
        }

        data = abi.encodePacked(bytes1(uint8(4)), bytes32(bytes20(contractHere)), bytes32(bytes20(to)), bytes32(tokenId));
        Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], 0, tokens[keccak256(abi.encodePacked(schainID))][contractHere].contractOnSchain, data);
    }

    function rawDepositERC721(string memory schainID, address contractHere, address contractThere, address to, uint tokenId) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * 1000000000); // average tx.gasprice
        require(IERC721Full(contractHere).getApproved(tokenId) == address(this));
        IERC721Full(contractHere).transferFrom(msg.sender, address(this), tokenId);

        bytes memory data;

        data = abi.encodePacked(bytes1(uint8(5)), bytes32(bytes20(contractHere)), bytes32(bytes20(to)), bytes32(tokenId));
        Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], 0, tokens[keccak256(abi.encodePacked(schainID))][contractHere].contractOnSchain, data);
    }

    function deposit(string memory schainID, address to) public payable {
        bytes memory empty;
        deposit(schainID, to, empty);
    }

    function deposit(string memory schainID, address to, bytes memory data) public payable {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * 1000000000); //average tx.gasprice
        data = abi.encodePacked(bytes1(uint8(1)), data);
        Proxy(proxyAddress).postOutgoingMessage(schainID, tokenManagerAddresses[keccak256(abi.encodePacked(schainID))], msg.value, to, data);
    }

    function postMessage(address sender, string memory fromSchainID, address payable to, uint amount, bytes memory data) public {
        //require(msg.sender == proxyAddress);
        require(keccak256(abi.encodePacked(fromSchainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(sender == tokenManagerAddresses[keccak256(abi.encodePacked(fromSchainID))]);
        require(to != address(0));
        
        if (!(GAS_AMOUNT_POST_MESSAGE * 1000000000 <= address(this).balance)) {
            emit Error(sender, fromSchainID, to, amount, data, "Not enough money to finish this transaction");
            return;
        }

        if (data.length == 0) {
            emit Error(sender, fromSchainID, to, amount, data, "Invalid data");
            return;
        }

        emit MoneyReceivedMessage(sender, fromSchainID, to, amount, data);
        TransactionOperation operation = fallbackOperationTypeConvert(data);
        if (operation == TransactionOperation.transferETH) {
            require(amount > GAS_AMOUNT_POST_MESSAGE * 1000000000);
            if (!(amount - GAS_AMOUNT_POST_MESSAGE * 1000000000 <= address(this).balance)) {
                emit Error(sender, fromSchainID, to, amount, data, "Not enough money to finish this transaction");
                return;
            }
            require(address(to).send(amount - GAS_AMOUNT_POST_MESSAGE * 1000000000));
            require(address(owner).send(GAS_AMOUNT_POST_MESSAGE * 1000000000));
            return;
        } else if (operation == TransactionOperation.transferERC20) {
            address contractThere;
            address receiver;
            uint amountOfTokens;
            (contractThere, receiver, amountOfTokens) = fallbackDataParser(data);
            require(tokens[keccak256(abi.encodePacked(fromSchainID))][to].created);
            if (tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain == address(0)) {
                tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain = contractThere;
            }
            require(tokens[keccak256(abi.encodePacked(fromSchainID))][to].contractOnSchain == contractThere);
            if (ERC20Detailed(to).balanceOf(address(this)) >= amountOfTokens) {
                require(ERC20Detailed(to).transfer(receiver, amountOfTokens));
            } /*else {
                require(ERC20Detailed(to).mint(receiver, amountOfTokens));
            }*/
            require(address(owner).send(GAS_AMOUNT_POST_MESSAGE * 1000000000));
            return;
        } else if (operation == TransactionOperation.transferERC721) {

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
        } else if (operationType == 0x03) {
            return TransactionOperation.transferERC20;
        } else if (operationType == 0x05) {
            return TransactionOperation.transferERC721;
        }
    }

    function fallbackDataParser(bytes memory data) internal pure returns (address, address, uint) {
        bytes32 contractThere;
        bytes32 to;
        bytes32 amount;
        assembly {
            contractThere := mload(add(data, 33))
            to := mload(add(data, 65))
            amount := mload(add(data, 97))
        }
        return (address(bytes20(contractThere)), address(bytes20(to)), uint(amount));
    }
}