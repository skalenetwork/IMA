# IMA Linked List Optimization

## TL;DR

Currently IMA puts lots of computational load on geth by searching history for IMA message events.
This can significantly slow IMA performance.

This proposal totally eliminates searches by creating a linked list of IMA messages. 

Each message includes the block number of the previous message.  This glues all IMA messages into a linked list,
where one can easily go back in history.

To find all messages, one starts from the latest message and then goes back in history by traversing the linked list. 

On each step, $eth_getLogs$ is called for a single block only.

This spec does not significantly increase gas costs, since existing variables are used and the number of 
SSTORE operations does not change. 


## Implementation details

### 1. Add lastOutgoingMessageBlockId to ConnectedChainInfo.outgoingMessageCounter


Currently IMA uses ```ConnectedChainInfo.outgoingMessageCounter``` variable which has 256 bits.  Note, that the first 128 bits of this variable are always zero and can be used to store useful data.


```Proposed change```


A. Use first 128 bits of ```outgoingMessageCounter```  to store ```lastOutgoingMessageBlockId```. This variable will store the block ID of the last outgoing message, which is the head of the linked list.


```ConnectedChainInfo.outgoingMessageCounter = lastOutgoingMessageBlockId || outgoingMessageCounter```


B.  Each time a new outgoing message is received update lastOutgoingMessageBlockID and outgoingmessageCounter, and then save the 
```ConnectedChainInfo.outgoingMessageCounter``` variable. 

It will require a single SSTORE operation, so the gas costs wont change significantly compared to what IMA has now. 


### 1. Add lastOutgoingMessageBlockId to outgoingMessageCounter











