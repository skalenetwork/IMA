#!/bin/bash

set -e

VERSION=$(cat VERSION)
USAGE_MSG='Usage: BRANCH=[BRANCH] calculate_version.sh'

if [ -z "$BRANCH" ]
then
    (>&2 echo 'You should provide branch')
    echo "$USAGE_MSG"
    exit 1
fi


if [ -z "$VERSION" ]; then
      echo "The base version is not set."
      exit 1
fi

LABEL="develop"
for known in "beta" "stable"
do
    if [ "$BRANCH" = "$known" ]
    then
        LABEL="$BRANCH"
    fi
done

git fetch --tags > /dev/null

for (( NUMBER=0; ; NUMBER++ ))
do
    FULL_VERSION="$VERSION-$LABEL.$NUMBER"
    TAG="$FULL_VERSION"
    if ! [[ $(git tag -l | grep "$TAG") ]]; then
        echo "$FULL_VERSION" | tr / -
        break
    fi
done
