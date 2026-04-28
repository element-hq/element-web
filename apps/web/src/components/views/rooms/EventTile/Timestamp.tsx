/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, type JSX } from "react";
import { MessageTimestampView } from "@element-hq/web-shared-components";

import type {
    MessageTimestampViewModel,
    MessageTimestampViewModelProps,
} from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { Icon as LateIcon } from "../../../../../res/img/sensor.svg";

type TimestampProps = MessageTimestampViewModelProps & {
    vm: MessageTimestampViewModel;
};

export function Timestamp({ vm, ...props }: Readonly<TimestampProps>): JSX.Element {
    const renderedPropsRef = useRef(props);

    if (renderedPropsRef.current !== props) {
        renderedPropsRef.current = props;
        vm.setProps({
            ...props,
            onClick: props.onClick,
            onContextMenu: props.onContextMenu,
        });
    }

    return (
        <>
            {props.receivedTs ? (
                <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" />
            ) : undefined}
            <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />
        </>
    );
}
