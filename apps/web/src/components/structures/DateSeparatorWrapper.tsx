/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext } from "react";
import { DateSeparatorView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { DateSeparatorViewModel } from "../../viewmodels/room/timeline/DateSeparatorViewModel";
import { SDKContext } from "../../contexts/SDKContext.ts";

interface DateSeparatorWrapperProps {
    roomId: string;
    /** Timestamp of the day the separator introduces. */
    ts: number;
    className?: string;
}

/**
 * Creates and auto-disposes a DateSeparatorViewModel for a timeline date separator,
 * so the label ("Today", "Yesterday", …) and jump-to-date menu match wherever the
 * separator is drawn. Shared by the old MessagePanel and the new timeline panel.
 */
export function DateSeparatorWrapper({ roomId, ts, className }: Readonly<DateSeparatorWrapperProps>): JSX.Element {
    const sdkContext = useContext(SDKContext);
    const vm = useCreateAutoDisposedViewModel(
        () => new DateSeparatorViewModel({ roomId, ts, roomViewStore: sdkContext.roomViewStore }),
    );
    return <DateSeparatorView vm={vm} className={className} />;
}
