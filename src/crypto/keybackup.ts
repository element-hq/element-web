/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { ISigned } from "../@types/signed";
import { IEncryptedPayload } from "./aes";

export interface Curve25519SessionData {
    ciphertext: string;
    ephemeral: string;
    mac: string;
}

/* eslint-disable camelcase */
export interface IKeyBackupSession<T = Curve25519SessionData | IEncryptedPayload> {
    first_message_index: number;
    forwarded_count: number;
    is_verified: boolean;
    session_data: T;
}

export interface IKeyBackupRoomSessions {
    [sessionId: string]: IKeyBackupSession;
}

export interface ICurve25519AuthData {
    public_key: string;
    private_key_salt?: string;
    private_key_iterations?: number;
    private_key_bits?: number;
}

export interface IAes256AuthData {
    iv: string;
    mac: string;
    private_key_salt?: string;
    private_key_iterations?: number;
}

export interface IKeyBackupInfo {
    algorithm: string;
    auth_data: ISigned & (ICurve25519AuthData | IAes256AuthData);
    count?: number;
    etag?: string;
    version?: string; // number contained within
}
/* eslint-enable camelcase */

export interface IKeyBackupPrepareOpts {
    /**
     * Whether to use Secure Secret Storage to store the key encrypting key backups.
     * Optional, defaults to false.
     */
    secureSecretStorage: boolean;
}

export interface IKeyBackupRestoreResult {
    total: number;
    imported: number;
}

export interface IKeyBackupRestoreOpts {
    cacheCompleteCallback?: () => void;
    progressCallback?: (progress: { stage: string }) => void;
}
