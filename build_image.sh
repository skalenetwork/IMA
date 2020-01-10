#!/usr/bin/env bash

if [ -z "$VERSION" ]
then
    echo "No VERSION provided, exiting"
    exit 1
fi
USERNAME=$1
PASSWORD=$2

NAME=ima
REPO_NAME=skalenetwork/$NAME
IMAGE_NAME=$REPO_NAME:$VERSION
LATEST_IMAGE_NAME=$REPO_NAME:latest

if [ -z "$SKIP_BUILD" ]
then   

    docker build -t $IMAGE_NAME . || exit $?

    if [ "$RELEASE" = true ]
    then
        docker tag $IMAGE_NAME $LATEST_IMAGE_NAME
    fi
fi

if [[ ! -z "$USERNAME" ]]
then
    echo "$PASSWORD" | docker login --username $USERNAME --password-stdin
    docker push $IMAGE_NAME || exit $?
    if [ "$RELEASE" = true ]
    then
        docker push $LATEST_IMAGE_NAME || exit $?
    fi
fi
