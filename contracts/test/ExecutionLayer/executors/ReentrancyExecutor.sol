
pragma solidity 0.8.27;

import {Executor, IExecutionManager} from "../../../schain/ExecutionLayer/Executor.sol";
import {ExecutionManager} from "../../../schain/ExecutionLayer/ExecutionManager.sol";
import {TokenInfo} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IActionExecutor.sol";
import {ExecutorId} from "@skalenetwork/ima-interfaces/schain/ExecutionLayer/IExecutor.sol";
import {Protocol} from "../../../schain/ExecutionLayer/Protocol.sol";

interface IExecutionManagerExtended is IExecutionManager{
    function createMetaAction(
        bytes32 targetChain,
        Protocol.Action[] memory actions
    )
        external
        pure
        returns (Protocol.MetaAction memory metaAction);

    function execute(
        Protocol.MetaAction calldata metaAction,
        TokenInfo[] calldata tokens,
        Protocol.Action[] memory postActions
    ) external;
}

contract ReentrancyExecutor is Executor {
    ExecutorId public constant ID = ExecutorId.wrap(keccak256("ReentrancyExecutor"));

    function setExecutionManager(IExecutionManager executionManagerAddress) external {
        executionManager = executionManagerAddress;
    }

    function executeWithTokens(
        TokenInfo[] memory inputTokens,
        bytes memory arguments
    )
        internal
        override
        returns (TokenInfo[] memory outputTokens)
    {
        IExecutionManagerExtended execMan = IExecutionManagerExtended(address(executionManager));
        // should revert allways because of reentrancy
        execMan.execute(
            execMan.createMetaAction(bytes32(0), new Protocol.Action[](0)),
            inputTokens,
            new Protocol.Action[](0)
        );
        return inputTokens;
    }
}
