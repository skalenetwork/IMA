# IMA Linked List Optimization

## 1 TL;DR

### 1.1 Problem

Currently IMA puts lots of computational load on geth by searching history for IMA message events.
This can significantly slow IMA performance and limit the number of chains we can run.

### 1.2 Solution

This proposal totally eliminates searches by creating a _linked list of IMA messages_.
Each message includes the block number of the previous message.  This glues all IMA messages into a linked list,
where one can easily go back in history.

To find all messages, one starts from the latest message and then goes back in history by traversing the linked list.
On each step, ```eth_getLogs``` is called for a single block only.

### 1.3 Gas cost

This spec does not significantly increase gas costs.

## 2 Illustration

![Alt text](illustration1.png)

## 3 Proposed changes to IMA contracts

### 3.1 Add lastOutgoingMessageBlockId to ConnectedChainInfo

The idea is to store the block number where event containing last message was emitted.

_Proposed change:_

A. Add ```lastOutgoingMessageBlockId``` to `ConnectedChainInfo` structure. This variable will store the block ID of the last outgoing message, which is the head of the linked list.

B.  Each time a new outgoing message is received update ```lastOutgoingMessageBlockID``` and ```outgoingMessageCounter```, and then save the
```ConnectedChainInfo.outgoingMessageCounter``` variable.

Note: if IMA did not yet have any outgoing messages , ```lastOutgoingMessageBlockId``` will be zero.

### 3.2 Emit event with previousOutgoingMessageBlockId to reference to previous message

_Proposed change:_

A. Add new event

```solidity
event PreviousMessageReference (
    uint256 currentMessage,
    uint256 previousOutgoingMessageBlockId
);
```

Note: for the first message , ```previousOutgoingMessageBlockId``` will be zero.

B.  Each time a new outgoing message is received emit `PreviousMessageReference` event before overriding `previousOutgoingMessageBlockId` and then save the
```ConnectedChainInfo.outgoingMessageCounter``` and `ConnectedChainInfo.previousOutgoingMessageBlockId` variables.

### 3.3 Add separate getter functions for lastOutgoingMessageBlockId and outgoingMessageCounter

_Proposed change:_

Add separate getter functions for ```lastOutgoingMessageBlockId``` and ```outgoingMessageCounter``` variables. This is to make IMA smart contracts
easy to use by IMA agent.

## 4 Pseudo code of IMA contract operation

For a new outgoing message:

1. Read ```lastOutgoingMessageBlockId```
2. Increment ```outgoingMessageCounter```
3. Emit `OutgoingMessage` event
4. Emit `PreviousMessageReference` setting ```previousOutgoingMessageBlockId``` to ```lastOutgoingMessageBlockId``` and ```currentMessage``` to ```outgoingMessageCounter```
5. Set ```lastOutgoingMessageBlockId``` to the current block id.

## 5 Pseudo code of IMA agent

1. Read ```outgoingMessageCounter``` for the source chain and ```incomingMessageCounter``` for the destination chains.

2. Calculate ```numberOfMessagesToBeDelivered = outgoingMessageCounter - incomingMessageCounter```

3. Read ```lastOutgoingMessageBlockID```

4. Set ```currentBlock = lastOutgoingMessageBlockID```

5. Get events for this block using ```eth_getLogs```

6. Parse all IMA messages in this block.

7.
   - if it exists take the oldest `PreviousMessageReference` event for the block and get ```previousOutgoingMessageBlockId```
   - absence of a `PreviousMessageReference` mean that an agent interacts with old version of smart contract. In this case search must be perform in legacy way 

8. Set ```currentBlock = previousOutgoingMessageBlockID```

9. Go to 4. and repeat until all required messages have been read.

## 6 Update strategy for the network

### 6.1: Implement new behavior in the IMA agent

Implement new behavior in the IMA agent. It must be compatible with old smart contracts.

### 6.2: Update the network with the new agent

Update the network with the new agent. The agent will work in legacy mode.

### 6.3: Update the main net smart contracts

Update the ETH main net smart contracts. Note, that the old behavior will still work with new contracts.

### 6.4: Update the SKALE chain smart contracts

As all SKALE chains owners to update their smart contracts. Note, that the old behavior will still work with new contracts.

### 6.4. Wait until all old messages are delivered

Wait until all old messages are delivered. These are messages without `PreviousMessageReference` event in the same block.

### 6.5. Switch IMA to use the new behavior

Switch the IMA to use the new behavior.

## 7. Advantages

- new behavior totally removes the need for search while not increasing gas costs significantly

- old behavior can still be executed if needed

- contract changes and agent changes are relatively small
