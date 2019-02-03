#!/usr/bin/env bash

if [ -z "$VERSION" ]
then
    echo "No VERSION provided, exiting"
    exit 1
fi

docker build -t skalelabshub/ktm:latest .
docker tag skalelabshub/ktm:latest skalelabshub/ktm:$VERSION

docker push skalelabshub/ktm:latest
docker push skalelabshub/ktm:$VERSION