pragma solidity ^0.5.0;

import "./Ownable.sol";
import 'openzeppelin-solidity/contracts/token/ERC721/IERC721Full.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';

interface TokenFactoryForSchain {
    function createERC20(bytes calldata data) 
        external 
        returns (address payable);
    function createERC721(bytes calldata data)
        external 
        returns (address payable);
}

interface ProxyForSchain {
    function postOutgoingMessage(
        string calldata dstChainID, 
        address dstContract, 
        uint amount, 
        address to, 
        bytes calldata data
    ) 
        external;
}

// This contract runs on schains and accepts messages from main net creates ETH clones.
// When the user exits, it burns them

contract TokenManager is Ownable {

    struct Clone { 
        bool created;
        uint256 index;
    }

    enum TransactionOperation {
        transferETH, 
        transferERC20, 
        transferERC721, 
        createERC20, 
        createERC721,
        rawTransferERC20, 
        rawTransferERC721
    }

    // ID of this schain,
    string public chainID;

    address public proxyForSchainAddress;

    address public tokenFactoryAddress;

    mapping(bytes32 => address) public tokenManagerAddresses;

    address[] public ERC20Tokens;
    mapping(address => Clone) public isERC20Tokens;
    mapping(bytes32 => mapping(address => bool)) isERC20Offside;

    address[] public ERC721Tokens;
    mapping(address => Clone) public isERC721Tokens;
    mapping(bytes32 => mapping(address => bool)) isERC721Offside;

    // The maximum amount of ETH clones this contract can create
    // It is 102000000 which is the current total ETH supply

    // TODO: TOKEN_RESERVE = 102000000 * (10 ** 18);

    //uint public TOKEN_RESERVE = 102000000 * (10 ** 18); //ether
    uint public TOKEN_RESERVE = 10 * (10 ** 18); //ether

    uint public constant GAS_AMOUNT_POST_MESSAGE = 55000;

    // Owner of this schain. For mainnet
    //address public owner;


    event MoneyReceivedMessage(
        address sender, 
        string FromSchainID, 
        address to, 
        uint amount, 
        bytes data
    );

    event ERC20TokenCreated(
        string FromSchainID, 
        uint contractIndex, 
        address contractHere
    );

    event Error(
        address sender, 
        string fromSchainID, 
        address to, 
        uint amount, 
        bytes data, 
        string message
    );


    /// Create a new token manager

    constructor(
        string memory newChainID, 
        address depositBox, 
        address newProxyAddress
    ) 
        public 
        payable 
    {
        require(msg.value == TOKEN_RESERVE);
        //require(address(this).balance < TOKEN_RESERVE + 0.01 ether);
        chainID = newChainID;
        tokenManagerAddresses[
            keccak256(abi.encodePacked("Mainnet"))
        ] = depositBox;
        proxyForSchainAddress = newProxyAddress;
    }

    function() external {
        revert();
    }

    function addSchain(string memory schainID, address tokenManagerAddress)
        public 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerAddresses[schainHash] == address(0));
        require(tokenManagerAddress != address(0));
        tokenManagerAddresses[schainHash] = tokenManagerAddress;
    }

    function addDepositBox(address depositBoxAddress) public {
        require(depositBoxAddress != address(0));
        require(
            tokenManagerAddresses[
                keccak256(abi.encodePacked("Mainnet"))
            ] != depositBoxAddress
        );
        tokenManagerAddresses[
            keccak256(abi.encodePacked("Mainnet"))
        ] = depositBoxAddress;
    }

    function setTokenFactory(address newTokenFactoryAddress) public onlyOwner {
        tokenFactoryAddress = newTokenFactoryAddress;
    }

    // This is called by schain owner.
    // Exit to main net
    function exitToMain(address to, bytes memory data) public payable {
        require(msg.value > 0);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            "Mainnet", 
            tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], 
            msg.value, 
            to, 
            data
        );
    }

    function exitToMainERC20(address contractHere, address to, uint amount)
        public 
    {
        require(
            isERC20Offside[
                keccak256(abi.encodePacked("Mainnet"))
            ][
                contractHere
            ]
        );
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
            bytes1(uint8(3)), 
            bytes32(isERC20Tokens[contractHere].index), 
            bytes32(bytes20(to)), 
            bytes32(amount)
        );
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            "Mainnet", 
            tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], 
            0, 
            address(0), 
            data
        );
    }

    function rawExitToMainERC20(
        address contractHere, 
        address contractThere, 
        address to, 
        uint amount
    ) 
        public 
    {
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
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            "Mainnet", 
            tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], 
            0, 
            contractThere, 
            data
        );
    }

    function exitToMainERC721(address contractHere, address to, uint tokenId)
        public 
    {
        require(
            isERC721Offside[
                keccak256(abi.encodePacked("Mainnet"))
            ][
                contractHere
            ]
        );
        require(
            IERC721Full(contractHere).getApproved(tokenId) == address(this)
        );
        IERC721(contractHere).transferFrom(msg.sender, address(this), tokenId);
        require(IERC721Full(contractHere).ownerOf(tokenId) == address(this));

        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(5)), 
            bytes32(isERC721Tokens[contractHere].index), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            "Mainnet", 
            tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], 
            0, 
            address(0), 
            data
        );
    }

    function rawExitToMainERC721(
        address contractHere, 
        address contractThere, 
        address to, 
        uint tokenId
    ) 
        public 
    {
        require(
            IERC721Full(contractHere).getApproved(tokenId) == address(this)
        );
        IERC721(contractHere).transferFrom(msg.sender, address(this), tokenId);
        require(IERC721Full(contractHere).ownerOf(tokenId) == address(this));

        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(21)), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            "Mainnet", 
            tokenManagerAddresses[keccak256(abi.encodePacked("Mainnet"))], 
            0, 
            contractThere, 
            data
        );
    }

    function transferToSchain(
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
        require(msg.value > 0);
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            msg.value, 
            to, 
            data
        );
    }

    function transferToSchainERC20(
        string memory schainID, 
        address contractHere, 
        address to, 
        uint amount
    ) 
        public 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
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
        require(isERC20Tokens[contractHere].created);
        require(
            isERC20Offside[
                keccak256(abi.encodePacked("Mainnet"))
            ][
                contractHere
            ]
        );

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
            ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
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
            bytes32(uint256(isERC20Tokens[contractHere].index)), 
            bytes32(bytes20(to)), 
            bytes32(amount)
        );
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            0, 
            address(0), 
            data
        );
    }

    function rawTransferToSchainERC20(
        string memory schainID, 
        address contractHere, 
        address contractThere, 
        address to, 
        uint amount
    ) 
        public 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
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
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            0, 
            contractThere, 
            data
        );
    }

    function transferToSchainERC721(
        string memory schainID, 
        address contractHere, 
        address to, 
        uint tokenId
    ) 
        public 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
        require(
            IERC721Full(contractHere).getApproved(tokenId) == address(this)
        );
        IERC721Full(contractHere).transferFrom(
            msg.sender, 
            address(this), 
            tokenId
        );
        require(IERC721(contractHere).ownerOf(tokenId) == address(this));
        require(isERC721Tokens[contractHere].created);
        require(
            isERC721Offside[
                keccak256(abi.encodePacked("Mainnet"))
            ][
                contractHere
            ]
        );

        bytes memory data;

        if (!isERC721Offside[schainHash][contractHere]) {
            string memory name = IERC721Full(contractHere).name();
            string memory symbol = IERC721Full(contractHere).symbol();
            data = abi.encodePacked(
                bytes1(uint8(4)), 
                bytes32(uint256(isERC721Tokens[contractHere].index)), 
                bytes(name).length, 
                name, 
                bytes(symbol).length, 
                symbol
            );
            ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
                schainID, 
                tokenManagerAddresses[schainHash], 
                0, 
                address(0), 
                data
            );
            isERC721Offside[schainHash][contractHere] = true;
        }

        data = abi.encodePacked(
            bytes1(uint8(5)), 
            bytes32(uint256(isERC721Tokens[contractHere].index)), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            0, 
            address(0), 
            data
        );
    }

    function rawTransferToSchainERC721(
        string memory schainID, 
        address contractHere, 
        address contractThere, 
        address to, 
        uint tokenId
    ) 
        public 
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(schainHash != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[schainHash] != address(0));
        require(
            IERC721Full(contractHere).getApproved(tokenId) == address(this)
        );
        IERC721Full(contractHere).transferFrom(
            msg.sender, 
            address(this), 
            tokenId
        );
        require(IERC721(contractHere).ownerOf(tokenId) == address(this));

        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(21)), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            schainID, 
            tokenManagerAddresses[schainHash], 
            0, 
            contractThere, 
            data
        );
    }

    // Receive money from main net and Schain

    function postMessage(
        address sender, 
        string memory fromSchainID, 
        address payable to, 
        uint amount, 
        bytes memory data
    ) 
        public 
    {
        require(msg.sender == proxyForSchainAddress);
        bytes32 schainHash = keccak256(abi.encodePacked(fromSchainID));
        require(schainHash != keccak256(abi.encodePacked(chainID)));
        require(sender == tokenManagerAddresses[schainHash]);
        
        if (data.length == 0) {
            emit Error(sender, fromSchainID, to, amount, data, "Invalid data");
            return;
        }
        emit MoneyReceivedMessage(sender, fromSchainID, to, amount, data);
        TransactionOperation operation = fallbackOperationTypeConvert(data);
        if (operation == TransactionOperation.transferETH) {
            require(to != address(0));
            require(address(to).send(amount));
            return;
        } else if (operation == TransactionOperation.transferERC20) {
            require(to == address(0));
            uint contractIndex;
            address receiver;
            uint amountOfTokens;
            (contractIndex, receiver, amountOfTokens) 
                = fallbackDataParser(data);
            require(ERC20Tokens[contractIndex] != address(0));
            require(isERC20Tokens[ERC20Tokens[contractIndex]].created);
            require(isERC20Offside[schainHash][ERC20Tokens[contractIndex]]);
            
            if (
                ERC20Detailed(ERC20Tokens[contractIndex]).balanceOf(
                    address(this)
                ) >= amountOfTokens
            ) {
                require(
                    ERC20Detailed(ERC20Tokens[contractIndex]).transfer(
                        receiver, 
                        amountOfTokens
                    )
                );
            } /*else {
                require(ERC20Detailed(ERC20Tokens[contractIndex]).mint(receiver, amountOfTokens));   // need to add mint support
            }*/
            return;
        } else if (operation == TransactionOperation.createERC20) {
            require(to == address(0));
            uint contractIndex = fallbackContractIndexDataParser(data);
            to = TokenFactoryForSchain(tokenFactoryAddress).createERC20(data);
            isERC20Tokens[to].created = true;
            isERC20Tokens[to].index = contractIndex;
            ERC20Tokens[contractIndex] = to;
            isERC20Offside[schainHash][to] = true;
            isERC20Offside[keccak256(abi.encodePacked("Mainnet"))][to] = true;
            emit ERC20TokenCreated(fromSchainID, contractIndex, to);
        } else if (operation == TransactionOperation.transferERC721) {
            require(to == address(0));
            uint contractIndex;
            address receiver;
            uint tokenId;
            (contractIndex, receiver, tokenId) = fallbackDataParser(data);
            require(ERC721Tokens[contractIndex] != address(0));
            require(isERC721Tokens[ERC721Tokens[contractIndex]].created);
            require(isERC721Offside[schainHash][ERC721Tokens[contractIndex]]);
            if (
                IERC721Full(ERC721Tokens[contractIndex]).ownerOf(
                    tokenId
                ) == address(this)
            ) {
                IERC721Full(ERC721Tokens[contractIndex]).transferFrom(
                    address(this), 
                    receiver, 
                    tokenId
                );
                require(
                    IERC721Full(ERC721Tokens[contractIndex]).ownerOf(
                        tokenId
                    ) == receiver
                );
            }
        } else if (operation == TransactionOperation.createERC721) {
            require(to == address(0));
            uint contractIndex = fallbackContractIndexDataParser(data);
            to = TokenFactoryForSchain(tokenFactoryAddress).createERC721(data);
            isERC721Tokens[to].created = true;
            isERC721Tokens[to].index = contractIndex;
            ERC721Tokens[contractIndex] = to;
            isERC721Offside[schainHash][to] = true;
            isERC721Offside[keccak256(abi.encodePacked("Mainnet"))][to] = true;
        } else if (operation == TransactionOperation.rawTransferERC20) {
            address receiver;
            uint amountOfTokens;
            (receiver, amountOfTokens) = fallbackRawDataParser(data);
            if(ERC20Detailed(to).balanceOf(address(this)) >= amountOfTokens) {
                require(ERC20Detailed(to).transfer(receiver, amountOfTokens));
            }
            // need to add mint support
        } else if (operation == TransactionOperation.rawTransferERC721) {
            address receiver;
            uint tokenId;
            (receiver, tokenId) = fallbackRawDataParser(data);
            if (IERC721Full(to).ownerOf(tokenId) == address(this)) {
                IERC721Full(to).transferFrom(address(this), receiver, tokenId);
                require(IERC721Full(to).ownerOf(tokenId) == receiver);
            }
            // need to add mint support
        }
    }

    /**
     * @dev Convert first byte of data to Operation
     * 0x01 - transfer eth
     * 0x02 - create ERC20 token
     * 0x03 - transfer ERC20 token
     * 0x04 - create ERC721 token
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
            operationType == 0x02 ||
            operationType == 0x03 || 
            operationType == 0x04 || 
            operationType == 0x05 ||
            operationType == 0x13 ||
            operationType == 0x15,
            "Operation type is not identified"
        );
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

    function fallbackContractIndexDataParser(bytes memory data)
        internal
        pure
        returns (uint)
    {
        bytes32 contractIndex;
        assembly {
            contractIndex := mload(add(data, 33))
        }
        return uint(contractIndex);
    }

    function fallbackRawDataParser(bytes memory data) 
        internal 
        pure 
        returns (address, uint) 
    {
        bytes32 to;
        bytes32 amount;
        assembly {
            to := mload(add(data, 33))
            amount := mload(add(data, 65))
        }
        return (address(bytes20(to)), uint(amount));
    }

}