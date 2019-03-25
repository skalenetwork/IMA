pragma solidity ^0.4.24;

interface ContractReceiver {
    function postMessage(address sender, string schainID, address to, uint amount, bytes data) external;
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
        uint amount,
        bytes data,
        uint length
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
    function postOutgoingMessage(string dstChainID, address dstContract, uint amount, address to, bytes data) public {
        //require(msg.sender == depositBoxAddress); TODO: know a bank address on THIS Schain
        require(connectedChains[keccak256(abi.encodePacked(dstChainID))].inited);
        connectedChains[keccak256(abi.encodePacked(dstChainID))].outgoingMessageCounter++;
        emit OutgoingMessage(dstChainID, connectedChains[keccak256(abi.encodePacked(dstChainID))].outgoingMessageCounter - 1, msg.sender, dstContract, to, amount, data, data.length);
    }

    function postIncomingMessages(string srcChainID, uint64 startingCounter, address[] memory senders, address[] memory dstContracts, address[] memory to, uint[] memory amount, bytes memory data, uint[] memory lengthOfData/*uint[2] memory blsSignature*/) public {
        //require(msg.sender == owner);
        require(connectedChains[keccak256(abi.encodePacked(srcChainID))].inited);
        require(senders.length == dstContracts.length);
        require(startingCounter == connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter);

        // TODO: Calculate hash and verify BLS signature on hash

        uint index = 0;
        for (uint32 i = 0; i < senders.length; i++) {
            bytes memory newData;
            uint length = lengthOfData[i];
            assembly {
                switch iszero(length)
                case 0 {
                    // Get a location of some free memory and store it in tempBytes as
                    // Solidity does for memory variables.
                    newData := mload(0x40)
                    // The first word of the slice result is potentially a partial
                    // word read from the original array. To read it, we calculate
                    // the length of that partial word and start copying that many
                    // bytes into the array. The first word we copy will start with
                    // data we don't care about, but the last `lengthmod` bytes will
                    // land at the beginning of the contents of the new array. When
                    // we're done copying, we overwrite the full first word with
                    // the actual length of the slice.
                    let lengthmod := and(length, 31)

                    // The multiplication in the next line is necessary
                    // because when slicing multiples of 32 bytes (lengthmod == 0)
                    // the following copy loop was copying the origin's length
                    // and then ending prematurely not copying everything it should.
                    let mc := add(add(newData, lengthmod), mul(0x20, iszero(lengthmod)))
                    let end := add(mc, length)

                    for {
                        // The multiplication in the next line has the same exact purpose
                        // as the one above.
                        let cc := add(add(add(data, lengthmod), mul(0x20, iszero(lengthmod))), index)
                    } lt(mc, end) {
                        mc := add(mc, 0x20)
                        cc := add(cc, 0x20)
                    } {
                        mstore(mc, mload(cc))
                    }

                    mstore(newData, length)

                    //update free-memory pointer
                    //allocating the array padded to 32 bytes like the compiler does now
                    mstore(0x40, and(add(mc, 31), not(31)))
                }
                //if we want a zero-length slice let's just return a zero-length array
                default {
                    newData := mload(0x40)

                    mstore(0x40, add(newData, 0x20))
                }
            }

            ContractReceiver(dstContracts[i]).postMessage(senders[i], srcChainID, to[i], amount[i], newData);
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
