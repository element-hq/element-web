/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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

import type { IClearEvent } from "../models/event";
import type { ISignatures } from "./signed";

export type OlmGroupSessionExtraData = {
    untrusted?: boolean;
    sharedHistory?: boolean;
};

/**
 * The result of a (successful) call to {@link Crypto.decryptEvent}
 */
export interface IEventDecryptionResult {
    /**
     * The plaintext payload for the event (typically containing <tt>type</tt> and <tt>content</tt> fields).
     */
    clearEvent: IClearEvent;
    /**
     * List of curve25519 keys involved in telling us about the senderCurve25519Key and claimedEd25519Key.
     * See {@link MatrixEvent#getForwardingCurve25519KeyChain}.
     */
    forwardingCurve25519KeyChain?: string[];
    /**
     * Key owned by the sender of this event.  See {@link MatrixEvent#getSenderKey}.
     */
    senderCurve25519Key?: string;
    /**
     * ed25519 key claimed by the sender of this event. See {@link MatrixEvent#getClaimedEd25519Key}.
     */
    claimedEd25519Key?: string;
    untrusted?: boolean;
    /**
     * The sender doesn't authorize the unverified devices to decrypt his messages
     */
    encryptedDisabledForUnverifiedDevices?: boolean;
}

interface Extensible {
    [key: string]: any;
}

/* eslint-disable camelcase */

/** The result of a call to {@link MatrixClient.exportRoomKeys} */
export interface IMegolmSessionData extends Extensible {
    /** Sender's Curve25519 device key */
    sender_key: string;
    /** Devices which forwarded this session to us (normally empty). */
    forwarding_curve25519_key_chain: string[];
    /** Other keys the sender claims. */
    sender_claimed_keys: Record<string, string>;
    /** Room this session is used in */
    room_id: string;
    /** Unique id for the session */
    session_id: string;
    /** Base64'ed key data */
    session_key: string;
    algorithm?: string;
    untrusted?: boolean;
}

/* eslint-enable camelcase */

/** the type of the `device_keys` parameter on `/_matrix/client/v3/keys/upload`
 *
 * @see https://spec.matrix.org/v1.5/client-server-api/#post_matrixclientv3keysupload
 */
export interface IDeviceKeys {
    algorithms: Array<string>;
    device_id: string; // eslint-disable-line camelcase
    user_id: string; // eslint-disable-line camelcase
    keys: Record<string, string>;
    signatures?: ISignatures;
}

/** the type of the `one_time_keys` and `fallback_keys` parameters on `/_matrix/client/v3/keys/upload`
 *
 * @see https://spec.matrix.org/v1.5/client-server-api/#post_matrixclientv3keysupload
 */
export interface IOneTimeKey {
    key: string;
    fallback?: boolean;
    signatures?: ISignatures;
}
