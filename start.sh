#!/bin/sh

cd -- "$(dirname -- "$0")" || exit 1

if ! command -v git 2>&1 >/dev/null; then
	echo You must install Git to proceed
	exit 1
fi

if ! command -v npm 2>&1 >/dev/null; then
	echo You must install Node.js to proceed
	exit 1
fi

npm install
node start.js
