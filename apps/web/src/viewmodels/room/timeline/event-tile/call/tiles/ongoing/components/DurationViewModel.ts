/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, type DurationViewSnapshot } from "@element-hq/web-shared-components";

interface Props {
    /**
     * The timestamp of when this call started.
     */
    callStartTs: number;
}

/**
 * Get the duration of the call in seconds
 * @param timestamp The timestamp at which the call started
 */
function getDurationInSeconds(timestamp: number): number {
    const durationInMs = Date.now() - timestamp;
    const durationInSeconds = Math.floor(durationInMs * 0.001);
    return durationInSeconds;
}

/**
 * View model for showing the duration of an ongoing call.
 */
export class DurationViewModel extends BaseViewModel<DurationViewSnapshot, Props> {
    public constructor(props: Props) {
        super(props, { duration: getDurationInSeconds(props.callStartTs) });
        this.setupInterval();
    }

    /**
     * Update the duration every second.
     */
    private setupInterval(): void {
        const intervalRef = setInterval(() => {
            this.snapshot.set({ duration: getDurationInSeconds(this.props.callStartTs) });
        }, 1000);
        this.disposables.track(() => {
            clearInterval(intervalRef);
        });
    }
}
