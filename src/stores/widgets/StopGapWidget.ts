/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020-2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    type Room,
    type MatrixEvent,
    MatrixEventEvent,
    type MatrixClient,
    ClientEvent,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import {
    ClientWidgetApi,
    type IModalWidgetOpenRequest,
    type IRoomEvent,
    type IStickerActionRequest,
    type IStickyActionRequest,
    type ITemplateParams,
    type IWidget,
    type IWidgetApiErrorResponseData,
    type IWidgetApiRequest,
    type IWidgetApiRequestEmptyData,
    type IWidgetData,
    MatrixCapabilities,
    runTemplate,
    Widget,
    WidgetApiFromWidgetAction,
    WidgetKind,
} from "matrix-widget-api";
import { EventEmitter } from "events";
import { logger } from "matrix-js-sdk/src/logger";

import { _t, getUserLanguage } from "../../languageHandler";
import { StopGapWidgetDriver } from "./StopGapWidgetDriver";
import { WidgetMessagingStore } from "./WidgetMessagingStore";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { OwnProfileStore } from "../OwnProfileStore";
import WidgetUtils from "../../utils/WidgetUtils";
import { IntegrationManagers } from "../../integrations/IntegrationManagers";
import { WidgetType } from "../../widgets/WidgetType";
import ActiveWidgetStore from "../ActiveWidgetStore";
import { objectShallowClone } from "../../utils/objects";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { ElementWidgetActions, type IHangupCallApiRequest, type IViewRoomApiRequest } from "./ElementWidgetActions";
import { ModalWidgetStore } from "../ModalWidgetStore";
import { type IApp, isAppWidget } from "../WidgetStore";
import ThemeWatcher, { ThemeWatcherEvent } from "../../settings/watchers/ThemeWatcher";
import { getCustomTheme } from "../../theme";
import { ElementWidgetCapabilities } from "./ElementWidgetCapabilities";
import { ELEMENT_CLIENT_ID } from "../../identifiers";
import { WidgetVariableCustomisations } from "../../customisations/WidgetVariables";
import { arrayFastClone } from "../../utils/arrays";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import Modal from "../../Modal";
import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import { SdkContextClass } from "../../contexts/SDKContext";
import { UPDATE_EVENT } from "../AsyncStore";

// TODO: Destroy all of this code

interface IAppTileProps {
    // Note: these are only the props we care about
    app: IApp | IWidget;
    room?: Room; // without a room it is a user widget
    userId: string;
    creatorUserId: string;
    waitForIframeLoad: boolean;
    whitelistCapabilities?: string[];
    userWidget: boolean;
    stickyPromise?: () => Promise<void>;
}

// TODO: Don't use this because it's wrong
export class ElementWidget extends Widget {
    public constructor(private rawDefinition: IWidget) {
        super(rawDefinition);
    }

    public get templateUrl(): string {
        if (WidgetType.JITSI.matches(this.type)) {
            return WidgetUtils.getLocalJitsiWrapperUrl({
                forLocalRender: true,
                auth: super.rawData?.auth as string, // this.rawData can call templateUrl, do this to prevent looping
            });
        }
        return super.templateUrl;
    }

    public get popoutTemplateUrl(): string {
        if (WidgetType.JITSI.matches(this.type)) {
            return WidgetUtils.getLocalJitsiWrapperUrl({
                forLocalRender: false, // The only important difference between this and templateUrl()
                auth: super.rawData?.auth as string,
            });
        }
        return this.templateUrl; // use this instead of super to ensure we get appropriate templating
    }

    public get rawData(): IWidgetData {
        let conferenceId = super.rawData["conferenceId"];
        if (conferenceId === undefined) {
            // we'll need to parse the conference ID out of the URL for v1 Jitsi widgets
            const parsedUrl = new URL(super.templateUrl); // use super to get the raw widget URL
            conferenceId = parsedUrl.searchParams.get("confId");
        }
        let domain = super.rawData["domain"];
        if (domain === undefined) {
            // v1 widgets default to meet.element.io regardless of user settings
            domain = "meet.element.io";
        }

        let theme = new ThemeWatcher().getEffectiveTheme();
        if (theme.startsWith("custom-")) {
            const customTheme = getCustomTheme(theme.slice(7));
            // Jitsi only understands light/dark
            theme = customTheme.is_dark ? "dark" : "light";
        }

        // only allow light/dark through, defaulting to dark as that was previously the only state
        // accounts for legacy-light/legacy-dark themes too
        if (theme.includes("light")) {
            theme = "light";
        } else {
            theme = "dark";
        }

        return {
            ...super.rawData,
            theme,
            conferenceId,
            domain,
        };
    }

    public getCompleteUrl(params: ITemplateParams, asPopout = false): string {
        return runTemplate(
            asPopout ? this.popoutTemplateUrl : this.templateUrl,
            {
                ...this.rawDefinition,
                data: this.rawData,
            },
            params,
        );
    }
}

export class StopGapWidget extends EventEmitter {
    private client: MatrixClient;
    private messaging: ClientWidgetApi | null = null;
    private mockWidget: ElementWidget;
    private scalarToken?: string;
    private roomId?: string;
    // The room that we're currently allowing the widget to interact with. Only
    // used for account widgets, which may follow the user to different rooms.
    private viewedRoomId: string | null = null;
    private kind: WidgetKind;
    private readonly virtual: boolean;
    private readonly themeWatcher = new ThemeWatcher();
    private readUpToMap: { [roomId: string]: string } = {}; // room ID to event ID
    // This promise will be called and needs to resolve before the widget will actually become sticky.
    private stickyPromise?: () => Promise<void>;
    // Holds events that should be fed to the widget once they finish decrypting
    private readonly eventsToFeed = new WeakSet<MatrixEvent>();

    public constructor(private appTileProps: IAppTileProps) {
        super();
        this.client = MatrixClientPeg.safeGet();

        let app = appTileProps.app;
        // Backwards compatibility: not all old widgets have a creatorUserId
        if (!app.creatorUserId) {
            app = objectShallowClone(app); // clone to prevent accidental mutation
            app.creatorUserId = this.client.getUserId()!;
        }

        this.mockWidget = new ElementWidget(app);
        this.roomId = appTileProps.room?.roomId;
        this.kind = appTileProps.userWidget ? WidgetKind.Account : WidgetKind.Room; // probably
        this.virtual = isAppWidget(app) && app.eventId === undefined;
        this.stickyPromise = appTileProps.stickyPromise;
    }

    public get widgetApi(): ClientWidgetApi | null {
        return this.messaging;
    }

    /**
     * The URL to use in the iframe
     */
    public get embedUrl(): string {
        return this.runUrlTemplate({ asPopout: false });
    }

    /**
     * The URL to use in the popout
     */
    public get popoutUrl(): string {
        return this.runUrlTemplate({ asPopout: true });
    }

    private runUrlTemplate(opts = { asPopout: false }): string {
        const fromCustomisation = WidgetVariableCustomisations?.provideVariables?.() ?? {};
        const defaults: ITemplateParams = {
            widgetRoomId: this.roomId,
            currentUserId: this.client.getUserId()!,
            userDisplayName: OwnProfileStore.instance.displayName ?? undefined,
            userHttpAvatarUrl: OwnProfileStore.instance.getHttpAvatarUrl() ?? undefined,
            clientId: ELEMENT_CLIENT_ID,
            clientTheme: this.themeWatcher.getEffectiveTheme(),
            clientLanguage: getUserLanguage(),
            deviceId: this.client.getDeviceId() ?? undefined,
            baseUrl: this.client.baseUrl,
        };
        const templated = this.mockWidget.getCompleteUrl(Object.assign(defaults, fromCustomisation), opts?.asPopout);

        const parsed = new URL(templated);

        // Add in some legacy support sprinkles (for non-popout widgets)
        // TODO: Replace these with proper widget params
        // See https://github.com/matrix-org/matrix-doc/pull/1958/files#r405714833
        if (!opts?.asPopout) {
            parsed.searchParams.set("widgetId", this.mockWidget.id);
            parsed.searchParams.set("parentUrl", window.location.href.split("#", 2)[0]);

            // Give the widget a scalar token if we're supposed to (more legacy)
            // TODO: Stop doing this
            if (this.scalarToken) {
                parsed.searchParams.set("scalar_token", this.scalarToken);
            }
        }

        // Replace the encoded dollar signs back to dollar signs. They have no special meaning
        // in HTTP, but URL parsers encode them anyways.
        return parsed.toString().replace(/%24/g, "$");
    }

    public get started(): boolean {
        return !!this.messaging;
    }

    private onThemeChange = (theme: string): void => {
        this.messaging?.updateTheme({ name: theme });
    };

    private onOpenModal = async (ev: CustomEvent<IModalWidgetOpenRequest>): Promise<void> => {
        ev.preventDefault();
        if (ModalWidgetStore.instance.canOpenModalWidget()) {
            ModalWidgetStore.instance.openModalWidget(ev.detail.data, this.mockWidget, this.roomId);
            this.messaging?.transport.reply(ev.detail, {}); // ack
        } else {
            this.messaging?.transport.reply(ev.detail, {
                error: {
                    message: "Unable to open modal at this time",
                },
            });
        }
    };

    // This listener is only active for account widgets, which may follow the
    // user to different rooms
    private onRoomViewStoreUpdate = (): void => {
        const roomId = SdkContextClass.instance.roomViewStore.getRoomId() ?? null;
        if (roomId !== this.viewedRoomId) {
            this.messaging!.setViewedRoomId(roomId);
            this.viewedRoomId = roomId;
        }
    };

    /**
     * This starts the messaging for the widget if it is not in the state `started` yet.
     * @param iframe the iframe the widget should use
     */
    public startMessaging(iframe: HTMLIFrameElement): any {
        if (this.started) return;

        const allowedCapabilities = this.appTileProps.whitelistCapabilities || [];
        const driver = new StopGapWidgetDriver(
            allowedCapabilities,
            this.mockWidget,
            this.kind,
            this.virtual,
            this.roomId,
        );

        this.messaging = new ClientWidgetApi(this.mockWidget, iframe, driver);
        this.messaging.on("preparing", () => this.emit("preparing"));
        this.messaging.on("error:preparing", (err: unknown) => this.emit("error:preparing", err));
        this.messaging.once("ready", () => {
            WidgetMessagingStore.instance.storeMessaging(this.mockWidget, this.roomId, this.messaging!);
            this.emit("ready");

            this.themeWatcher.start();
            this.themeWatcher.on(ThemeWatcherEvent.Change, this.onThemeChange);
            // Theme may have changed while messaging was starting
            this.onThemeChange(this.themeWatcher.getEffectiveTheme());
        });
        this.messaging.on("capabilitiesNotified", () => this.emit("capabilitiesNotified"));
        this.messaging.on(`action:${WidgetApiFromWidgetAction.OpenModalWidget}`, this.onOpenModal);

        // When widgets are listening to events, we need to make sure they're only
        // receiving events for the right room
        if (this.roomId === undefined) {
            // Account widgets listen to the currently active room
            this.messaging.setViewedRoomId(SdkContextClass.instance.roomViewStore.getRoomId() ?? null);
            SdkContextClass.instance.roomViewStore.on(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        } else {
            // Room widgets get locked to the room they were added in
            this.messaging.setViewedRoomId(this.roomId);
        }

        // Always attach a handler for ViewRoom, but permission check it internally
        this.messaging.on(`action:${ElementWidgetActions.ViewRoom}`, (ev: CustomEvent<IViewRoomApiRequest>) => {
            ev.preventDefault(); // stop the widget API from auto-rejecting this

            // Check up front if this is even a valid request
            const targetRoomId = (ev.detail.data || {}).room_id;
            if (!targetRoomId) {
                return this.messaging?.transport.reply(ev.detail, <IWidgetApiErrorResponseData>{
                    error: { message: "Room ID not supplied." },
                });
            }

            // Check the widget's permission
            if (!this.messaging?.hasCapability(ElementWidgetCapabilities.CanChangeViewedRoom)) {
                return this.messaging?.transport.reply(ev.detail, <IWidgetApiErrorResponseData>{
                    error: { message: "This widget does not have permission for this action (denied)." },
                });
            }

            // at this point we can change rooms, so do that
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: targetRoomId,
                metricsTrigger: "Widget",
            });

            // acknowledge so the widget doesn't freak out
            this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});
        });

        // Populate the map of "read up to" events for this widget with the current event in every room.
        // This is a bit inefficient, but should be okay. We do this for all rooms in case the widget
        // requests timeline capabilities in other rooms down the road. It's just easier to manage here.
        for (const room of this.client.getRooms()) {
            // Timelines are most recent last
            const events = room.getLiveTimeline()?.getEvents() || [];
            const roomEvent = events[events.length - 1];
            if (!roomEvent) continue; // force later code to think the room is fresh
            this.readUpToMap[room.roomId] = roomEvent.getId()!;
        }

        // Attach listeners for feeding events - the underlying widget classes handle permissions for us
        this.client.on(ClientEvent.Event, this.onEvent);
        this.client.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        this.client.on(RoomStateEvent.Events, this.onStateUpdate);
        this.client.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);

        this.messaging.on(
            `action:${WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`,
            async (ev: CustomEvent<IStickyActionRequest>) => {
                if (this.messaging?.hasCapability(MatrixCapabilities.AlwaysOnScreen)) {
                    ev.preventDefault();
                    if (ev.detail.data.value) {
                        // If the widget wants to become sticky we wait for the stickyPromise to resolve
                        if (this.stickyPromise) await this.stickyPromise();
                    }
                    // Stop being persistent can be done instantly
                    ActiveWidgetStore.instance.setWidgetPersistence(
                        this.mockWidget.id,
                        this.roomId ?? null,
                        ev.detail.data.value,
                    );
                    // Send the ack after the widget actually has become sticky.
                    this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});
                }
            },
        );

        // TODO: Replace this event listener with appropriate driver functionality once the API
        // establishes a sane way to send events back and forth.
        this.messaging.on(
            `action:${WidgetApiFromWidgetAction.SendSticker}`,
            (ev: CustomEvent<IStickerActionRequest>) => {
                if (this.messaging?.hasCapability(MatrixCapabilities.StickerSending)) {
                    // Acknowledge first
                    ev.preventDefault();
                    this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});

                    // Send the sticker
                    defaultDispatcher.dispatch({
                        action: "m.sticker",
                        data: ev.detail.data,
                        widgetId: this.mockWidget.id,
                    });
                }
            },
        );

        if (WidgetType.STICKERPICKER.matches(this.mockWidget.type)) {
            this.messaging.on(
                `action:${ElementWidgetActions.OpenIntegrationManager}`,
                (ev: CustomEvent<IWidgetApiRequest>) => {
                    // Acknowledge first
                    ev.preventDefault();
                    this.messaging?.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});

                    // First close the stickerpicker
                    defaultDispatcher.dispatch({ action: "stickerpicker_close" });

                    // Now open the integration manager
                    // TODO: Spec this interaction.
                    const data = ev.detail.data;
                    const integType = data?.integType as string;
                    const integId = <string>data?.integId;

                    const roomId = SdkContextClass.instance.roomViewStore.getRoomId();
                    const room = roomId ? this.client.getRoom(roomId) : undefined;
                    if (!room) return;

                    // noinspection JSIgnoredPromiseFromCall
                    IntegrationManagers.sharedInstance()?.getPrimaryManager()?.open(room, `type_${integType}`, integId);
                },
            );
        }

        if (WidgetType.JITSI.matches(this.mockWidget.type)) {
            this.messaging.on(`action:${ElementWidgetActions.HangupCall}`, (ev: CustomEvent<IHangupCallApiRequest>) => {
                ev.preventDefault();
                if (ev.detail.data?.errorMessage) {
                    Modal.createDialog(ErrorDialog, {
                        title: _t("widget|error_hangup_title"),
                        description: _t("widget|error_hangup_description", {
                            message: ev.detail.data.errorMessage,
                        }),
                    });
                }
                this.messaging?.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});
            });
        }
    }

    public async prepare(): Promise<void> {
        // Ensure the variables are ready for us to be rendered before continuing
        await (WidgetVariableCustomisations?.isReady?.() ?? Promise.resolve());

        if (this.scalarToken) return;
        const existingMessaging = WidgetMessagingStore.instance.getMessaging(this.mockWidget, this.roomId);
        if (existingMessaging) this.messaging = existingMessaging;
        try {
            if (WidgetUtils.isScalarUrl(this.mockWidget.templateUrl)) {
                const managers = IntegrationManagers.sharedInstance();
                if (managers.hasManager()) {
                    // TODO: Pick the right manager for the widget
                    const defaultManager = managers.getPrimaryManager();
                    if (defaultManager && WidgetUtils.isScalarUrl(defaultManager.apiUrl)) {
                        const scalar = defaultManager.getScalarClient();
                        this.scalarToken = await scalar.getScalarToken();
                    }
                }
            }
        } catch (e) {
            // All errors are non-fatal
            logger.error("Error preparing widget communications: ", e);
        }
    }

    /**
     * Stops the widget messaging for if it is started. Skips stopping if it is an active
     * widget.
     * @param opts
     */
    public stopMessaging(opts = { forceDestroy: false }): void {
        if (
            !opts?.forceDestroy &&
            ActiveWidgetStore.instance.getWidgetPersistence(this.mockWidget.id, this.roomId ?? null)
        ) {
            logger.log("Skipping destroy - persistent widget");
            return;
        }
        if (!this.started) return;
        WidgetMessagingStore.instance.stopMessaging(this.mockWidget, this.roomId);
        this.messaging = null;

        SdkContextClass.instance.roomViewStore.off(UPDATE_EVENT, this.onRoomViewStoreUpdate);

        this.client.off(ClientEvent.Event, this.onEvent);
        this.client.off(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        this.client.off(RoomStateEvent.Events, this.onStateUpdate);
        this.client.off(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
    }

    private onEvent = (ev: MatrixEvent): void => {
        this.client.decryptEventIfNeeded(ev);
        this.feedEvent(ev);
    };

    private onEventDecrypted = (ev: MatrixEvent): void => {
        this.feedEvent(ev);
    };

    private onStateUpdate = (ev: MatrixEvent): void => {
        if (this.messaging === null) return;
        const raw = ev.getEffectiveEvent();
        this.messaging.feedStateUpdate(raw as IRoomEvent).catch((e) => {
            logger.error("Error sending state update to widget: ", e);
        });
    };

    private onToDeviceEvent = async (ev: MatrixEvent): Promise<void> => {
        await this.client.decryptEventIfNeeded(ev);
        if (ev.isDecryptionFailure()) return;
        await this.messaging?.feedToDevice(ev.getEffectiveEvent() as IRoomEvent, ev.isEncrypted());
    };

    /**
     * Determines whether the event has a relation to an unknown parent.
     */
    private relatesToUnknown(ev: MatrixEvent): boolean {
        // Replies to unknown events don't count
        if (!ev.relationEventId || ev.replyEventId) return false;
        const room = this.client.getRoom(ev.getRoomId());
        return room === null || !room.findEventById(ev.relationEventId);
    }

    /**
     * Determines whether the event comes from a room that we've been invited to
     * (in which case we likely don't have the full timeline).
     */
    private isFromInvite(ev: MatrixEvent): boolean {
        const room = this.client.getRoom(ev.getRoomId());
        return room?.getMyMembership() === KnownMembership.Invite;
    }

    /**
     * Advances the "read up to" marker for a room to a certain event. No-ops if
     * the event is before the marker.
     * @returns Whether the "read up to" marker was advanced.
     */
    private advanceReadUpToMarker(ev: MatrixEvent): boolean {
        const evId = ev.getId();
        if (evId === undefined) return false;
        const roomId = ev.getRoomId();
        if (roomId === undefined) return false;
        const room = this.client.getRoom(roomId);
        if (room === null) return false;

        const upToEventId = this.readUpToMap[ev.getRoomId()!];
        if (!upToEventId) {
            // There's no marker yet; start it at this event
            this.readUpToMap[roomId] = evId;
            return true;
        }

        // Small optimization for exact match (skip the search)
        if (upToEventId === evId) return false;

        // Timelines are most recent last, so reverse the order and limit ourselves to 100 events
        // to avoid overusing the CPU.
        const timeline = room.getLiveTimeline();
        const events = arrayFastClone(timeline.getEvents()).reverse().slice(0, 100);

        for (const timelineEvent of events) {
            if (timelineEvent.getId() === upToEventId) {
                // The event must be somewhere before the "read up to" marker
                return false;
            } else if (timelineEvent.getId() === ev.getId()) {
                // The event is after the marker; advance it
                this.readUpToMap[roomId] = evId;
                return true;
            }
        }

        // We can't say for sure whether the widget has seen the event; let's
        // just assume that it has
        return false;
    }

    private feedEvent(ev: MatrixEvent): void {
        if (this.messaging === null) return;
        if (
            // If we had decided earlier to feed this event to the widget, but
            // it just wasn't ready, give it another try
            this.eventsToFeed.delete(ev) ||
            // Skip marker timeline check for events with relations to unknown parent because these
            // events are not added to the timeline here and will be ignored otherwise:
            // https://github.com/matrix-org/matrix-js-sdk/blob/d3dfcd924201d71b434af3d77343b5229b6ed75e/src/models/room.ts#L2207-L2213
            this.relatesToUnknown(ev) ||
            // Skip marker timeline check for rooms where membership is
            // 'invite', otherwise the membership event from the invitation room
            // will advance the marker and new state events will not be
            // forwarded to the widget.
            this.isFromInvite(ev) ||
            // Check whether this event would be before or after our "read up to" marker. If it's
            // before, or we can't decide, then we assume the widget will have already seen the event.
            // If the event is after, or we don't have a marker for the room, then the marker will advance and we'll
            // send it through.
            // This approach of "read up to" prevents widgets receiving decryption spam from startup or
            // receiving ancient events from backfill and such.
            this.advanceReadUpToMarker(ev)
        ) {
            // If the event is still being decrypted, remember that we want to
            // feed it to the widget (even if not strictly in the order given by
            // the timeline) and get back to it later
            if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) {
                this.eventsToFeed.add(ev);
            } else {
                const raw = ev.getEffectiveEvent();
                this.messaging.feedEvent(raw as IRoomEvent).catch((e) => {
                    logger.error("Error sending event to widget: ", e);
                });
            }
        }
    }
}
