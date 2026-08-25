/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Information on an encrypted media attachment, as specified by the client server specification.
 * @alpha Subject to change.
 * @see https://spec.matrix.org/v1.14/client-server-api/#extensions-to-mroommessage-msgtypes
 */
export interface EncryptedFile {
    /**
     * The URL to the file.
     */
    url: string;
    /**
     * A JSON Web Key object.
     */
    key: {
        alg: string;
        key_ops: string[];
        kty: string;
        k: string;
        ext: boolean;
    };
    /**
     * The 128-bit unique counter block used by AES-CTR, encoded as unpadded base64.
     */
    iv: string;
    /**
     * A map from an algorithm name to a hash of the ciphertext, encoded as unpadded base64.
     * Clients should support the SHA-256 hash, which uses the key `sha256`.
     */
    hashes: { [alg: string]: string };
    /**
     * Version of the encrypted attachment's protocol. Must be `v2`.
     */
    v: string;
}

/**
 * Single item in bundled URL previews in MSC4095
 *
 * @alpha Subject to change.
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
export type UnstableBundledUrlPreviewSingle = {
    "matched_url": string;
    "beeper:image:encryption"?: EncryptedFile;
    "matrix:image:size"?: number;
    "og:image"?: string;
    "og:url"?: string;
    "og:image:width"?: number;
    "og:image:height"?: number;
    "og:image:type"?: string;
    "og:title"?: string;
    "og:description"?: string;
} & Record<string, any>;

/**
 * Bundled URL previews in MSC-4095
 *
 * @alpha Subject to change.
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
export interface UnstableBundledUrlPreviews {
    "com.beeper.linkpreviews"?: UnstableBundledUrlPreviewSingle[];
}
