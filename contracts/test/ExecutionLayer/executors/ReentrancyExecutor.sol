
pragma solidity 0.8.27;

import {Executor, IExecutionManager} from "../../../schain/ExecutionLayer/Executor.sol";

import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {ProtocolTypes} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/ProtocolTypes.sol";
import {SchainHash} from "@skalenetwork/ima-interfaces/DomainTypes.sol";
contract ReentrancyExecutor is Executor {
    ExecutorId public constant ID = ExecutorId.wrap(keccak256("ReentrancyExecutor"));

    function _executeWithTokens(
        ProtocolTypes.TokenInfo[] memory inputTokens,
        bytes memory
    )
        internal
        override
        returns (ProtocolTypes.TokenInfo[] memory outputTokens)
    {
        // should revert allways because of reentrancy
        executionManager.execute(
            executionManager.createSimpleMetaAction(SchainHash.wrap(bytes32(0)), new ProtocolTypes.Action[](0)),
            inputTokens,
            new ProtocolTypes.Action[](0)
        );
        return inputTokens;
    }
}
