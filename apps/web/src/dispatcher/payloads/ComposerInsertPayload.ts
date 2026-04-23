/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";
import { type TimelineRenderingType } from "../../contexts/RoomContext";

export enum ComposerType {
    Send = "send",
    Edit = "edit",
}

/**
 * Explicit composer insert to target
 */
interface IBaseComposerInsertPayloadExplicit extends ActionPayload {
    action: Action.ComposerInsert;
    timelineRenderingType: TimelineRenderingType;
    composerType: ComposerType;
}

/**
 * Explicit composer insert to current target.
 */
interface IBaseComposerInsertPayloadImplicit extends ActionPayload {
    action: Action.ComposerInsert;
    composerType?: undefined; // undefined if this should be re-dispatched to the correct composer
    timelineRenderingType?: TimelineRenderingType; // undefined if this should just use the current in-focus type.
}

type IBaseComposerInsertPayload = IBaseComposerInsertPayloadExplicit | IBaseComposerInsertPayloadImplicit;

type IComposerInsertMentionPayload = IBaseComposerInsertPayload & {
    userId: string;
};

type IComposerInsertPlaintextPayload = IBaseComposerInsertPayload & {
    text: string;
};

export type ComposerInsertPayload = IComposerInsertMentionPayload | IComposerInsertPlaintextPayload;
