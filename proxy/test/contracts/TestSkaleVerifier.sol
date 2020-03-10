
pragma solidity ^0.5.0;


contract SkaleVerifier {

    function verifySchainSignature(
        uint256 signA,
        uint256 signB,
        bytes32 hash,
        uint256 counter,
        uint256 hashA,
        uint256 hashB,
        string calldata schainName
    )
        external
        view
        returns (bool)
    {
        return true;
    }
}
