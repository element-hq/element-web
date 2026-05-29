/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { MessageTimestampView } from "@element-hq/web-shared-components";

import {
    type MessageTimestampViewModel,
    type MessageTimestampViewModelProps,
} from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel.ts";
import { Icon as LateIcon } from "../../../../../res/img/sensor.svg";

interface MessageTimestampAdapterProps {
    vm: MessageTimestampViewModel;
    timestampProps: MessageTimestampViewModelProps;
}

export function MessageTimestampAdapter({ vm, timestampProps }: Readonly<MessageTimestampAdapterProps>): JSX.Element {
    useEffect(() => {
        vm.setProps(timestampProps);
    }, [vm, timestampProps]);

    return (
        <>
            {timestampProps.receivedTs ? (
                <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" />
            ) : undefined}
            <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />
        </>
    );
}
