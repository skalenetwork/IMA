#!/usr/bin/env bash

if [ -z "$VERSION" ]
then
    echo "No VERSION provided, exiting"
    exit 1
fi
DOCKER_USERNAME=$1
DOCKER_PASSWORD=$2

NAME=ima
REPO_NAME=skalenetwork/$NAME
IMAGE_NAME=$REPO_NAME:$VERSION
LATEST_IMAGE_NAME=$REPO_NAME:latest

if [ -z "$SKIP_BUILD" ]
then   

    docker build -t "$IMAGE_NAME" . || exit $?

    if [ "$RELEASE" = true ]
    then
        docker tag "$IMAGE_NAME" "$LATEST_IMAGE_NAME"
    fi
fi

if [[ ! -z "$DOCKER_USERNAME" ]]
then
    echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password-stdin
    docker push "$IMAGE_NAME" || exit $?
    if [ "$RELEASE" = true ]
    then
        docker push $LATEST_IMAGE_NAME || exit $?
    fi
fi
