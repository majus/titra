#!/bin/bash
BUILD_DIR=`dirname "$0"`
METEOR_ROOT=$BUILD_DIR/..
pushd $METEOR_ROOT > /dev/null
meteor npm install
meteor build .build --directory
cd .build
cp package.tmpl.json bundle/package.json
rm -rf .bundle-garbage-*
popd > /dev/null