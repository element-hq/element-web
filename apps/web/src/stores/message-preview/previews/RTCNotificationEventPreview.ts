/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type Preview } from "./Preview";
import { _t } from "../../../languageHandler";
import { CallStore } from "../../CallStore";
import { ElementCall } from "../../../models/Call";

/**
 * Preview for the rtc notification event sent when an Element Call starts.
 * No event is sent when the call ends, so whether the call is still going is read from the {@link CallStore}.
 */
export class RTCNotificationEventPreview implements Preview {
    public getTextFor(event: MatrixEvent): string {
        const call = CallStore.instance.getCall(event.getRoomId()!);
        const isOngoing = call instanceof ElementCall;
        return isOngoing
            ? _t("event_preview|m.rtc.notification|started")
            : _t("event_preview|m.rtc.notification|ended");
    }
}
