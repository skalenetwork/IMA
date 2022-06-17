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


## Implementation





