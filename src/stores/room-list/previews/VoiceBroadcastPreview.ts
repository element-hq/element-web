/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastInfoState } from "../../../voice-broadcast/types";
import { textForVoiceBroadcastStoppedEventWithoutLink } from "../../../voice-broadcast/utils/textForVoiceBroadcastStoppedEventWithoutLink";
import { IPreview } from "./IPreview";

export class VoiceBroadcastPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: string, isThread?: boolean): string | null {
        if (!event.isRedacted() && event.getContent()?.state === VoiceBroadcastInfoState.Stopped) {
            return textForVoiceBroadcastStoppedEventWithoutLink(event);
        }

        return null;
    }
}
