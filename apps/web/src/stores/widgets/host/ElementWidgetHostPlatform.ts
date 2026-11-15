/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type Capability, type Widget, type WidgetKind } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";
import type { WidgetHostDriverLike, WidgetHostPlatform } from "@matrix-widget-tools/widget-host-bindings";

import { approveWidgetCapabilities } from "../WidgetCapabilityApproval";
import { approveWidgetOpenId } from "../WidgetOpenIdApproval";
import { ELEMENT_CLIENT_ID } from "../../../identifiers";
import { getUserLanguage } from "../../../i18n/settings";
import ThemeWatcher from "../../../settings/watchers/ThemeWatcher";
import { navigateToPermalink } from "../../../utils/permalinks/navigator";

interface ElementWidgetHostPlatformOptions {
    /** The widget, as matrix-widget-api sees it (for the capability prompt and the module API). */
    widget: Widget;
    widgetKind: WidgetKind;
    /** The room the widget lives in. */
    roomId: string;
    /** The iframe the widget is rendered in, once it exists. */
    getIframe: () => HTMLIFrameElement | null;
    /** The widget reported that it is ready to be shown. */
    onReady: () => void;
    /** The widget asked to stay on screen, or to stop doing so. Returns whether that is honoured. */
    setAlwaysOnScreen: (value: boolean) => boolean;
    /** A capability negotiation finished. */
    onCapabilitiesChanged: () => void;
}

/**
 * What Element Web provides to the MSC4412 widget host driver: delivery of messages to the widget's
 * iframe, the capability and OpenID prompts, navigation, and the client context reported to the widget.
 */
export class ElementWidgetHostPlatform implements WidgetHostPlatform {
    private driver: Pick<WidgetHostDriverLike, "approveCapabilities" | "resolveOpenid"> | null = null;
    // Capability and OpenID requests are decided one at a time, in order
    private queue: Promise<void> = Promise.resolve();
    private readonly themeWatcher = new ThemeWatcher();

    public constructor(private readonly opts: ElementWidgetHostPlatformOptions) {}

    /** The driver this platform answers to. Set once the driver exists, since each needs the other. */
    public setDriver(driver: Pick<WidgetHostDriverLike, "approveCapabilities" | "resolveOpenid">): void {
        this.driver = driver;
    }

    public sendToWidget = (json: string): void => {
        const target = this.opts.getIframe()?.contentWindow;
        if (!target) {
            logger.warn("Dropping message to widget: no iframe");
            return;
        }
        // The wrapper is served from our own origin; never `*`
        target.postMessage(JSON.parse(json), window.location.origin);
    };

    public onCapabilitiesRequested = (requested: Capability[]): void => {
        // The driver calls this from inside its own message handling and a newer request replaces a
        // pending one, so the decision is made asynchronously and one request at a time.
        this.queue = this.queue.then(() => this.decide(requested));
    };

    private async decide(requested: Capability[]): Promise<void> {
        const driver = this.driver;
        if (!driver) return;
        let approved = new Set<Capability>();
        try {
            approved = await approveWidgetCapabilities({
                widget: this.opts.widget,
                widgetKind: this.opts.widgetKind,
                roomId: this.opts.roomId,
                requested: new Set(requested),
                // The driver already granted what the client pre-approves (see `setAutoApproved`)
                preApproved: new Set(),
            });
        } catch (e) {
            logger.error("Failed to decide on widget capabilities, denying them", e);
        }
        driver.approveCapabilities([...approved]);
        this.opts.onCapabilitiesChanged();
    }

    public onOpenidRequested = (): void => {
        // Same as capability requests: never answer from within the driver's call, and one at a time
        this.queue = this.queue.then(() => this.decideOpenId());
    };

    private async decideOpenId(): Promise<void> {
        const driver = this.driver;
        if (!driver) return;
        let allowed = false;
        try {
            allowed = await approveWidgetOpenId({
                widget: this.opts.widget,
                widgetKind: this.opts.widgetKind,
                roomId: this.opts.roomId,
            });
        } catch (e) {
            logger.error("Failed to decide on the widget's OpenID request, denying it", e);
        }
        await driver.resolveOpenid(allowed);
    }

    public onReady = (): void => {
        this.opts.onReady();
    };

    public navigate = (uri: string): void => {
        // The driver only passes on matrix.to permalinks
        navigateToPermalink(uri);
    };

    public setAlwaysOnScreen = (value: boolean): boolean => this.opts.setAlwaysOnScreen(value);

    public clientId = (): string => ELEMENT_CLIENT_ID;

    public clientTheme = (): string => this.themeWatcher.getEffectiveTheme();

    public clientLanguage = (): string => getUserLanguage();
}
