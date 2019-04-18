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

    struct Clone { 
        bool created;
        uint256 index;
    }

    enum TransactionOperation {
        transferETH, 
        transferERC20, 
        transferERC721, 
        rawTransferERC20, 
        rawTransferERC721
    }

    address public proxyAddress;

    mapping(bytes32 => address) public tokenManagerAddresses;

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000; // 0;
    uint public constant AVERAGE_TX_PRICE = 1000000000;

    address[] public ERC20Tokens;
    mapping(address => Clone) public isERC20Tokens;
    mapping(bytes32 => mapping(address => bool)) isERC20Offside;

    address[] public ERC721Tokens;
    mapping(address => Clone) public isERC721Tokens;
    mapping(bytes32 => mapping(address => bool)) isERC721Offside;

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

    function() external payable {
        revert();
    }

    function addSchain(
        string memory schainID, 
        address tokenManagerAddress
    ) 
        public 
    {
        //require(msg.sender == owner);
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] == address(0));
        require(tokenManagerAddress != address(0));
        tokenManagerAddresses[schainHash] = tokenManagerAddress;
    }

    function depositERC20(
        string memory schainID, 
        address contractHere, 
        address to, 
        uint amount
    ) 
        public 
        payable 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE); // average tx.gasprice
        require(
            ERC20Detailed(contractHere).allowance(
                msg.sender, 
                address(this)
            ) >= amount
        );
        require(
            ERC20Detailed(contractHere).transferFrom(
                msg.sender, 
                address(this), 
                amount
            )
        );

        if (!isERC20Tokens[contractHere].created) {
            ERC20Tokens.push(contractHere);
            isERC20Tokens[contractHere].created = true;
            isERC20Tokens[contractHere].index = ERC20Tokens.length - 1;
        }

        bytes memory data;

        if (!isERC20Offside[schainHash][contractHere]) {
            string memory name = ERC20Detailed(contractHere).name();
            uint8 decimals = ERC20Detailed(contractHere).decimals();
            string memory symbol = ERC20Detailed(contractHere).symbol();
            uint totalSupply = ERC20Detailed(contractHere).totalSupply();
            data = abi.encodePacked(
                bytes1(uint8(2)), 
                bytes32(uint256(isERC20Tokens[contractHere].index)), 
                bytes(name).length, 
                name, 
                bytes(symbol).length, 
                symbol, 
                decimals, 
                totalSupply
            );
            Proxy(proxyAddress).postOutgoingMessage(
                schainID, 
                tokenManagerAddresses[schainHash], 
                0, 
                address(0), 
                data
            );
            isERC20Offside[schainHash][contractHere] = true;
        }

        data = abi.encodePacked(
            bytes1(uint8(3)), 
            bytes32(isERC20Tokens[contractHere].index), 
            bytes32(bytes20(to)), 
            bytes32(amount)
        );
        Proxy(proxyAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            0, 
            address(0), 
            data
        );
    }

    function rawDepositERC20(
        string memory schainID, 
        address contractHere, 
        address contractThere, 
        address to, 
        uint amount
    ) 
        public 
        payable 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE); // average tx.gasprice
        require(
            ERC20Detailed(contractHere).allowance(
                msg.sender, 
                address(this)
            ) >= amount
        );
        require(
            ERC20Detailed(contractHere).transferFrom(
                msg.sender, 
                address(this), 
                amount
            )
        );

        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(19)), 
            bytes32(bytes20(to)), 
            bytes32(amount)
        );
        Proxy(proxyAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            0, 
            contractThere, 
            data
        );

    }

    function depositERC721(
        string memory schainID, 
        address contractHere, 
        address to, 
        uint tokenId
    ) 
        public 
        payable 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE); // average tx.gasprice
        require(
            IERC721Full(contractHere).getApproved(tokenId) == address(this)
        );
        IERC721Full(contractHere).transferFrom(
            msg.sender, 
            address(this), 
            tokenId
        );
        require(IERC721Full(contractHere).ownerOf(tokenId) == address(this));

        if (!isERC721Tokens[contractHere].created) {
            ERC721Tokens.push(contractHere);
            isERC721Tokens[contractHere].created = true;
            isERC721Tokens[contractHere].index = ERC721Tokens.length - 1;
        }

        bytes memory data;

        if (!isERC721Offside[schainHash][contractHere]) {
            string memory name = IERC721Full(contractHere).name();
            string memory symbol = IERC721Full(contractHere).symbol();
            data = abi.encodePacked(
                bytes1(uint8(5)), 
                bytes32(uint256(isERC721Tokens[contractHere].index)), 
                bytes(name).length, 
                name, 
                bytes(symbol).length, 
                symbol
            );
            Proxy(proxyAddress).postOutgoingMessage(
                schainID, 
                tokenManagerAddresses[schainHash], 
                0, 
                address(0), 
                data
            );
            isERC721Offside[schainHash][contractHere] = true;
        }

        data = abi.encodePacked(
            bytes1(uint8(4)), 
            bytes32(isERC721Tokens[contractHere].index), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        Proxy(proxyAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            0, 
            address(0), 
            data
        );
    }

    function rawDepositERC721(
        string memory schainID, 
        address contractHere, 
        address contractThere, 
        address to, 
        uint tokenId
    ) 
        public 
        payable 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE); // average tx.gasprice
        require(
            IERC721Full(contractHere).getApproved(tokenId) == address(this)
        );
        IERC721Full(contractHere).transferFrom(
            msg.sender, 
            address(this), 
            tokenId
        );
        require(IERC721Full(contractHere).ownerOf(tokenId) == address(this));

        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(21)), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        Proxy(proxyAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            0, 
            contractThere, 
            data
        );
    }

    function deposit(string memory schainID, address to) public payable {
        bytes memory empty;
        deposit(schainID, to, empty);
    }

    function deposit(
        string memory schainID, 
        address to, 
        bytes memory data
    ) 
        public 
        payable 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
        require(msg.value >= GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE); //average tx.gasprice
        data = abi.encodePacked(bytes1(uint8(1)), data);
        Proxy(proxyAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            msg.value, 
            to, 
            data
        );
    }

    function postMessage(
        address sender, 
        string memory fromSchainID, 
        address payable to, 
        uint amount, 
        bytes memory data
    ) 
        public 
    {
        //require(msg.sender == proxyAddress);
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(sender == tokenManagerAddresses[schainHash]);
        
        if (!(GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE <= address(this).balance)) {
            emit Error(
                sender, 
                fromSchainID, 
                to, 
                amount, 
                data, 
                "Not enough money to finish this transaction"
            );
            return;
        }

        if (data.length == 0) {
            emit Error(sender, fromSchainID, to, amount, data, "Invalid data");
            return;
        }

        emit MoneyReceivedMessage(sender, fromSchainID, to, amount, data);
        TransactionOperation operation = fallbackOperationTypeConvert(data);
        if (operation == TransactionOperation.transferETH) {
            require(amount > GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE);
            if (
                !(amount - GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE <= 
                    address(this).balance
                )
            ) {
                emit Error(
                    sender, 
                    fromSchainID, 
                    to, 
                    amount, 
                    data, 
                    "Not enough money to finish this transaction"
                );
                return;
            }
            require(
                address(to).send(
                    amount - GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE
                )
            );
            require(
                address(owner).send(GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE)
            );
            return;
        } else if (operation == TransactionOperation.transferERC20) {
            require(to == address(0));
            uint contractIndex;
            address receiver;
            uint amountOfTokens;
            (contractIndex, receiver, amountOfTokens) 
                = fallbackDataParser(data);
            require(contractIndex < ERC20Tokens.length);
            require(ERC20Tokens[contractIndex] != address(0));
            require(isERC20Tokens[ERC20Tokens[contractIndex]].created);
            require(isERC20Offside[schainHash][ERC20Tokens[contractIndex]]);
            if (ERC20Detailed(ERC20Tokens[contractIndex]).balanceOf(address(this)) >= amountOfTokens) {
                require(ERC20Detailed(ERC20Tokens[contractIndex]).transfer(receiver, amountOfTokens));
            } /*else {
                require(ERC20Detailed(to).mint(receiver, amountOfTokens));    // need to add mint support
            }*/
            require(
                address(owner).send(GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE)
            );
            return;
        } else if (operation == TransactionOperation.transferERC721) {
            require(to == address(0));
            uint contractIndex;
            address receiver;
            uint tokenId;
            (contractIndex, receiver, tokenId) = fallbackDataParser(data);
            require(contractIndex < ERC721Tokens.length);
            require(ERC721Tokens[contractIndex] != address(0));
            require(isERC721Tokens[ERC721Tokens[contractIndex]].created);
            require(isERC721Offside[schainHash][ERC721Tokens[contractIndex]]);
            if (IERC721Full(ERC721Tokens[contractIndex]).ownerOf(tokenId) == address(this)) {
                IERC721Full(ERC721Tokens[contractIndex]).transferFrom(address(this), receiver, tokenId);
                require(IERC721Full(ERC721Tokens[contractIndex]).ownerOf(tokenId) == receiver);
            }
            require(
                address(owner).send(GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE)
            );
            return;
        } else if (operation == TransactionOperation.rawTransferERC20) {
            address receiver;
            uint amountOfTokens;
            (receiver, amountOfTokens) = fallbackRawDataParser(data);
            if(ERC20Detailed(to).balanceOf(address(this)) >= amountOfTokens) {
                require(ERC20Detailed(to).transfer(receiver, amountOfTokens));
            }
            // need to add mint support
            require(
                address(owner).send(GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE)
            );
            return;
        } else if (operation == TransactionOperation.rawTransferERC721) {
            address receiver;
            uint tokenId;
            (receiver, tokenId) = fallbackRawDataParser(data);
            if (IERC721Full(to).ownerOf(tokenId) == address(this)) {
                IERC721Full(to).transferFrom(address(this), receiver, tokenId);
                require(IERC721Full(to).ownerOf(tokenId) == receiver);
            }
            require(
                address(owner).send(GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE)
            );
            return;
        }
    }

    /**
     * @dev Convert first byte of data to Operation
     * 0x01 - transfer eth
     * 0x03 - transfer ERC20 token
     * 0x05 - transfer ERC721 token
     * 0x13 - transfer ERC20 token - raw mode
     * 0x15 - transfer ERC721 token - raw mode
     * @param data - received data
     * @return operation
     */
    function fallbackOperationTypeConvert(bytes memory data) 
        internal 
        pure 
        returns (TransactionOperation) 
    {
        bytes1 operationType;
        assembly {
            operationType := mload(add(data, 0x20))
        }
        require(
            operationType == 0x01 || 
            operationType == 0x03 || 
            operationType == 0x05 ||
            operationType == 0x13 ||
            operationType == 0x15,
            "Operation type is not identified"
        );
        if (operationType == 0x01) {
            return TransactionOperation.transferETH;
        } else if (operationType == 0x03) {
            return TransactionOperation.transferERC20;
        } else if (operationType == 0x05) {
            return TransactionOperation.transferERC721;
        } else if (operationType == 0x13) {
            return TransactionOperation.rawTransferERC20;
        } else if (operationType == 0x15) {
            return TransactionOperation.rawTransferERC721;
        }
    }

    function fallbackDataParser(bytes memory data) 
        internal 
        pure 
        returns (uint, address, uint) 
    {
        bytes32 contractIndex;
        bytes32 to;
        bytes32 token;
        assembly {
            contractIndex := mload(add(data, 33))
            to := mload(add(data, 65))
            token := mload(add(data, 97))
        }
        return (
            uint(contractIndex), address(bytes20(to)), uint(token)
        );
    }

    function fallbackRawDataParser(bytes memory data) 
        internal 
        pure 
        returns (address, uint) 
    {
        bytes32 to;
        bytes32 token;
        assembly {
            to := mload(add(data, 33))
            token := mload(add(data, 65))
        }
        return (address(bytes20(to)), uint(token));
    }
}