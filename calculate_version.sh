#!/bin/bash

SUFFIX=$1
VERSION=$2

if [ -z $VERSION ]; then
      echo "The base version is not set."
      exit 1
fi

git fetch --tags

for (( NUMBER=0; ; NUMBER++ ))
do
    FULL_VERSION="$VERSION-$SUFFIX.$NUMBER"
    if ! [ $(git tag -l ?$FULL_VERSION) ]; then
        echo $FULL_VERSION
        break
    fi
done
