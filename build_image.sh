#!/usr/bin/env bash

if [ -z "$VERSION" ]
then
    echo "No VERSION provided, exiting"
    exit 1
fi

NAME=ima
REPO_NAME=skalelabshub/$NAME
IMAGE_NAME=$REPO_NAME:$VERSION

docker build -t $IMAGE_NAME .

if [[ ! -z "$USERNAME" ]]
then
    docker login --username $USERNAME --password-stdin
fi

if [ "$RELEASE" = true ]
then
    $LATEST_IMAGE_NAME=$REPO_NAME:latest
    docker tag $IMAGE_NAME $LATEST_IMAGE_NAME
    docker push $LATEST_IMAGE_NAME
fi

docker push $IMAGE_NAME