/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useLayoutEffect, type JSX } from "react";
import { MessageTimestampView } from "@element-hq/web-shared-components";

import type {
    MessageTimestampViewModel,
    MessageTimestampViewModelProps,
} from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { Icon as LateIcon } from "../../../../../res/img/sensor.svg";

type TimestampProps = MessageTimestampViewModelProps & {
    vm: MessageTimestampViewModel;
};

export function Timestamp({
    vm,
    href,
    inhibitTooltip,
    onClick,
    onContextMenu,
    receivedTs,
    showFullDate,
    showRelative,
    showSeconds,
    showTwelveHour,
    ts,
}: Readonly<TimestampProps>): JSX.Element {
    useLayoutEffect(() => {
        vm.setProps({
            href,
            inhibitTooltip,
            onClick,
            onContextMenu,
            receivedTs,
            showFullDate,
            showRelative,
            showSeconds,
            showTwelveHour,
            ts,
        });
    }, [
        href,
        inhibitTooltip,
        onClick,
        onContextMenu,
        receivedTs,
        showFullDate,
        showRelative,
        showSeconds,
        showTwelveHour,
        ts,
        vm,
    ]);

    return (
        <>
            {receivedTs ? (
                <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" />
            ) : undefined}
            <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />
        </>
    );
}
