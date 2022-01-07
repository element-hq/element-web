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

export interface IKeyBackupSession {
    first_message_index: number; // eslint-disable-line camelcase
    forwarded_count: number; // eslint-disable-line camelcase
    is_verified: boolean; // eslint-disable-line camelcase
    session_data: { // eslint-disable-line camelcase
        ciphertext: string;
        ephemeral: string;
        mac: string;
        iv: string;
    };
}

export interface IKeyBackupRoomSessions {
    [sessionId: string]: IKeyBackupSession;
}

/* eslint-disable camelcase */
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
