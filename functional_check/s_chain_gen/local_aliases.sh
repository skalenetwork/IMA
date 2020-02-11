#!/bin/bash
#sudo ifconfig lo0 0.0.0.0
for ((i=2;i<256;i++))
do
	sudo ifconfig lo0 delete 127.0.0.$i
	sudo ifconfig lo0 alias 127.0.0.$i up
done
