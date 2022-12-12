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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";
import { TimelineRenderingType } from "../../contexts/RoomContext";

export enum ComposerType {
    Send = "send",
    Edit = "edit",
}

interface IBaseComposerInsertPayload extends ActionPayload {
    action: Action.ComposerInsert;
    timelineRenderingType: TimelineRenderingType;
    composerType?: ComposerType; // falsy if should be re-dispatched to the correct composer
}

interface IComposerInsertMentionPayload extends IBaseComposerInsertPayload {
    userId: string;
}

interface IComposerInsertQuotePayload extends IBaseComposerInsertPayload {
    event: MatrixEvent;
}

interface IComposerInsertPlaintextPayload extends IBaseComposerInsertPayload {
    text: string;
}

export type ComposerInsertPayload =
    | IComposerInsertMentionPayload
    | IComposerInsertQuotePayload
    | IComposerInsertPlaintextPayload;
