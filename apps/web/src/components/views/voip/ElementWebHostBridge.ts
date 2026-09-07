/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { NEVER, type Observable, Subject } from "rxjs";

import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import { CallStore } from "../../../stores/CallStore";
import ThemeWatcher, { ThemeWatcherEvent } from "../../../settings/watchers/ThemeWatcher";
import { type ElementCall } from "../../../models/Call";
import {
    type DeviceMuteRequest,
    type DeviceMuteState,
    type HostBridge,
    type HostRequest,
    type JoinCallData,
} from "./ElementCallComponentTypes";

export interface ElementWebHostBridgeOptions {
    /** The id of the (virtual) widget that is this call's identity in the widget stores. */
    widgetId: string;
    /** The room the widget belongs to, as `ActiveWidgetStore` keys it. */
    widgetRoomId: string | null;
}

/**
 * Element Web's implementation of Element Call's `HostBridge`: the control plane between the mounted
 * Element Call React component and the `ElementCall` model / widget stores. It replaces what
 * `WidgetMessaging` plus the model's widget action handlers do for the iframe transport.
 *
 * The bridge is stateless apart from the theme watcher and does nothing but forward. There is one per
 * call (see `ElementCallInstance`), alive for as long as the component is mounted: Element Call restarts
 * the call if it is handed a different bridge, so a bridge must never be tied to one of the tiles that
 * show the call.
 */
export class ElementWebHostBridge implements HostBridge {
    public readonly supportsReactions = true;
    /** Element Web never preloads the component, so it never asks it to join. */
    public readonly join$: Observable<HostRequest<JoinCallData>> = NEVER;
    /** Element Web does not drive the call's mute state. */
    public readonly deviceMute$: Observable<HostRequest<DeviceMuteRequest, DeviceMuteState>> = NEVER;
    public readonly hangUp$: Observable<HostRequest<Record<string, never>>>;

    private readonly themeChanges = new Subject<HostRequest<{ name?: string }>>();
    public readonly themeChange$: Observable<HostRequest<{ name?: string }>> = this.themeChanges.asObservable();
    private readonly themeWatcher = new ThemeWatcher();

    public constructor(
        private readonly call: ElementCall,
        private readonly opts: ElementWebHostBridgeOptions,
    ) {
        this.hangUp$ = call.hangUpRequests$;
    }

    /** Starts forwarding theme changes. */
    public start(): void {
        this.themeWatcher.start();
        this.themeWatcher.on(ThemeWatcherEvent.Change, this.onThemeChange);
    }

    /** Stops forwarding theme changes. The bridge must not be used afterwards. */
    public stop(): void {
        this.themeWatcher.off(ThemeWatcherEvent.Change, this.onThemeChange);
        this.themeWatcher.stop();
        this.themeChanges.complete();
    }

    private readonly onThemeChange = (theme: string): void => {
        this.themeChanges.next({ data: { name: theme }, reply: () => {} });
    };

    // EC → EW

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
