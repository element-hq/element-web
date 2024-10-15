#!/usr/bin/env python

from __future__ import print_function

import base64
import json
import struct

from cryptography.hazmat import backends
from cryptography.hazmat.primitives import ciphers, hashes, hmac
from cryptography.hazmat.primitives.kdf import pbkdf2
from cryptography.hazmat.primitives.ciphers import algorithms, modes

backend = backends.default_backend()

def parse_u128(s):
    a, b = struct.unpack(">QQ", s)
    return (a << 64) | b

def encrypt_ctr(key, iv, plaintext, counter_bits=64):
    alg = algorithms.AES(key)

    # Some AES-CTR implementations treat some parts of the IV as a nonce (which
    # remains constant throughought encryption), and some as a counter (which
    # increments every block, ie 16 bytes, and wraps after a while).  Different
    # implmententations use different amounts of the IV for each part.
    #
    # The python cryptography library uses the whole IV as a counter; to make
    # it match other implementations with a given counter size, we manually
    # implement wrapping the counter.

    # number of AES blocks between each counter wrap
    limit = 1 << counter_bits

    # parse IV as a 128-bit int
    parsed_iv = parse_u128(iv)

    # split IV into counter and nonce
    counter = parsed_iv & (limit - 1)
    nonce = parsed_iv & ~(limit - 1)

    # encrypt up to the first counter wraparound
    size = 16 * (limit - counter)
    encryptor = ciphers.Cipher(
        alg,
        modes.CTR(iv),
        backend=backend
    ).encryptor()
    input = plaintext[:size]
    result = encryptor.update(input) + encryptor.finalize()
    offset = size

    # do remaining data starting with a counter of zero
    iv = struct.pack(">QQ", nonce >> 64, nonce & ((1 << 64) - 1))
    size = 16 * limit

    while offset < len(plaintext):
        encryptor = ciphers.Cipher(
            alg,
            modes.CTR(iv),
            backend=backend
        ).encryptor()
        input = plaintext[offset:offset+size]
        result += encryptor.update(input) + encryptor.finalize()
        offset += size

    return result

def hmac_sha256(key, message):
     h = hmac.HMAC(key, hashes.SHA256(), backend=backend)
     h.update(message)
     return h.finalize()

def encrypt(key, iv, salt, plaintext, iterations=1000):
    """
    Returns:
       (bytes) ciphertext
    """
    if len(salt) != 16:
        raise Exception("Expected 128 bits of salt - got %i bits" % len((salt) * 8))
    if len(iv) != 16:
        raise Exception("Expected 128 bits of IV - got %i bits" % (len(iv) * 8))

    sha = hashes.SHA512()
    kdf = pbkdf2.PBKDF2HMAC(sha, 64, salt, iterations, backend)
    k = kdf.derive(key)

    aes_key = k[0:32]
    sha_key = k[32:]

    packed_file = (
        b"\x01"     # version
        + salt
        + iv
        + struct.pack(">L", iterations)
        + encrypt_ctr(aes_key, iv, plaintext)
    )
    packed_file += hmac_sha256(sha_key, packed_file)

    return (
        b"-----BEGIN MEGOLM SESSION DATA-----\n" +
        base64.encodestring(packed_file) +
        b"-----END MEGOLM SESSION DATA-----"
    )

def gen(password, iv, salt, plaintext, iterations=1000):
    ciphertext = encrypt(
        password.encode('utf-8'), iv, salt, plaintext.encode('utf-8'), iterations
    )
    return (plaintext, password, ciphertext.decode('utf-8'))

print (json.dumps([
    gen("password", b"\x88"*16, b"saltsaltsaltsalt", "plain", 10),
    gen("betterpassword", b"\xFF"*8 + b"\x00"*8, b"moresaltmoresalt", "Hello, World"),
    gen("SWORDFISH", b"\xFF"*8 + b"\x00"*8, b"yessaltygoodness", "alphanumerically" * 4),
    gen("password"*32, b"\xFF"*16, b"\xFF"*16, "alphanumerically" * 4),
], indent=4))
