# IMA Linked List Optimization

## TL;DR

Currently IMA puts lots of computational load on geth by searching history for IMA message events.
This can significantly slow IMA performance.

This proposal totally eliminates searches by creating a linked list of IMA messages. 

Each message includes the block number of the previous message. 

To find all messages, one starts from the latest message and then goes back in history by using



