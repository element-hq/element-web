/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { NEVER, type Observable, Subject } from "rxjs";

import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
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
    /**
     * Must resolve before the call is allowed to become sticky (always on screen). `CallView` uses this
     * to hang up every other connected call first.
     */
    stickyPromise?: () => Promise<void>;
}

/**
 * Element Web's implementation of Element Call's `HostBridge`: the control plane between the mounted
 * Element Call React component and the `ElementCall` model / widget stores. It replaces what
 * `WidgetMessaging` plus the model's widget action handlers do for the iframe transport.
 *
 * The bridge is stateless apart from the theme watcher; it is created by `ElementCallAppTile` with the
 * lifetime of the rendered tile and does nothing but forward.
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
        // If the call wants to become sticky we wait for the stickyPromise to resolve first, as
        // WidgetMessaging does for UpdateAlwaysOnScreen.
        if (alwaysOnScreen) await this.opts.stickyPromise?.();
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
