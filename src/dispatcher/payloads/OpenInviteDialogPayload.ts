/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Optional } from "matrix-events-sdk";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";
import { InviteKind } from "../../components/views/dialogs/InviteDialogTypes";

export interface OpenInviteDialogPayload extends ActionPayload {
    action: Action.OpenInviteDialog;

    kind: InviteKind;
    onFinishedCallback: Optional<(results: boolean[]) => void>;

    call?: MatrixCall;
    roomId?: string;

    analyticsName: string;
    className: string;
}
