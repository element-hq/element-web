/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { MessageTimestampView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { MessageTimestampViewModelProps } from "../../../../viewmodels/message-body/MessageTimestampViewModel";
import { MessageTimestampViewModel } from "../../../../viewmodels/message-body/MessageTimestampViewModel";
import { Icon as LateIcon } from "../../../../../res/img/sensor.svg";

export function Timestamp(props: MessageTimestampViewModelProps): JSX.Element {
    const viewModel = useCreateAutoDisposedViewModel(() => new MessageTimestampViewModel(props));

    useEffect(() => {
        viewModel.setTimestamp(props.ts);
        viewModel.setReceivedTimestamp(props.receivedTs);
        viewModel.setDisplayOptions({
            showTwelveHour: props.showTwelveHour,
            showRelative: props.showRelative,
        });
        viewModel.setHref(props.href);
        viewModel.setHandlers({ onClick: props.onClick, onContextMenu: props.onContextMenu });
    }, [viewModel, props]);

    return (
        <>
            {props.receivedTs ? (
                <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" />
            ) : undefined}
            <MessageTimestampView vm={viewModel} className="mx_MessageTimestamp" />
        </>
    );
}
