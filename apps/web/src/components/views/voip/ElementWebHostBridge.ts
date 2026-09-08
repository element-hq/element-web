/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import { CallStore } from "../../../stores/CallStore";
import { type ElementCall } from "../../../models/Call";
import { type DeviceMuteState, type ElementCallHostBridge } from "./ElementCallComponentTypes";

export interface ElementWebHostBridgeOptions {
    /** The id of the (virtual) widget that is this call's identity in the widget stores. */
    widgetId: string;
    /** The room the widget belongs to, as `ActiveWidgetStore` keys it. */
    widgetRoomId: string | null;
}

/**
 * What the Element Call React component tells Element Web: the `ElementCallHostBridge` callbacks, each
 * forwarding to the `ElementCall` model or the widget stores, replacing what `WidgetMessaging` plus the
 * model's widget action handlers do for the iframe transport.
 *
 * Stateless, so its identity does not matter: the component forwards to whichever bridge it was most
 * recently given. What Element Web asks of the component goes the other way, through the component's
 * `ElementCallHandle`, which the model holds (`setComponentHandle`).
 */
export class ElementWebHostBridge implements ElementCallHostBridge {
    public readonly supportsReactions = true;
    /**
     * Element Web chose the intent on the user's behalf (which button they pressed), so a call that skips
     * the lobby may start them unmuted on its strength, as it does when Element Web hosts Element Call as a
     * widget. Standalone Element Call, whose intent comes from a URL, starts the user muted instead.
     */
    public readonly allowJoinUnmutedViaIntent = true;

    public constructor(
        private readonly call: ElementCall,
        private readonly opts: ElementWebHostBridgeOptions,
    ) {}

    public async setAlwaysOnScreen(alwaysOnScreen: boolean): Promise<void> {
        // Only one call can be on screen. Before this one becomes sticky, hang up every other connected
        // call, as `CallView`'s stickyPromise does for the iframe transport (through WidgetMessaging's
        // UpdateAlwaysOnScreen handling).
        if (alwaysOnScreen) {
            const others = [...CallStore.instance.connectedCalls].filter((call) => call !== this.call);
            await Promise.all(others.map((call) => call.disconnect()));
        }
        ActiveWidgetStore.instance.setWidgetPersistence(this.opts.widgetId, this.opts.widgetRoomId, alwaysOnScreen);
    }

    public async contentLoaded(): Promise<void> {
        this.call.markReady();
    }

    public async notifyJoined(): Promise<void> {
        this.call.handleJoined();
    }

    public async notifyHungUp(): Promise<void> {
        this.call.handleHangup();
    }

    public async notifyDeviceMute(state: DeviceMuteState): Promise<void> {
        this.call.handleDeviceMute(state);
    }

    public async close(): Promise<void> {
        this.call.handleClose();
    }
}
