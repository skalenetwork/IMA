pragma solidity 0.4.24;

interface ContractReceiver {
    function postMessage(address sender, string schainID, address to, uint amount) external;
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
        uint64 indexed msgCounter,
        address indexed srcContract,
        address dstContract,
        //bytes4 functionSignature,
        //uint32  maxGas,
        //bytes32[] concatenatedParameters
        address to,
        uint amount
    );

    struct ConnectedChainInfo {
        // BLS key is null for main chain, and not null for schains
        uint[4] publicKey;
        // message counters start with 0
        uint64 incomingMessageCounter;
        uint64 outgoingMessageCounter;
        bool inited;
    }

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;

    /// Create a new message proxy

    constructor(string newChainID) public {
        owner = msg.sender;
        chainID = newChainID;
        if (keccak256(abi.encodePacked(newChainID)) != keccak256(abi.encodePacked("Mainnet"))) {
            // connect to mainnet by default
            // Mainnet does not have a public key
            uint[4] memory empty;
            connectedChains[keccak256(abi.encodePacked("Mainnet"))] = ConnectedChainInfo(empty, 0, 0, true);
        }
    }

    // This is called by  schain owner.
    // On mainnet, SkaleManager will call it every time an
    // schain is created.  Therefore, any schain is always connected to the main chain.
    // To connect to other chains, the owner needs to explicitely call this function
    function addConnectedChain(string newChainID, uint[4] memory newPublicKey)  public {
        //require(msg.sender == owner); // todo: tmp!!!!!
        require(keccak256(abi.encodePacked(newChainID)) != keccak256(abi.encodePacked("Mainnet"))); // main net does not have a public key and is implicitely connected
        require(!connectedChains[keccak256(abi.encodePacked(newChainID))].inited);
        connectedChains[keccak256(abi.encodePacked(newChainID))] = ConnectedChainInfo({
            publicKey: newPublicKey,
            incomingMessageCounter: 0,
            outgoingMessageCounter: 0,
            inited: true
        });
    }

    function removeConnectedChain(string newChainID) public {
        require(msg.sender == owner);
        require(keccak256(abi.encodePacked(newChainID)) != keccak256(abi.encodePacked("Mainnet"))); // you cant remove a connection to main net
        require(connectedChains[keccak256(abi.encodePacked(newChainID))].inited);
        delete connectedChains[keccak256(abi.encodePacked(newChainID))];
    }

    // This is called by a smart contract that wants to make a cross-chain call
    function postOutgoingMessage(string dstChainID, address dstContract, uint amount, address to) public {
        //require(msg.sender == depositBoxAddress); TODO: know a bank address on THIS Schain
        require(connectedChains[keccak256(abi.encodePacked(dstChainID))].inited);
        connectedChains[keccak256(abi.encodePacked(dstChainID))].outgoingMessageCounter++;
        emit OutgoingMessage(dstChainID, connectedChains[keccak256(abi.encodePacked(dstChainID))].outgoingMessageCounter - 1, msg.sender, dstContract, to, amount);
    }

    function postIncomingMessages(string srcChainID, uint64 startingCounter, address[] memory senders, address[] memory dstContracts, address[] memory to, uint[] memory amount/*uint[2] memory blsSignature*/) public {
        //require(msg.sender == owner);
        require(connectedChains[keccak256(abi.encodePacked(srcChainID))].inited);
        require(senders.length == dstContracts.length);
        require(startingCounter == connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter);

        // TODO: Calculate hash and verify BLS signature on hash

        for (uint32 i = 0; i < senders.length; i++) {
            ContractReceiver(dstContracts[i]).postMessage(senders[i], srcChainID, to[i], amount[i]);
        }
        connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter += uint64(senders.length);
    }

    function getOutgoingMessagesCounter(string dstChainID) public view returns (uint64) {
        require(connectedChains[keccak256(abi.encodePacked(dstChainID))].inited);
        return connectedChains[keccak256(abi.encodePacked(dstChainID))].outgoingMessageCounter;
    }

    function getIncomingMessagesCounter(string srcChainID) public view returns (uint64) {
        require(connectedChains[keccak256(abi.encodePacked(srcChainID))].inited);
        return connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter;
    }
}
