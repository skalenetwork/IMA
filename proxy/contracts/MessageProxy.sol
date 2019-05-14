pragma solidity ^0.5.0;

interface ContractReceiver {
    function postMessage(
        address sender, 
        string calldata schainID, 
        address to, 
        uint amount, 
        bytes calldata data
    ) 
        external;
}

contract MessageProxy {

    // Note: this uses assembly example from

    // https://ethereum.stackexchange.com/questions/6354/how-do-i-construct-a-call-to-another-contract-using-inline-assembly

    // 16 Agents
    // Synchronize time with time.nist.gov
    // Every agent checks if it is his time slot
    // Time slots are in increments of 10 seconds
    // At the start of his slot each agent:
    // For each connected schain:
    // Read incoming counter on the dst chain
    // Read outgoing counter on the src chain
    // Calculate the difference outgoing - incoming
    // Call postIncomingMessages function passing (un)signed message array

    // ID of this schain, Chain 0 represents ETH mainnet,
    string public chainID;
    // Owner of this chain. For mainnet, the owner is SkaleManager
    address public owner;

    event OutgoingMessage(
        string dstChain,
        uint indexed msgCounter,
        address indexed srcContract,
        address dstContract,
        //bytes4 functionSignature,
        //uint  maxGas,
        //bytes32[] concatenatedParameters
        address to,
        uint amount,
        bytes data,
        uint length
    );

    struct ConnectedChainInfo {
        // BLS key is null for main chain, and not null for schains
        uint[4] publicKey;
        // message counters start with 0
        uint incomingMessageCounter;
        uint outgoingMessageCounter;
        bool inited;
    }

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;

    /// Create a new message proxy

    constructor(string memory newChainID) public {
        owner = msg.sender;
        chainID = newChainID;
        if (keccak256(abi.encodePacked(newChainID)) != 
            keccak256(abi.encodePacked("Mainnet"))
        ) {
            // connect to mainnet by default
            // Mainnet does not have a public key
            uint[4] memory empty;
            connectedChains[
                keccak256(abi.encodePacked("Mainnet"))
            ] = ConnectedChainInfo(empty, 0, 0, true);
        }
    }

    // This is called by  schain owner.
    // On mainnet, SkaleManager will call it every time an
    // schain is created.  Therefore, any schain is always connected to the main chain.
    // To connect to other chains, the owner needs to explicitely call this function
    function addConnectedChain(
        string memory newChainID, 
        uint[4] memory newPublicKey
    ) 
        public 
    {
        //require(msg.sender == owner); // todo: tmp!!!!!
        require(
            keccak256(abi.encodePacked(newChainID)) != 
            keccak256(abi.encodePacked("Mainnet"))
        ); // main net does not have a public key and is implicitely connected
        require(
            !connectedChains[keccak256(abi.encodePacked(newChainID))].inited
        );
        connectedChains[
            keccak256(abi.encodePacked(newChainID))
        ] = ConnectedChainInfo({
            publicKey: newPublicKey,
            incomingMessageCounter: 0,
            outgoingMessageCounter: 0,
            inited: true
        });
    }

    function removeConnectedChain(string memory newChainID) public {
        require(msg.sender == owner);
        require(
            keccak256(abi.encodePacked(newChainID)) != 
            keccak256(abi.encodePacked("Mainnet"))
        ); // you cant remove a connection to main net
        require(
            connectedChains[keccak256(abi.encodePacked(newChainID))].inited
        );
        delete connectedChains[keccak256(abi.encodePacked(newChainID))];
    }

    // This is called by a smart contract that wants to make a cross-chain call
    function postOutgoingMessage(
        string memory dstChainID, 
        address dstContract, 
        uint amount, 
        address to, 
        bytes memory data
    ) 
        public 
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(dstChainID));
        require(connectedChains[dstChainHash].inited);
        connectedChains[dstChainHash].outgoingMessageCounter++;
        emit OutgoingMessage(
            dstChainID, 
            connectedChains[dstChainHash].outgoingMessageCounter - 1, 
            msg.sender, 
            dstContract, 
            to, 
            amount, 
            data, 
            data.length
        );
    }

    function postIncomingMessages(
        string memory srcChainID, 
        uint startingCounter, 
        address[] memory senders, 
        address[] memory dstContracts, 
        address[] memory to, 
        uint[] memory amount, 
        bytes memory data, 
        uint[] memory lengthOfData
        /*uint[2] memory blsSignature*/
    ) 
        public 
    {
        //require(msg.sender == owner);
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));
        require(connectedChains[srcChainHash].inited);
        require(senders.length == dstContracts.length);
        require(to.length == dstContracts.length);
        require(to.length == amount.length);
        require(lengthOfData.length == amount.length);
        require(
            startingCounter == 
            connectedChains[srcChainHash].incomingMessageCounter
        );

        // TODO: Calculate hash and verify BLS signature on hash

        uint index = 0;
        for (uint i = 0; i < senders.length; i++) {
            bytes memory newData;
            uint currentLength = lengthOfData[i];
            assembly {
                switch iszero(currentLength)
                case 0 {
                    newData := mload(0x40)
                    let lengthmod := and(currentLength, 31)
                    let mc := add(
                        add(newData, lengthmod), mul(0x20, iszero(lengthmod))
                    )
                    let end := add(mc, currentLength)

                    for {
                        let cc := add(
                            add(
                                add(
                                    data, 
                                    lengthmod
                                ), 
                                mul(
                                    0x20, 
                                    iszero(lengthmod)
                                )
                            ), 
                            index
                        )
                    } lt(mc, end) {
                        mc := add(mc, 0x20)
                        cc := add(cc, 0x20)
                    } {
                        mstore(mc, mload(cc))
                    }

                    mstore(newData, currentLength)
                    mstore(0x40, and(add(mc, 31), not(31)))
                }
                default {
                    newData := mload(0x40)

                    mstore(0x40, add(newData, 0x20))
                }
            }
            index += currentLength;

            ContractReceiver(dstContracts[i]).postMessage(
                senders[i], 
                srcChainID, 
                to[i], 
                amount[i], 
                newData
            );
        }
        connectedChains[srcChainHash].incomingMessageCounter += 
            uint(senders.length);
    }

    function getOutgoingMessagesCounter(string memory dstChainID) 
        public 
        view 
        returns (uint) 
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(dstChainID));
        require(connectedChains[dstChainHash].inited);
        return connectedChains[dstChainHash].outgoingMessageCounter;
    }

    function getIncomingMessagesCounter(string memory srcChainID) 
        public 
        view 
        returns (uint) 
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));
        require(connectedChains[srcChainHash].inited);
        return connectedChains[srcChainHash].incomingMessageCounter;
    }
}