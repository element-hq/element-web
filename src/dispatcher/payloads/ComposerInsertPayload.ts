/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

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

interface IComposerInsertPlaintextPayload extends IBaseComposerInsertPayload {
    text: string;
}

export type ComposerInsertPayload = IComposerInsertMentionPayload | IComposerInsertPlaintextPayload;
