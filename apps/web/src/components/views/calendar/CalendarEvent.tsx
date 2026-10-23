/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { CalendarEventView, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import dis from "../../../dispatcher/dispatcher.ts";
import { _t } from "../../../languageHandler.ts";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload.ts";
import SettingsStore from "../../../settings/SettingsStore.ts";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";
import { CalendarEventViewModel } from "../../../viewmodels/message-body/calendar/CalendarEventViewModel.ts";

/**
 * A message tile showing that this room was created as an upgrade of a previous
 * room.
 */
export const CalendarEventTile: React.FC<{ mxEvent: MatrixEvent }> = ({ mxEvent }) => {
    const shouldSupportCalendar = SettingsStore.getValue("feature_msc4569_calendar");
    const showTwelveHourTimestamps = SettingsStore.getValue("showTwelveHourTimestamps");
    const roomContext = useScopedRoomContext("room");

    const vm = useCreateAutoDisposedViewModel(
        () => new CalendarEventViewModel({ mxEvent: mxEvent, showTwelveHour: showTwelveHourTimestamps }),
    );

    return <CalendarEventView vm={vm} />;
};
