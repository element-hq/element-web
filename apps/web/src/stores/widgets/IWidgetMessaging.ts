/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type ClientWidgetApi, type IWidget } from "matrix-widget-api";
import { type Room, type TypedEventEmitter } from "matrix-js-sdk/src/matrix";

export enum WidgetMessagingEvent {
    /** The communication channel with the widget was set up. */
    Start = "start",
    /** The communication channel with the widget was torn down. */
    Stop = "stop",
    /** The widget reported that its content is loaded and may be shown. */
    Ready = "ready",
    /** The set of capabilities granted to the widget changed, or the widget failed to set up. */
    CapabilitiesChanged = "capabilities_changed",
}

export interface WidgetMessagingEventMap {
    /** The widget API is `null` for host implementations that do not use matrix-widget-api. */
    [WidgetMessagingEvent.Start]: (widgetApi: ClientWidgetApi | null) => void;
    [WidgetMessagingEvent.Stop]: (widgetApi: ClientWidgetApi | null) => void;
    [WidgetMessagingEvent.Ready]: () => void;
    [WidgetMessagingEvent.CapabilitiesChanged]: () => void;
}

export interface WidgetMessagingOptions {
    app: IWidget;
    room?: Room; // without a room it is a user widget
    userId: string;
    creatorUserId: string;
    waitForIframeLoad: boolean;
    userWidget: boolean;
    /**
     * If defined this async method will be called when the widget requests to become sticky.
     * It will only become sticky once the returned promise resolves.
     * This is useful because: Widget B is sticky. Making widget A sticky will kill widget B immediately.
     * This promise allows to do Widget B related cleanup before Widget A becomes sticky. (e.g. hangup a Voip call)
     */
    stickyPromise?: () => Promise<void>;
}

/**
 * A running instance of a widget: the iframe it is rendered in and the communication channel with
 * it. There are two implementations, one on matrix-widget-api and one on the MSC4412 widget host;
 * the tile rendering the widget and the stores tracking it only rely on this interface.
 */
export interface IWidgetMessaging extends TypedEventEmitter<WidgetMessagingEvent, WidgetMessagingEventMap> {
    /**
     * The matrix-widget-api interface to the widget, or `null` if disconnected or when the widget is
     * hosted by an implementation that does not use matrix-widget-api.
     */
    readonly widgetApi: ClientWidgetApi | null;
    /** Whether the communication channel with the widget is currently set up. */
    readonly isStarted: boolean;
    /** The URL to use in the iframe. */
    readonly embedUrl: string;
    /** The URL to use in the popout. */
    readonly popoutUrl: string;
    /** Whether the widget currently holds the given capability. */
    hasCapability(capability: string): boolean;
    /** Work to do before the iframe is created, e.g. fetching an integration manager token. */
    prepare(): Promise<void>;
    /** Starts communicating with the widget rendered in the given iframe. */
    start(iframe: HTMLIFrameElement): void;
    /** Stops communicating with the widget. Skipped for persistent widgets unless forced. */
    stop(opts?: { forceDestroy: boolean }): void;
}
