#!/usr/bin/env bash

# Regenerates the X.509 test fixtures: a root CA, an intermediate it signed, and two leaves.

set -euo pipefail
cd "$(dirname "$0")"

openssl req -x509 -newkey rsa:2048 -noenc -keyout root.key -days 36500 -subj /CN=test-root -out root-ca.pem

openssl req -newkey rsa:2048 -noenc -keyout int.key -subj /CN=test-intermediate \
    -addext basicConstraints=critical,CA:TRUE -out int.csr
openssl x509 -req -copy_extensions=copyall -in int.csr -CA root-ca.pem -CAkey root.key \
    -days 36500 -out intermediate-ca.pem

for cn in alice bob; do
    openssl req -newkey rsa:2048 -noenc -keyout "$cn.key" -subj "/CN=$cn" -out "$cn.csr"
    openssl x509 -req -in "$cn.csr" -CA intermediate-ca.pem -CAkey int.key -days 36500 -out "$cn.pem"
done

rm -f ./*.key ./*.csr ./*.srl
