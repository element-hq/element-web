#!/usr/bin/env bash

# Regenerates the X.509 test fixtures: a root CA, an intermediate it signed, and two leaves.

set -euo pipefail
cd "$(dirname "$0")"

# Generate a self-signed root CA.
openssl req -x509 -newkey rsa:2048 -noenc -keyout root.key -days 36500 -subj /CN=test-root -out root-ca.pem

# Generate an intermediate CA signed by the root.
openssl req -newkey rsa:2048 -noenc -keyout int.key -subj /CN=test-intermediate \
    -addext basicConstraints=critical,CA:TRUE -out int.csr
openssl x509 -req -copy_extensions=copyall -in int.csr -CA root-ca.pem -CAkey root.key \
    -days 36500 -out intermediate-ca.pem

# Generate a second intermediate that expires *before* the leaf it will sign.
openssl req -newkey rsa:2048 -noenc -keyout shortint.key -subj /CN=test-short-intermediate \
    -addext basicConstraints=critical,CA:TRUE -out shortint.csr
openssl x509 -req -copy_extensions=copyall -in shortint.csr -CA root-ca.pem -CAkey root.key \
    -days 18250 -out short-intermediate-ca.pem

# Generate the leaf certificates for Alice and Bob, signed by the long-lived intermediate.
for cn in alice bob; do
    openssl req -newkey rsa:2048 -noenc -keyout "$cn.key" -subj "/CN=$cn" \
        -addext "subjectAltName=URI:matrix:u/$cn:localhost" \
        -addext "basicConstraints=critical,CA:FALSE" -out "$cn.csr"
    openssl x509 -req -copy_extensions=copyall -in "$cn.csr" -CA intermediate-ca.pem -CAkey int.key \
        -days 36500 -out "$cn.pem"
done

# A third leaf, signed by the short-lived intermediate and outliving it — the premise of the
# chain-expiry regression test (chainValidTo == the intol's).
openssl req -newkey rsa:2048 -noenc -keyout carol.key -subj /CN=carol \
    -addext "subjectAltName=URI:matrix:u/carol:localhost" \
    -addext "basicConstraints=critical,CA:FALSE" -out carol.csr
openssl x509 -req -copy_extensions=copyall -in carol.csr -CA short-intermediate-ca.pem -CAkey shortint.key \
    -days 36500 -out carol.pem

# Clean up the intermediate files and private keys, leaving only the PEM files for testing.
rm -f ./*.key ./*.csr ./*.srl
