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
        rawTransferERC20, 
        rawTransferERC721
    }

    // ID of this schain,
    string public chainID;

    address public proxyForSchainAddress;

    address public tokenFactoryAddress;

    mapping(bytes32 => address) public tokenManagerAddresses;

    mapping(uint => address) public ERC20Tokens;
    mapping(address => uint) public ERC20Mapper;

    mapping(uint => address) public ERC721Tokens;
    mapping(address => uint) public ERC721Mapper;

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
        payable
    {
        uint contractPosition = ERC20Mapper[contractHere];
        require(contractPosition != 0);
        
        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(3)), 
            bytes32(contractPosition), 
            bytes32(bytes20(to)), 
            bytes32(amount)
        );
        rawTransferERC20("Mainnet", contractHere, address(0), msg.sender, amount, msg.value, data);
        
    }

    function rawExitToMainERC20(
        address contractHere, 
        address contractThere, 
        address to, 
        uint amount
    ) 
        public
        payable
    {
        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(19)), 
            bytes32(bytes20(to)), 
            bytes32(amount)
        );
        rawTransferERC20("Mainnet", contractHere, contractThere, msg.sender, amount, msg.value, data);
    }

    function exitToMainERC721(address contractHere, address to, uint tokenId)
        public
        payable
    {
        uint contractPosition = ERC721Mapper[contractHere];
        require(contractPosition != 0);

        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(5)), 
            bytes32(contractPosition), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        rawTransferERC721("Mainnet", contractHere, address(0), msg.sender, tokenId, msg.value, data);
    }

    function rawExitToMainERC721(
        address contractHere, 
        address contractThere, 
        address to, 
        uint tokenId
    ) 
        public
        payable
    {
        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(21)), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        rawTransferERC721("Mainnet", contractHere, contractThere, msg.sender, tokenId, msg.value, data);
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
        payable
    {
        
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        uint contractPosition = ERC20Mapper[contractHere];
        require(contractPosition != 0);

        bytes memory data;
        string memory name = ERC20Detailed(contractHere).name();
        uint8 decimals = ERC20Detailed(contractHere).decimals();
        string memory symbol = ERC20Detailed(contractHere).symbol();
        uint totalSupply = ERC20Detailed(contractHere).totalSupply();

        data = abi.encodePacked(
            bytes1(uint8(3)), 
            bytes32(contractPosition), 
            bytes32(bytes20(to)), 
            bytes32(amount),
            bytes(name).length, 
            name, 
            bytes(symbol).length, 
            symbol, 
            decimals, 
            totalSupply
        );
        
        rawTransferERC20(schainID, contractHere, address(0), msg.sender, amount, msg.value, data);
    }

    function rawTransferToSchainERC20(
        string memory schainID, 
        address contractHere, 
        address contractThere, 
        address to, 
        uint amount
    ) 
        public
        payable
    {
        require(keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")));
        require(tokenManagerAddresses[keccak256(abi.encodePacked(schainID))] != address(0));
        

        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(19)), 
            bytes32(bytes20(to)), 
            bytes32(amount)
        );
        rawTransferERC20(schainID, contractHere, contractThere, msg.sender, amount, msg.value, data);
    }

    function transferToSchainERC721(
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
        uint contractPosition = ERC721Mapper[contractHere];
        require(contractPosition != 0);

        bytes memory data;
        string memory name = IERC721Full(contractHere).name();
        string memory symbol = IERC721Full(contractHere).symbol();

        data = abi.encodePacked(
            bytes1(uint8(5)), 
            bytes32(contractPosition), 
            bytes32(bytes20(to)), 
            bytes32(tokenId),
            bytes(name).length, 
            name, 
            bytes(symbol).length, 
            symbol
        );
        rawTransferERC721(schainID, contractHere, address(0), msg.sender, tokenId, msg.value, data);
    }

    function rawTransferToSchainERC721(
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

        bytes memory data;

        data = abi.encodePacked(
            bytes1(uint8(21)), 
            bytes32(bytes20(to)), 
            bytes32(tokenId)
        );
        rawTransferERC721(schainID, contractHere, contractThere, msg.sender, tokenId, msg.value, data);
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
            if (ERC20Tokens[contractIndex] == address(0)) {
                to = TokenFactoryForSchain(tokenFactoryAddress).createERC20(data);
                ERC20Tokens[contractIndex] = to;
                ERC20Mapper[to] = contractIndex;
                emit ERC20TokenCreated(fromSchainID, contractIndex, to);
            }
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
            
            }
            return;
        } else if (operation == TransactionOperation.transferERC721) {
            require(to == address(0));
            uint contractIndex;
            address receiver;
            uint tokenId;
            (contractIndex, receiver, tokenId) = fallbackDataParser(data);
            if (ERC721Tokens[contractIndex] == address(0)) {
                to = TokenFactoryForSchain(tokenFactoryAddress).createERC721(data);
                ERC721Tokens[contractIndex] = to;
                ERC721Mapper[to] = contractIndex;
            }
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
            return;
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
    
    function rawTransferERC20(string memory toSchainID, address contractHere, address contractThere, address from, uint amount, uint amountOfEth, bytes memory data) internal {
        require(
            ERC20Detailed(contractHere).allowance(
                from, 
                address(this)
            ) >= amount
        );
        require(
            ERC20Detailed(contractHere).transferFrom(
                from, 
                address(this), 
                amount
            )
        );
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            toSchainID, 
            tokenManagerAddresses[keccak256(abi.encodePacked(toSchainID))], 
            amountOfEth, 
            contractThere, 
            data
        );
    }
    
    function rawTransferERC721(string memory toSchainID, address contractHere, address contractThere, address from, uint tokenId, uint amountOfEth, bytes memory data) internal {
        require(
            IERC721Full(contractHere).getApproved(tokenId) == address(this)
        );
        IERC721Full(contractHere).transferFrom(
            from, 
            address(this), 
            tokenId
        );
        require(IERC721(contractHere).ownerOf(tokenId) == address(this));
        ProxyForSchain(proxyForSchainAddress).postOutgoingMessage(
            toSchainID, 
            tokenManagerAddresses[keccak256(abi.encodePacked(toSchainID))], 
            amountOfEth, 
            contractThere, 
            data
        );
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