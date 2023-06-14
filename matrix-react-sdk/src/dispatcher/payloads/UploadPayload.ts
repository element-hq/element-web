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

import { ActionPayload } from "../payloads";
import { Action } from "../actions";
import { RoomUpload } from "../../models/RoomUpload";

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
    error: Error;
}

export interface UploadFinishedPayload extends UploadPayload {
    action: Action.UploadFinished;
}

export interface UploadCanceledPayload extends UploadPayload {
    action: Action.UploadCanceled;
}
