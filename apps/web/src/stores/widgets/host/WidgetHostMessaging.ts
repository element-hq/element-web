/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type IWidget, WidgetKind } from "matrix-widget-api";
import { type MatrixClient, type Room, TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import type { WidgetHostDriver } from "@matrix-widget-tools/widget-host-bindings";

import { loadWidgetHostBindings } from "./bindings";
import { JsSdkMatrixBackend } from "./JsSdkMatrixBackend";
import { ElementWidgetHostPlatform } from "./ElementWidgetHostPlatform";
import { buildCompatWrapperUrl, isCompatWrapperUrlAllowed } from "./compatWrapperUrl";
import {
    type IWidgetMessaging,
    WidgetMessagingEvent,
    type WidgetMessagingEventMap,
    type WidgetMessagingOptions,
} from "../IWidgetMessaging";
import { buildWidgetTemplateParams, ElementWidget, fetchScalarTokenIfNeeded } from "../WidgetMessaging";
import { WidgetMessagingStore } from "../WidgetMessagingStore";
import { ElementWidgetCapabilities } from "../ElementWidgetCapabilities";
import ActiveWidgetStore from "../../ActiveWidgetStore";
import { isAppWidget } from "../../WidgetStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import SettingsStore from "../../../settings/SettingsStore";
import ThemeWatcher from "../../../settings/watchers/ThemeWatcher";
import { type IApp } from "../../../utils/WidgetUtils-types";
import { WidgetType } from "../../../widgets/WidgetType";

/**
 * Capabilities granted without asking, because a matrix-widget-api host does not ask for them
 * either: the context the compat wrapper needs to template a legacy widget's URL, the theme,
 * language and visibility updates, asking for an OpenID token (each request still prompts), and
 * the legacy capability Element grants to every widget.
 *
 * The first six are the compat wrapper's own requests; keep them in line with the SDK.
 */
const AUTO_APPROVED_CAPABILITIES: string[] = [
    "widget:org.matrix.mscXXXX.get_matrix_context",
    "widget:org.matrix.mscXXXX.get_client_context",
    "host:org.matrix.mscXXXX.update_theme",
    "host:org.matrix.mscXXXX.update_language",
    "host:org.matrix.mscXXXX.update_visibility",
    ElementWidgetCapabilities.RequiresClient,
];

/**
 * Whether a widget is rendered on the MSC4412 widget host rather than on matrix-widget-api.
 * Only room widgets of generic types qualify while the host is in labs: Element Call, Jitsi and
 * the sticker picker need actions the host does not offer yet, and account widgets follow the
 * viewed room, which the host does not support yet either. Widgets whose URL is not a web page
 * stay on matrix-widget-api too, as the compat wrapper must not load them.
 */
export function isWidgetHostEligible(app: IWidget | IApp, room: Room | undefined): boolean {
    if (!SettingsStore.getValue("feature_msc4412_widget_host")) return false;
    if (room === undefined || !isAppWidget(app)) return false;
    if (!isCompatWrapperUrlAllowed(app.url)) return false;
    return (
        !WidgetType.CALL.matches(app.type) &&
        !WidgetType.JITSI.matches(app.type) &&
        !WidgetType.STICKERPICKER.matches(app.type)
    );
}

/**
 * A running instance of a widget on the MSC4412 widget host. The widget is a legacy one embedded
 * through the compat wrapper; the Rust driver speaks to the wrapper, this class provides the iframe
 * plumbing, the backend on matrix-js-sdk and the platform callbacks.
 *
 * @see {@link WidgetMessaging} for the matrix-widget-api counterpart.
 */
export class WidgetHostMessaging
    extends TypedEventEmitter<WidgetMessagingEvent, WidgetMessagingEventMap>
    implements IWidgetMessaging
{
    public readonly widgetApi = null;

    private readonly client: MatrixClient;
    private readonly room: Room;
    private readonly kind: WidgetKind;
    private readonly widget: ElementWidget;
    private readonly themeWatcher = new ThemeWatcher();
    private iframe: HTMLIFrameElement | null = null;
    private driver: WidgetHostDriver | null = null;
    private backend: JsSdkMatrixBackend | null = null;
    private readonly stickyPromise?: () => Promise<void>;
    private scalarToken?: string;
    // Messages the widget sent while the bindings were still loading
    private pendingMessages: string[] = [];

    public constructor(
        private readonly app: IApp,
        options: WidgetMessagingOptions,
    ) {
        super();
        if (options.room === undefined) {
            throw new Error("The MSC4412 widget host does not support account widgets yet");
        }
        this.client = MatrixClientPeg.safeGet();
        this.room = options.room;
        this.kind = options.userWidget ? WidgetKind.Account : WidgetKind.Room;
        this.widget = new ElementWidget(app);
        this.stickyPromise = options.stickyPromise;
    }

    public get isStarted(): boolean {
        return this.driver !== null;
    }

    public get embedUrl(): string {
        return buildCompatWrapperUrl(this.app, { scalarToken: this.scalarToken });
    }

    public get popoutUrl(): string {
        // The wrapper only works embedded, so a popout gets the templated legacy URL
        const params = buildWidgetTemplateParams(this.client, this.room.roomId, this.themeWatcher.getEffectiveTheme());
        return this.widget.getCompleteUrl(params, true);
    }

    /**
     * Whether the widget holds `capability`, spelled as the driver knows it. Legacy capabilities the
     * driver has no equivalent for, such as `io.element.requires_client`, keep their legacy spelling.
     */
    public hasCapability(capability: string): boolean {
        return this.driver?.snapshot().approved.includes(capability) ?? false;
    }

    public async prepare(): Promise<void> {
        if (this.scalarToken) return;
        this.scalarToken = await fetchScalarTokenIfNeeded(this.app.url);
    }

    public start(iframe: HTMLIFrameElement): void {
        if (this.iframe !== null) return;
        this.iframe = iframe;
        // Listen before the driver exists: the wrapper starts talking as soon as it has loaded
        window.addEventListener("message", this.onMessage);
        void this.connect(iframe);
    }

    private async connect(iframe: HTMLIFrameElement): Promise<void> {
        let bindings;
        try {
            bindings = await loadWidgetHostBindings();
        } catch (e) {
            logger.error("Failed to load the widget host bindings", e);
            return;
        }
        // Stopped, or restarted with another iframe, while the bindings were loading
        if (this.iframe !== iframe) return;

        const backend = new JsSdkMatrixBackend(this.client, this.room, bindings);
        const platform = new ElementWidgetHostPlatform({
            widget: this.widget,
            widgetKind: this.kind,
            roomId: this.room.roomId,
            getIframe: () => this.iframe,
            onReady: () => this.emit(WidgetMessagingEvent.Ready),
            setAlwaysOnScreen: this.setAlwaysOnScreen,
            onCapabilitiesChanged: () => this.emit(WidgetMessagingEvent.CapabilitiesChanged),
        });
        const driver = new bindings.WidgetHostDriver(backend, platform);
        platform.setDriver(driver);
        driver.setAutoApproved(AUTO_APPROVED_CAPABILITIES);
        this.backend = backend;
        this.driver = driver;
        this.emit(WidgetMessagingEvent.Start, null);

        const pending = this.pendingMessages;
        this.pendingMessages = [];
        // TODO: why do we need pnding messages? It seems like we never have sth in there?
        // on startup its []
        // the only place where this gets populated is this.pendingMessages.push(json);
        // There is a handleWidgetMessage right behind it anyways
        for (const json of pending) this.handleWidgetMessage(json);
    }

    /**
     * Makes the widget persistent (kept on screen when its room is left) or stops that, as the
     * matrix-widget-api host does for `set_always_on_screen`.
     */
    private setAlwaysOnScreen = (value: boolean): boolean => {
        const apply = (): void => {
            // Stopped while waiting to become sticky
            if (this.iframe === null) return;
            ActiveWidgetStore.instance.setWidgetPersistence(this.app.id, this.room.roomId, value);
        };
        if (value && this.stickyPromise) {
            // Becoming sticky waits for the tile to be ready for it; stopping is instant
            this.stickyPromise().then(apply, (e) => logger.warn("Widget could not stay on screen", e));
        } else {
            apply();
        }
        return true;
    };

    private onMessage = (ev: MessageEvent): void => {
        // Only the wrapper in our iframe, which is served from our own origin
        if (this.iframe === null || ev.source !== this.iframe.contentWindow) return;
        if (ev.origin !== window.location.origin) return;
        const json = typeof ev.data === "string" ? ev.data : JSON.stringify(ev.data);
        if (this.driver === null) {
            this.pendingMessages.push(json);
            return;
        }
        this.handleWidgetMessage(json);
    };

    private handleWidgetMessage(json: string): void {
        // Errors describe messages that are not part of the protocol; nothing to do about them here
        this.driver?.handleMessageFromWidget(json).catch((e) => {
            logger.debug("Ignoring message from widget", e);
        });
    }

    public stop(opts = { forceDestroy: false }): void {
        if (this.iframe === null) return;
        if (opts.forceDestroy) {
            // Make sure the widget releases media devices even if the iframe lingers, as the
            // matrix-widget-api host does
            this.iframe.src = "about:blank";
        } else if (ActiveWidgetStore.instance.getWidgetPersistence(this.app.id, this.room.roomId)) {
            logger.log("Skipping destroy - persistent widget");
            return;
        }

        window.removeEventListener("message", this.onMessage);
        this.iframe = null;
        this.pendingMessages = [];
        const driver = this.driver;
        this.driver = null;
        this.backend?.dispose();
        this.backend = null;
        driver?.uniffiDestroy();
        this.emit(WidgetMessagingEvent.Stop, null);
        WidgetMessagingStore.instance.stopMessaging(this.app, this.room.roomId);
    }
}
