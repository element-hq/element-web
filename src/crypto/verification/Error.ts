/*
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

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

/**
 * Error messages.
 */

import { MatrixEvent } from "../../models/event";
import { EventType } from "../../@types/event";

export function newVerificationError(code: string, reason: string, extraData?: Record<string, any>): MatrixEvent {
    const content = Object.assign({}, { code, reason }, extraData);
    return new MatrixEvent({
        type: EventType.KeyVerificationCancel,
        content,
    });
}

export function errorFactory(code: string, reason: string): (extraData?: Record<string, any>) => MatrixEvent {
    return function (extraData?: Record<string, any>) {
        return newVerificationError(code, reason, extraData);
    };
}

/**
 * The verification was cancelled by the user.
 */
export const newUserCancelledError = errorFactory("m.user", "Cancelled by user");

/**
 * The verification timed out.
 */
export const newTimeoutError = errorFactory("m.timeout", "Timed out");

/**
 * An unknown method was selected.
 */
export const newUnknownMethodError = errorFactory("m.unknown_method", "Unknown method");

/**
 * An unexpected message was sent.
 */
export const newUnexpectedMessageError = errorFactory("m.unexpected_message", "Unexpected message");

/**
 * The key does not match.
 */
export const newKeyMismatchError = errorFactory("m.key_mismatch", "Key mismatch");

/**
 * An invalid message was sent.
 */
export const newInvalidMessageError = errorFactory("m.invalid_message", "Invalid message");

export function errorFromEvent(event: MatrixEvent): { code: string; reason: string } {
    const content = event.getContent();
    if (content) {
        const { code, reason } = content;
        return { code, reason };
    } else {
        return { code: "Unknown error", reason: "m.unknown" };
    }
}
