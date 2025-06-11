# Execution Layer

With the goal of streamlining user experience and a unified SKALE echosystem, skale devs came up with the Execution Layer for IMA.
The goal is clear: making interoperability between SKALE chains as easy and straightforward as possible. More precisely, to enable chains to execute actions in parallel with value transfer to make the SKALE Network feel like one chain to users and developers.

By default, SKALE Network is multichain and many chains run in paralel in the echosystem. These chains can opt to connect between each other via the Interchain Message Agent (IMA) in addition to the connection to Mainnet. Ideally, chain owners can opt to connect to the chains that offer the properties they need (such as Europa for Liquidity), and also bootstrap only the functionality they need for their chain.

The vast majority of value once on the SKALE Network is being moved through what we consider to be the 2nd Layer (Layer 2) of IMA, or the TokenManager Layer. These TokenManagers are built on top of the MessageProxyForSchain (Layer 1) and help facilitate the locking, minting, burning and transfer of funds via smart contracts. These contracts while efficient are not simple for developers to build on top of and orchestrate complex use-cases. Also, this is blockchain and therefore we know that many of these flows for every network are still complex. The goal is to make it as easy as possible for users to engage and use the technology. Here is an example of an experience when moving between chains and the number of actions that need to be taken without Execution Manager:

0. User A has X USDC on Nebula chain and want to buy NFT for X USDC on NFT Marketplace on Calypso chain.
1. User A makes a tx approve X USDC to TokenManager on Nebula chain (if not approved yet).
2. User A makes a tx transfer X USDC from Nebula to Europa chain.
3. User A makes a tx approve X USDC to TokenManager on Europa chain (if not approved yet).
4. User A makes a tx transfer X USDC from Europa to Calypso chain.
5. User A makes a tx approve X USDC to NFT marketplace.
6. User A makes a tx buy NFT on NFT Marketplace.

First 4 steps are done on Portal and last 2 steps done on Marketplace. With Execution Layer, we aim to abstract the user of all the intermediate steps, and reduce these to a 2-step only process:

0. User A has X USDC on Nebula chain and want to buy NFT for X USDC on NFT Marketplace on Calypso chain.
1. User A makes a tx approve X USDC to ExecutionManager on Nebula chain (if not approved yet).
2. User A sends a comprehensive request to ExecutionManager containing the steps, and everything else is done automatiacaly by the Execution Layer.

The rest of this file contains a comprehensive description of the new components.

## Architecture

We split the architecture into 3 majour layers, which are:

1. Message Proxy Layer
2. Token Manager Layer
3. Execution Layer --> (new)

When a user creates a request (MetaAction), it is accompanied by a set of Tokens (TokenInfo) that are to be used by the process. Let us imagine a MetaAction that is programmed to bridge X ammount of tokens from chain A to chain B, and swap these tokens on chain B. From the user's perspective this is just a 2-step process, but the following actions are taking place:

1. The call is made directly to the ExecutionManager on chain A, which evaluates the MetaAction provided and pulls the tokens provided by the user to execute it.
2. After pulling the tokens, the ExecutionManager forwards this tokens to the next Schain (B), via the TokenManager, which then posts an outgoing message to Proxy Layer.
3. After instructing the TokenManager to bridge the tokens, the ExecutionManager needs to forward the MetaAction to the ExecutionManager on the next chain (B) via the ProxyLayer.
4. When the executionManager (on B) receives the MetaAction from the ProxyLayer, it first locks the tokens it should have received in advance.
5. It evaluates the received MetaAtion, and makes sequential calls to trusted Executors() which in this case should execute the intended swap of tokens.
6. After all actions are concluded, if there's no nested MetaAction, it starts to process Confirmation of the execution:
    6.1. If there are missing tokens from execution, it locks them, and only then tries to send them back to the source chain (A) along with the confirmation message. Once confirmation reaches the source chain (A), the tokens are sent to the creator of the MetaAction.
    6.2 If there are no missing tokens, it simply sends the confirmation message with no tokens attatched.


## Components

### Execution Manager

This is the main components responsible for handling MetaAction processing, securing tokens during execution and orchestrating calls to Executor contracts.

#### Data Structures

**Action**

```solidity
struct Action {
    ExecutorId executor;
    bytes arguments;
}
```
Structure containing data about the executor and the arguments to be passed to for Executor contract to execute the action.

**MetaAction**

```solidity
struct MetaAction {
    SchainHash targetChainHash;
    bytes actions;
    bytes nextMetaAction;
    bytes postActions;
}
```
Structure containing data about actions to be executed on a given Schain.
Contains Nested MetaActions so that ExecutionManager can forward actions to next chains. PostActions are executed when confirmation is being processed (like a callback).

**MetaActionContainer**

```solidity
struct MetaActionContainer {
    uint96 version;
    uint256 seqNumber;
    address sender;
    SchainHash sourceChain;
    MetaActionId id;
    Protocol.MetaActionStatus status;
    Protocol.MetaAction metaAction;
}
```
Structure containing data about an 'Execution' process on a given Schain.
Contains schainHash that sent the metaAction, the creator of the MetaAction, a sequence number (starting at 0 on the origin chain and increasing by one at each subsequent chain), a unique identifier, a staus (Executing, Success, Failed), and the metaAction object associated to it.

**Message**

```solidity
struct Message {
    uint96 version;
    MessageType messageType;
    MetaActionId metaActionId;
    uint256 seqNumber;
    address tokensOwner;
    bytes payload;
}
```

General purpose message struct used for messages between ExecutionManager instances. Contains the metaActionId it corresponds to, arbitrary data, a messageType, a sequence number (incremented at each msg for the same metaActionId), and an address corresponding to the original owner of the tokens ExecutionManager is handling.

**TokenInfo**

```solidity
struct TokenInfo {
    uint256 value;
    address token;
}
```

Standardized structure for representing data about a token being handled by ExecutionManager. Value represents quantity, token is the address pf the token on-chain.

#### Functions

*createMetaAction(SchainHash, Action[])*

Creates a single MetaAction item, with empty next and post Actions.

*createMetaAction(SchainHash s, Action[] a, MetaAction m, Action[] p)*

Created a complete metaAction item, with postActions = p, nextMetaAction = m, actions = a, and targetSchain = s.

*execute(MetaAction m, TokenInfo t, Action[] p)*

External function accepting MetaActions directly from users. It's the starting point for any execution process. Calls _createMetaAction() to format input, and _executeAndSendNextMetaAction to start MetaData processing. Worth mentioning that if any action such as

*_createMetaAction()*

Creates a MetaActionContainer from the input provided, after validation and generation of a unique ID. After creating the MetaDataContainer structure, it tried to pull tokens from the user for subsequent usage.

*_executeAndSendNextMetaAction()*

Receives a MetaActionContainer object and calls _executeActions() and _sendNextMetaAction()

*_executeActions()*

Decodes actions to execute, and orchestrates sequential calls to the Executor contracts to execute all actions.

*_sendNextMetaAction()*

If there's a nested MetaAction object, triggers bridging of tokens to the next chain via the TokenManager and sends the next MetaAction to the target chain via the MessageProxy.
If there's not nested MetaAction, starts executing success procedure using _processMetaActionConfirmation()

*_processMetaActionConfirmation()*

First, executes postActions correspondent to the MetaActionContainer. Then, if the executionManager was the creator of the MetaActionContainer, it sends the remaining tokens (if any) to the creator of the MetaAction. If it's not the creator of the MetaActionContainer and rather it received it from another chain, it sends the tokens back to the previous Schain and sends the confirmation message to the same Schain to be processed.

*postMessage()*

function called by the proxy contract when receiving a message to the ExecutionManager. Checks if the sender is valid, and calls _processMessage().

*_processMessage()*

this function decodes the message into the standard Message format. Checks the messageType field, and calls _receiveMetaAction or _receiveConfirmation according to the type.

*_receiveMetaAction()*

This is the main entry point for MetaActions received from remote ExecutionManager contracts.

First action it does is locking the tokens it should have received in advance. Locking is assured in such way that if any subsequent action fails, the original tokens will stay locked and are unlockable by the token's original owner or the ExecutionManager.

Next, an external call to processMetaAction() is performed to unlock the tokens and execute the actions and sending the next meta action. Before the call, a failsafe ammount of gas is saved to handle errors when execution fails.

*_receiveConfirmation()*

Very simmilar to _receiveMetaAction in the sense that it starts by locking the tokens and then, with some failsafe gas ammout save, externaly calls processMetaActionConfirmation() that will unlock tokens, process postActions if any, and either send remaining tokens to user or send the tokens back to the owner.

*processMetaAction()*

External wrapper to _executeAndSendNextMetaAction().
Only callable by `address(this)`. Unlocks tokens for a given metaActionId before calling _executeAndSendNextMetaAction()

*processMetaActionConfirmation()*

External wrapper to _processMetaActionConfirmation().
Only callable by `address(this)`. Unlocks tokens for a given metaActionId before calling _processMetaActionConfirmation()



## Usage

The best way to see more detailed examples is to reffer to `tests/ExecutionManager.ts`. In anycase, a short example is left below:

**Description:** Example in which user send certain amount tokens from Chain A to Chain B with exection of a swap on Chain B and send back xAmount to Chain C with the remainder sent to user in chain B.

```typescript
const metaAction = asMetaObject(await executionManagerA["createMetaAction(bytes32,(bytes32,bytes)[],(bytes32,bytes,bytes,bytes),(bytes32,bytes)[])"](
    schainBHash,
    [
        {
            executor: ethers.id("SwapMockSwap"),
            arguments: await swapMockSwap.encodeArguments(token1B, 0)
        },
        {
            executor: ethers.id("SendRest"),
            arguments: await sendRest.encodeArguments(user, xAmount)
        }
    ],
    asMetaObject(await executionManagerA["createMetaAction(bytes32,(bytes32,bytes)[])"](
        schainCHash,
        [
            {
                executor: ethers.id("Send"),
                arguments: await send.encodeArguments(user)
            }
        ]
    )),
    []
));
// User allows executor on chain A to pull 'value' of token1A from him
await token1A.connect(user).approve(executionManagerA, value);

// Using token1A
await executionManagerA.connect(user).execute(
    metaAction,
    [{token: token1A, value: value}],
    []
);

// mock example of an agent that will deliver messages in MessageProxy
// this is obviously not required in production
await agent.deliverMessages();

// The result is that on Chain A, user will have 0 balance of token1A
// On chain B, user will have swapped value of token1 to the token2. After that it saves value - xAmmount on chainB, thus that's his balance of token2 on chain B
//On chain C user will receive xAmmount of token2
```
