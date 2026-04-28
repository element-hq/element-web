/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, type JSX } from "react";
import { MessageTimestampView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { MessageTimestampViewModelProps } from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { MessageTimestampViewModel } from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { Icon as LateIcon } from "../../../../../res/img/sensor.svg";

export function Timestamp(props: Readonly<MessageTimestampViewModelProps>): JSX.Element {
    const viewModel = useCreateAutoDisposedViewModel(() => new MessageTimestampViewModel(props));
    const renderedPropsRef = useRef(props);

    if (renderedPropsRef.current !== props) {
        renderedPropsRef.current = props;
        viewModel.setProps(props);
    }

    return (
        <>
            {props.receivedTs ? (
                <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" />
            ) : undefined}
            <MessageTimestampView vm={viewModel} className="mx_MessageTimestamp" />
        </>
    );
}
