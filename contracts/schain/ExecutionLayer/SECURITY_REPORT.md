# Execution Layer

As part of critical infrastructure, there's need to carefully evaluate failing points introduced by the Execution Layer, and also atack entry points that can be exploited by bad actors.


## Errors

Bellow is a list of possible steps in execution in which something can naturally fail and thus the failure needs to be accounted for. For each, there should be a dedicated section describing how they are or are't being treated.


- [X] [Error when user calls execute()](#error-when-user-calls-execute)
- [ ] [Error on Bridging Tokens](#error-on-bridging-tokens)
- [ ] [Paralel execution from Schains](#paralel-execution-from-schains)
- [X] [Error during processing Meta Action](#error-during-processing-a-meta-action)
- [X] [Error during processing Meta Action confirmation](#error-during-processing-a-meta-action-confirmation)
- [X] [Error on broadcasting Error](#error-on-broadcasting-error) - Out of scope for V1
- [ ] [Not Enough gas to Lock Tokens](#not-enough-gas-to-lock-tokens)

*Marked mean they are fully handled. Blank items need attention.*

### Not Enough gas to Lock Tokens

**Invariant:** Tokens will be locked before any state mutation is attempted. Failure to lock results in a hard revert and no partial state with tokens lost in Execution Manager.

In theory this is very unlikely to naturally happen as only authorized Agents post messages on the MessageProxy and there's usualy a pre-defined minimum amount of gas sent. Nontheless, if for any reason this happens, tokens will stay stuck in the ExecutionManager.

Similar to other errors in which tokens are lost in the Execution Manager, the only ideal solution would be to allow locking the tokens right after a transfer has been made or completely revert the transfer is it failed. Otherwise, there's really no straightforward way to handle this case...

An idea that would mitigate this, would be to limit the maximum amount of tokens. This means Execution Managers would never send more than N tokens nor receive more than N tokens.


### Error on broadcasting Error

When either processing a Meta Action or Meta Action Confirmation message fails, tokens are locked, and a message informing an Error occurred should be sent to the previous Schains. It's expected that this message should arrive properly, as it was also received properly. In any case, for simplicity, tokens will stay locked in case of an error (by default).

On the first iteration of the solution, we will let off-chain components determine failure of executions by listening to events emited. In the future, a message relaying Error (with or without tokens) could be sent.

**Note for future: Sending an error message should NEVER compromise the context in which tokens were locked.**

### Error during processing Meta Action confirmation


The idea is the same as in [here](#error-during-processing-a-meta-action). Confirmation triggers first the execution of postActions, and then the sending of confirmation to the previous chain or the sending of the remaining tokens to the user. The failsafe process is thus also locking the tokens firstly, and then using an external call to attempt to process the confirmation message and isolate any revert events. In case anything fails for any reason, the original tokens locked will stay locked and can be unlocked by the user, ExecutionManager, or multisig(?).

### Error during Processing a Meta Action
[Back To Index](#errors)


When a ExecutionManager receives a MetaAction to process, and successfuly locks tokens before attempting execution, it will trigger the execution process.

The process is straightforward: To isolate reverts and errors from anything after locking the tokens, we create an external call to the executor, and check for it's success. If any action reverts for any reason, every action before that on the same chain will also revert untill the context in which tokens were locked. Tokens can then be unlocked by the Execution Manager, multisig wallet eventualy, or by the token owners. Also, it's worth noting that after execution is completed, an attempt will be made to send the next Meta Action or the confirmation of the process. If this process fails, the same happens and all the actions performed on this chain will be reverted.

**This simplifies the process, which in turn allows for less blindspots in execution branches. In future upgrades after the solution is proven resilient, we might consider allowing for more fine grained error handling and complex behaviour.**

It's important to remember that actions could revert by having consumed all the gas from the transaction. Therefore, the low-level external call is done so that a failsafe amount of gas is saved for error handling and emiting and Event to log the error in case anything fails after locking the tokens.


### Error when user calls execute
[Back To Index](#errors)

The execute function can fail at verious different levels. Right now, it triggers no Actions on the creating chain. It only pulls tokens from the user, and sends the tokens and nextMetaAction to the next Chain.

It can thus either fail when pulling tokens from the user, when bridging the tokens to the next chain via TokenManager, or when posting a Message to MessageProxy when sending the MetaAction to the ExecutionManager on the next chain.

Either way, if any of these fails, all the changes are reverted and so tokens will be returned to the user and no state changes are persisted.

### Error on Bridging Tokens
[Back To Index](#errors)

This might be one of the most likely ones to happen.
With the current implementation, It's not possible to send batches of transactions to MessageProxy to be executed all at once as a single atomic transaction. This error is only relevant when the **target** Chain fails to receive the tokens!!

Let us imagine the scenario in which ExecutionManager bridged X amount of USDC and X amount of USDT to perform some action on another chain. This actualy posts 3 outgoing messages in MessageProxy. the first two are the transfers of the tokens, and the last is the encoded Message with MetaAction data for the ExecutionManager.

Messages from the same Schain cannot arrive out of order. However, one of the first 2 messages can arrive and FAIL. The message counter is still increased when the second message fails, and thus the third message will be accepted.

So in this scenario, when ExecutionManager received the Message from proxy (outgoing message 3), it owns X amount of USDC and might own less than 0 tokens of USDT. The first step in the processing of the received message is locking the tokens that should have been sent beforehand. ExecutionManager will thus successfuly lock X amount of USDC for the given MetaActionId, but 0 of USDT. The action will be marked as failed and investigation of what failed in the bridging of the token must be done.

### Paralel execution from Schains
[Back To Index](#errors)

This represents a more serious case of - [this](#error-on-bridgind-out-tokens). In this case, let us imagine 3 Schains: A, B, and C.

Let us imagine two different users, one on chain A and another on chain B, want to execute a swap of USDC for BTC on chain C.

To this end, user on chain A triggers execution on ExecutionManager in A, allowing for 200 USDC to be swapped. ExecutionManager thus posts 2 outgoing messages on MessageProxy, from chain A to C.

User on chain B does the exact same thing, but wants to swap only 100 USDC. So ExecutionManager posts 2 outgoing messages from chain B to chain C.

Let us imagine the scenario in which messages arrive to chain C in the following order:
1. 100 USDC from chain B are minted to ExecutionManager
2. 200 USDC from chain A fail to mint to ExecutionManager
3. Message from chain B arrives to ExecutionManager
4. Message from chain A arrives to ExecutionManager

In this case, ExecutionManager will first try to lock 100 tokens to execute message comming from chain B. It succeeds as it has enough balance, and has no knowledge of where these came from. Swap is executed, and the correspondent amount of BTC is sent to the user on chain C.

Then, the user will try to lock 200 USDC tokens to execute the message coming from chain A. It will have only 100 USDC in balance, and thus it will fail to lock 200 tokens. Execution will not succeed and it will be marked as failed.

Obviously, this should not happend. The tokens should be tied somehow to a specific MetaActionId as soon as they are received, but with current architecture this is not seem possible to guarantee with on-chain processes (or can we acceed messageProxy for success status in received messages??).

**There is no clear approach to this issue given the current architecture of MessageProxy.**

This allows tokens to be left lost in ExecutionManager, and which can then be somehow stolen by malformed Actions. The naive solution is to allways lock the maximum amount available of tokens, but this will cause issues when tracing where each tokens belongs to, complex re-distributions, unlocking of tokens, etc.

I see two aproaches. The first requires that we can somehow check past N incoming messages and from there define the next behaviour. Since messages from particular Schain arrive in order, when receiving a message with a list of N tokens, we can check the status of the last N processed messages from this chain and thus check which tokens arrived and which did not.

The second, requires changing MessageProxy so that it allows to send batches of messages that either all succeed, or all fail. This would allow us to send N token transfer and 1 extra message to automaticaly lock these on ExecutionManager. This xecond one feels extra costly in terms of Dev time, and adds significant change in the messageProxy logic for both on-chain and off-chain components.




## Hacks

Here we post some thoughts on entry points for malicious actors, how they can compromise the systems, and how do we eliminate or mitigate such threats.

There are X main entry points for malicious actors:

1. [**Executors:**](#executors) Even thought we whitelist executor contracts, some of them we might not own or control in the future. It's imperative to assume ANYTHING can be called from these executors, as we cannot attest for their correctness at every given point in time. More in dedicated section
2. [**Chain Cycles:**](#executors) The current design should not allow for a user to send a Meta Action that passes twice on the same chain (except oviously during propagation of Confirm Messages). The way 'forward' should not have any 'loops'.
3. [**Gas Exploits:**](#executors) One of the easiest way to trigger a revert of any transaction is not providing it with enought gas to begin with. The issue lies especialy on how sure are we that Relayer Agents will allways provide minimal amount of gas for any transaction to MessageProxy.
4. [**Concurrent Executions:**](#executors) We've detailed this scenario in [Error](#paralel-execution-from-schains). During correct behaviour, the error in theory can be fixed and recovered. However, there's a change specific MetaAction formations are created to exploit this issue.
5. [**Reentrancy**](#reentrancy)

*Many might be missing. Comments and thoughts are welcomed!*

Some notes TODO:
- Executors directly send tokens to the ExecutionManager. Recommend to change to pull-based approach -> guarantees function is not overriden, and we controll which tokens to pull.

### Reentrancy

The only function that is external and not access restricted is execute().

By placing a reentrancy guard in the two entry points for execution of messages:
- postMessage()
- execute()

we should have successfuly eliminate the issue. Each time there's a postMessage, there can't be an execute, and vice-versa.





### Executors
[Back To Index](#hacks)

Clearly the issue with executors is that we do not control these contracts, thus it's hard to attest for their security at all times. The team will whitelist contracts, yet, we should design the solution assuming these executors WILL, at some point, try to exploit IMA.

The first big requirement to mitigate unforseen issues is to ensure all entry points to the contract have reentrancy guards at the right level. ***TODO***

Since the team will not own most of the Executor contracts, it's assumed that a user that sends a MetaAction that executes some action on a given contract actualy trusts this contract, as any malicious behaviour that does not affect the integrity of Execution Manager is out of our control. The team will make it's due diligence while whitelisting contracts, but contract's logic can be upgraded or delegated and thus it's impossible to ensure on-chain that it does not change over time.

**Can we introduce an extra TokenInfo in a MetaAction that defines the expected minimum amount of each token expected after execution of all actions on each chain? This would allow us to revert all actions by default if unnexpected outcomes is flagged**

Another way an executor can trigger issues is by consuming all gas it was provided, but this is already safeguarded. In the future we can consider to add more comprehensive error handling to provide fine-tuned feedback on-chain about errors triggered on Executor contracts.


### Chain Cycles
[Back To Index](#hacks)

The current design of IMA and Token Managers does not allow for cycles. It's unclear if we should actualy block this, because in fact most of the times the affected person is the MetaAction creator and not us. In any case, since TokenManagers can create token wrappers if a clone is not already defined for a given toke we can encounter the following:

1. Token1 created in chain A
2. cloneToken1 created on chain B when bridging from A to chain B.
3. cloneCloneToken1 created on chain C when bridging from B to C.
4. cloneCloneCloneToken1 created on chain A when bridging from C to A.

On step 4, idealy, it should have used Token1. This is a very common issue with bridges in blockchain interoperability that creates fragmentation in the space. Solving this is possible but non-trivial, and out of scope for now. This is already possible with the current IMA implementation.

Appart from token fragmentation, the current implementation sends Confirmation message backwards to the chains from which it received a MetaData message. This MetaData has a unique ID which is the same in all chains. With current implementation, a cycle in execution might stuck Execution Manager in a constant loop of sending confirmation messages. This may trigger issues like tokens in circulation forever or message proxies and agents allways full with these stuck messages. Therefore, we should not allow cycles: Either force failing during execution if loop is detected, or at MetaData creation by validating input, or both.

### Gas Exploits
[Back To Index](#hacks)

This section will be quite short, as we believe it's fully mitigated and mostly under investigation also for Errors. Basicaly the only issue that might occur is if any message to Execution Manager is not given enough gas to even lock the tokens. Any quantity that allows for locking the tokens with some comfort, will in the worst case scenario fail and tokens will be locked.

Executors are given controlled ammounts of Gas so even if they consume it, the tokens are guaranteed to stay locked. Optionaly, we can even limit the use of gas for ***each*** call to executors, but seems it can be put out of scope for now as it would add extra complexity not required at this stage.


### Concurrent Executions
[Back To Index](#hacks)

We've seen this issue in detail in [Errors](#paralel-execution-from-schains). While it can occurr without any malitious intentions, the most dangerous form is when it happens with the intend to consume tokens that are not meant to be consumed.

In theory, since tokens will be taken from the user at some stage and an executor is forced to send to the Execution Manager the exact amount of tokens it produces as output value, Tokens consumed by an execution have been consumed somewhere. However, the current pattern allows for actions to consume tokens that were not directly bridged to it.

If this is purposely triggered repeatedly, we can find ourselves with very complex token traces to investigate and cause significant ammount of time to regularize. We should definitely not allow this or try to mitigate it as much as possible.

Idealy, while processing a MetaAction, the ExecutionManager should own in it's posession only the tokens that belong to that MetaAction, and not a penny more. This would simplify a lot error handling and allow us to make strict assertions of state throughout the execution cycle.


