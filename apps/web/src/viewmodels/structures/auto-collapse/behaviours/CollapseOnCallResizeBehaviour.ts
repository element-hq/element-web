/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseCollapseBehaviour } from "./BaseCollapseBehaviour";
import type { Call } from "../../../../models/Call";
import { CallStore, CallStoreEvent } from "../../../../stores/CallStore";
import type { CollapseHandler } from "../CollapseHandler";

/**
 * This behaviour:
 * - Collapses the left-panel when the user joins a call.
 * - Expands the left-panel when the user leaves that call.
 */
export class CollapseOnCallResizeBehaviour extends BaseCollapseBehaviour {
    private callJustStarted: boolean = false;
    private callStartedTimeout: number = 0;

    public constructor(collapseHandler: CollapseHandler) {
        super(collapseHandler);
        CallStore.instance.on(CallStoreEvent.ConnectedCalls, this.onCallConnected);
    }

    private onCallConnected = (calls: Set<Call>): void => {
        if (calls.size > 0) {
            this.setCallJustStarted();
            this.collapseHandler.collapse();
        } else if (calls.size === 0) this.collapseHandler.expand();
    };

    /**
     * When a call has just started, we'll probably do some manual resizing according
     * to this behaviour. We don't want ResizerViewModel to process these events.
     */
    private setCallJustStarted = (): void => {
        // Indicate that a call was just started, will make shouldIgnoreResize true.
        this.callJustStarted = true;
        window.clearTimeout(this.callStartedTimeout);

        // We only want shouldIgnoreResize to be true for a second.
        this.callStartedTimeout = window.setTimeout(() => {
            this.callJustStarted = false;
        }, 1000);
    };

    public get shouldIgnoreResize(): boolean {
        return this.callJustStarted;
    }

    public dispose = (): void => {
        CallStore.instance.off(CallStoreEvent.ConnectedCalls, this.onCallConnected);
    };
}
