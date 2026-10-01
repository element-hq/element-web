/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";
import { type RoomUpload } from "../../models/RoomUpload";

export interface UploadPayload extends ActionPayload {
    /**
     * The upload with fields representing the new upload state.
     */
    upload: RoomUpload;
}

export interface UploadStartedPayload extends UploadPayload {
    action: Action.UploadStarted;
}

export interface UploadProgressPayload extends UploadPayload {
    action: Action.UploadProgress;
}

export interface UploadErrorPayload extends UploadPayload {
    action: Action.UploadFailed;

    /**
     * An error to describe what went wrong with the upload.
     */
    error: unknown;
}

export interface UploadFinishedPayload extends UploadPayload {
    action: Action.UploadFinished;
}

export interface UploadCanceledPayload extends UploadPayload {
    action: Action.UploadCanceled;
}
