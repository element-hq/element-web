/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020-2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    type Capability,
    EventDirection,
    type IOpenIDCredentials,
    type IOpenIDUpdate,
    type ISendDelayedEventDetails,
    type ISendEventDetails,
    type ITurnServer,
    type IReadEventRelationsResult,
    type IRoomEvent,
    MatrixCapabilities,
    OpenIDRequestState,
    type SimpleObservable,
    type Widget,
    WidgetDriver,
    WidgetEventCapability,
    WidgetKind,
    type IWidgetApiErrorResponseDataDetails,
    type ISearchUserDirectoryResult,
    type IGetMediaConfigResult,
    type UpdateDelayedEventAction,
} from "matrix-widget-api";
import {
    ClientEvent,
    type ITurnServer as IClientTurnServer,
    EventType,
    type IContent,
    MatrixError,
    type MatrixEvent,
    Direction,
    THREAD_RELATION_TYPE,
    type SendDelayedEventResponse,
    type StateEvents,
    type TimelineEvents,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    type ApprovalOpts,
    type CapabilitiesOpts,
    WidgetLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

import SdkConfig, { DEFAULTS } from "../../SdkConfig";
import { iterableDiff, iterableIntersection } from "../../utils/iterables";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import Modal from "../../Modal";
import WidgetOpenIDPermissionsDialog from "../../components/views/dialogs/WidgetOpenIDPermissionsDialog";
import WidgetCapabilitiesPromptDialog from "../../components/views/dialogs/WidgetCapabilitiesPromptDialog";
import { WidgetPermissionCustomisations } from "../../customisations/WidgetPermissions";
import { OIDCState } from "./WidgetPermissionStore";
import { WidgetType } from "../../widgets/WidgetType";
import { CHAT_EFFECTS } from "../../effects";
import { containsEmoji } from "../../effects/utils";
import dis from "../../dispatcher/dispatcher";
import { ElementWidgetCapabilities } from "./ElementWidgetCapabilities";
import { navigateToPermalink } from "../../utils/permalinks/navigator";
import { SdkContextClass } from "../../contexts/SDKContext";
import { ModuleRunner } from "../../modules/ModuleRunner";
import SettingsStore from "../../settings/SettingsStore";
import { mediaFromMxc } from "../../customisations/Media";

// TODO: Purge this from the universe

function getRememberedCapabilitiesForWidget(widget: Widget): Capability[] {
    return JSON.parse(localStorage.getItem(`widget_${widget.id}_approved_caps`) || "[]");
}

function setRememberedCapabilitiesForWidget(widget: Widget, caps: Capability[]): void {
    localStorage.setItem(`widget_${widget.id}_approved_caps`, JSON.stringify(caps));
}

const normalizeTurnServer = ({ urls, username, credential }: IClientTurnServer): ITurnServer => ({
    uris: urls,
    username,
    password: credential,
});

export class StopGapWidgetDriver extends WidgetDriver {
    private allowedCapabilities: Set<Capability>;

    // TODO: Refactor widgetKind into the Widget class
    public constructor(
        allowedCapabilities: Capability[],
        private forWidget: Widget,
        private forWidgetKind: WidgetKind,
        virtual: boolean,
        private inRoomId?: string,
    ) {
        super();

        // Always allow screenshots to be taken because it's a client-induced flow. The widget can't
        // spew screenshots at us and can't request screenshots of us, so it's up to us to provide the
        // button if the widget says it supports screenshots.
        this.allowedCapabilities = new Set([
            ...allowedCapabilities,
            MatrixCapabilities.Screenshots,
            ElementWidgetCapabilities.RequiresClient,
        ]);

        // Grant the permissions that are specific to given widget types
        if (WidgetType.JITSI.matches(this.forWidget.type) && forWidgetKind === WidgetKind.Room) {
            this.allowedCapabilities.add(MatrixCapabilities.AlwaysOnScreen);
        } else if (WidgetType.STICKERPICKER.matches(this.forWidget.type) && forWidgetKind === WidgetKind.Account) {
            const stickerSendingCap = WidgetEventCapability.forRoomEvent(EventDirection.Send, EventType.Sticker).raw;
            this.allowedCapabilities.add(MatrixCapabilities.StickerSending); // legacy as far as MSC2762 is concerned
            this.allowedCapabilities.add(stickerSendingCap);

            // Auto-approve the legacy visibility capability. We send it regardless of capability.
            // Widgets don't technically need to request this capability, but Scalar still does.
            this.allowedCapabilities.add("visibility");
        } else if (
            virtual &&
            new URL(SdkConfig.get("element_call").url ?? DEFAULTS.element_call.url!).origin === this.forWidget.origin
        ) {
            // This is a trusted Element Call widget that we control
            this.allowedCapabilities.add(MatrixCapabilities.AlwaysOnScreen);
            this.allowedCapabilities.add(MatrixCapabilities.MSC3846TurnServers);
            this.allowedCapabilities.add(`org.matrix.msc2762.timeline:${inRoomId}`);
            this.allowedCapabilities.add(MatrixCapabilities.MSC4157SendDelayedEvent);
            this.allowedCapabilities.add(MatrixCapabilities.MSC4157UpdateDelayedEvent);

            this.allowedCapabilities.add(
                WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomMember).raw,
            );
            this.allowedCapabilities.add(
                WidgetEventCapability.forStateEvent(EventDirection.Receive, "org.matrix.msc3401.call").raw,
            );
            this.allowedCapabilities.add(
                WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomEncryption).raw,
            );
            const clientUserId = MatrixClientPeg.safeGet().getSafeUserId();
            // For the legacy membership type
            this.allowedCapabilities.add(
                WidgetEventCapability.forStateEvent(EventDirection.Send, "org.matrix.msc3401.call.member", clientUserId)
                    .raw,
            );
            const clientDeviceId = MatrixClientPeg.safeGet().getDeviceId();
            if (clientDeviceId !== null) {
                // For the session membership type compliant with MSC4143
                this.allowedCapabilities.add(
                    WidgetEventCapability.forStateEvent(
                        EventDirection.Send,
                        "org.matrix.msc3401.call.member",
                        `_${clientUserId}_${clientDeviceId}`,
                    ).raw,
                );
                // Version with no leading underscore, for room versions whose auth rules allow it
                this.allowedCapabilities.add(
                    WidgetEventCapability.forStateEvent(
                        EventDirection.Send,
                        "org.matrix.msc3401.call.member",
                        `${clientUserId}_${clientDeviceId}`,
                    ).raw,
                );
            }
            this.allowedCapabilities.add(
                WidgetEventCapability.forStateEvent(EventDirection.Receive, "org.matrix.msc3401.call.member").raw,
            );
            // for determining auth rules specific to the room version
            this.allowedCapabilities.add(
                WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomCreate).raw,
            );

            const sendRecvRoomEvents = [
                "io.element.call.encryption_keys",
                "org.matrix.rageshake_request",
                EventType.Reaction,
                EventType.RoomRedaction,
                "io.element.call.reaction",
            ];
            for (const eventType of sendRecvRoomEvents) {
                this.allowedCapabilities.add(WidgetEventCapability.forRoomEvent(EventDirection.Send, eventType).raw);
                this.allowedCapabilities.add(WidgetEventCapability.forRoomEvent(EventDirection.Receive, eventType).raw);
            }

            const sendRecvToDevice = [
                EventType.CallInvite,
                EventType.CallCandidates,
                EventType.CallAnswer,
                EventType.CallHangup,
                EventType.CallReject,
                EventType.CallSelectAnswer,
                EventType.CallNegotiate,
                EventType.CallSDPStreamMetadataChanged,
                EventType.CallSDPStreamMetadataChangedPrefix,
                EventType.CallReplaces,
                EventType.CallEncryptionKeysPrefix,
            ];
            for (const eventType of sendRecvToDevice) {
                this.allowedCapabilities.add(
                    WidgetEventCapability.forToDeviceEvent(EventDirection.Send, eventType).raw,
                );
                this.allowedCapabilities.add(
                    WidgetEventCapability.forToDeviceEvent(EventDirection.Receive, eventType).raw,
                );
            }

            // To always allow OIDC requests for element call, the widgetPermissionStore is used:
            SdkContextClass.instance.widgetPermissionStore.setOIDCState(
                forWidget,
                forWidgetKind,
                inRoomId,
                OIDCState.Allowed,
            );
        }
    }

    public async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
        // Check to see if any capabilities aren't automatically accepted (such as sticker pickers
        // allowing stickers to be sent). If there are excess capabilities to be approved, the user
        // will be prompted to accept them.
        const diff = iterableDiff(requested, this.allowedCapabilities);
        const missing = new Set(diff.removed); // "removed" is "in A (requested) but not in B (allowed)"
        const allowedSoFar = new Set(this.allowedCapabilities);
        getRememberedCapabilitiesForWidget(this.forWidget).forEach((cap) => {
            allowedSoFar.add(cap);
            missing.delete(cap);
        });

        let approved: Set<string> | undefined;
        if (WidgetPermissionCustomisations.preapproveCapabilities) {
            approved = await WidgetPermissionCustomisations.preapproveCapabilities(this.forWidget, requested);
        } else {
            const opts: CapabilitiesOpts = { approvedCapabilities: undefined };
            ModuleRunner.instance.invoke(WidgetLifecycle.CapabilitiesRequest, opts, this.forWidget, requested);
            approved = opts.approvedCapabilities;
        }
        if (approved) {
            approved.forEach((cap) => {
                allowedSoFar.add(cap);
                missing.delete(cap);
            });
        }

        // TODO: Do something when the widget requests new capabilities not yet asked for
        let rememberApproved = false;
        if (missing.size > 0) {
            try {
                const [result] = await Modal.createDialog(WidgetCapabilitiesPromptDialog, {
                    requestedCapabilities: missing,
                    widget: this.forWidget,
                    widgetKind: this.forWidgetKind,
                }).finished;
                result?.approved?.forEach((cap) => allowedSoFar.add(cap));
                rememberApproved = !!result?.remember;
            } catch (e) {
                logger.error("Non-fatal error getting capabilities: ", e);
            }
        }

        // discard all previously allowed capabilities if they are not requested
        // TODO: this results in an unexpected behavior when this function is called during the capabilities renegotiation of MSC2974 that will be resolved later.
        const allAllowed = new Set(iterableIntersection(allowedSoFar, requested));

        if (rememberApproved) {
            setRememberedCapabilitiesForWidget(this.forWidget, Array.from(allAllowed));
        }

        return allAllowed;
    }

    public async sendEvent<K extends keyof StateEvents>(
        eventType: K,
        content: StateEvents[K],
        stateKey: string | null,
        targetRoomId: string | null,
    ): Promise<ISendEventDetails>;
    public async sendEvent<K extends keyof TimelineEvents>(
        eventType: K,
        content: TimelineEvents[K],
        stateKey: null,
        targetRoomId: string | null,
    ): Promise<ISendEventDetails>;
    public async sendEvent(
        eventType: string,
        content: IContent,
        stateKey: string | null = null,
        targetRoomId: string | null = null,
    ): Promise<ISendEventDetails> {
        const client = MatrixClientPeg.get();
        const roomId = targetRoomId || SdkContextClass.instance.roomViewStore.getRoomId();

        if (!client || !roomId) throw new Error("Not in a room or not attached to a client");

        let r: { event_id: string } | null;
        if (stateKey !== null) {
            // state event
            r = await client.sendStateEvent(
                roomId,
                eventType as keyof StateEvents,
                content as StateEvents[keyof StateEvents],
                stateKey,
            );
        } else if (eventType === EventType.RoomRedaction) {
            // special case: extract the `redacts` property and call redact
            r = await client.redactEvent(roomId, content["redacts"]);
        } else {
            // message event
            r = await client.sendEvent(
                roomId,
                eventType as keyof TimelineEvents,
                content as TimelineEvents[keyof TimelineEvents],
            );

            if (eventType === EventType.RoomMessage) {
                CHAT_EFFECTS.forEach((effect) => {
                    if (containsEmoji(content, effect.emojis)) {
                        // For initial threads launch, chat effects are disabled
                        // see #19731
                        const isNotThread = content["m.relates_to"]?.rel_type !== THREAD_RELATION_TYPE.name;
                        if (isNotThread) {
                            dis.dispatch({ action: `effects.${effect.command}` });
                        }
                    }
                });
            }
        }

        return { roomId, eventId: r.event_id };
    }

    /**
     * @experimental Part of MSC4140 & MSC4157
     * @see {@link WidgetDriver#sendDelayedEvent}
     */
    public async sendDelayedEvent<K extends keyof StateEvents>(
        delay: number | null,
        parentDelayId: string | null,
        eventType: K,
        content: StateEvents[K],
        stateKey: string | null,
        targetRoomId: string | null,
    ): Promise<ISendDelayedEventDetails>;
    /**
     * @experimental Part of MSC4140 & MSC4157
     */
    public async sendDelayedEvent<K extends keyof TimelineEvents>(
        delay: number | null,
        parentDelayId: string | null,
        eventType: K,
        content: TimelineEvents[K],
        stateKey: null,
        targetRoomId: string | null,
    ): Promise<ISendDelayedEventDetails>;
    public async sendDelayedEvent(
        delay: number | null,
        parentDelayId: string | null,
        eventType: string,
        content: IContent,
        stateKey: string | null = null,
        targetRoomId: string | null = null,
    ): Promise<ISendDelayedEventDetails> {
        const client = MatrixClientPeg.get();
        const roomId = targetRoomId || SdkContextClass.instance.roomViewStore.getRoomId();

        if (!client || !roomId) throw new Error("Not in a room or not attached to a client");

        let delayOpts;
        if (delay !== null) {
            delayOpts = {
                delay,
                ...(parentDelayId !== null && { parent_delay_id: parentDelayId }),
            };
        } else if (parentDelayId !== null) {
            delayOpts = {
                parent_delay_id: parentDelayId,
            };
        } else {
            throw new Error("Must provide at least one of delay or parentDelayId");
        }

        let r: SendDelayedEventResponse | null;
        if (stateKey !== null) {
            // state event
            r = await client._unstable_sendDelayedStateEvent(
                roomId,
                delayOpts,
                eventType as keyof StateEvents,
                content as StateEvents[keyof StateEvents],
                stateKey,
            );
        } else {
            // message event
            r = await client._unstable_sendDelayedEvent(
                roomId,
                delayOpts,
                null,
                eventType as keyof TimelineEvents,
                content as TimelineEvents[keyof TimelineEvents],
            );
        }

        return {
            roomId,
            delayId: r.delay_id,
        };
    }

    /**
     * @experimental Part of MSC4140 & MSC4157
     */
    public async updateDelayedEvent(delayId: string, action: UpdateDelayedEventAction): Promise<void> {
        const client = MatrixClientPeg.get();

        if (!client) throw new Error("Not in a room or not attached to a client");

        await client._unstable_updateDelayedEvent(delayId, action);
    }

    /**
     * Implements {@link WidgetDriver#sendToDevice}
     */
    public async sendToDevice(
        eventType: string,
        encrypted: boolean,
        contentMap: { [userId: string]: { [deviceId: string]: object } },
    ): Promise<void> {
        const client = MatrixClientPeg.safeGet();

        if (encrypted) {
            const crypto = client.getCrypto();
            if (!crypto) throw new Error("E2EE not enabled");

            // attempt to re-batch these up into a single request
            const invertedContentMap: { [content: string]: { userId: string; deviceId: string }[] } = {};

            for (const userId of Object.keys(contentMap)) {
                const userContentMap = contentMap[userId];
                for (const deviceId of Object.keys(userContentMap)) {
                    const content = userContentMap[deviceId];
                    const stringifiedContent = JSON.stringify(content);
                    invertedContentMap[stringifiedContent] = invertedContentMap[stringifiedContent] || [];
                    invertedContentMap[stringifiedContent].push({ userId, deviceId });
                }
            }

            await Promise.all(
                Object.entries(invertedContentMap).map(async ([stringifiedContent, recipients]) => {
                    const batch = await crypto.encryptToDeviceMessages(
                        eventType,
                        recipients,
                        JSON.parse(stringifiedContent),
                    );

                    await client.queueToDevice(batch);
                }),
            );
        } else {
            await client.queueToDevice({
                eventType,
                batch: Object.entries(contentMap).flatMap(([userId, userContentMap]) =>
                    Object.entries(userContentMap).map(([deviceId, content]) => ({
                        userId,
                        deviceId,
                        payload: content,
                    })),
                ),
            });
        }
    }

    /**
     * Reads all events of the given type, and optionally `msgtype` (if applicable/defined),
     * the user has access to. The widget API will have already verified that the widget is
     * capable of receiving the events. Less events than the limit are allowed to be returned,
     * but not more.
     * @param roomId The ID of the room to look within.
     * @param eventType The event type to be read.
     * @param msgtype The msgtype of the events to be read, if applicable/defined.
     * @param stateKey The state key of the events to be read, if applicable/defined.
     * @param limit The maximum number of events to retrieve. Will be zero to denote "as many as
     * possible".
     * @param since When null, retrieves the number of events specified by the "limit" parameter.
     * Otherwise, the event ID at which only subsequent events will be returned, as many as specified
     * in "limit".
     * @returns {Promise<IRoomEvent[]>} Resolves to the room events, or an empty array.
     */
    public async readRoomTimeline(
        roomId: string,
        eventType: string,
        msgtype: string | undefined,
        stateKey: string | undefined,
        limit: number,
        since: string | undefined,
    ): Promise<IRoomEvent[]> {
        limit = limit > 0 ? Math.min(limit, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER; // relatively arbitrary

        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (room === null) return [];
        const results: MatrixEvent[] = [];
        const events = room.getLiveTimeline().getEvents(); // timelines are most recent last
        for (let i = events.length - 1; i >= 0; i--) {
            const ev = events[i];
            if (results.length >= limit) break;
            if (since !== undefined && ev.getId() === since) break;

            if (ev.getType() !== eventType || ev.isState()) continue;
            if (eventType === EventType.RoomMessage && msgtype && msgtype !== ev.getContent()["msgtype"]) continue;
            if (ev.getStateKey() !== undefined && stateKey !== undefined && ev.getStateKey() !== stateKey) continue;
            results.push(ev);
        }

        return results.map((e) => e.getEffectiveEvent() as IRoomEvent);
    }

    /**
     * Reads the current values of all matching room state entries.
     * @param roomId The ID of the room.
     * @param eventType The event type of the entries to be read.
     * @param stateKey The state key of the entry to be read. If undefined,
     * all room state entries with a matching event type should be returned.
     * @returns {Promise<IRoomEvent[]>} Resolves to the events representing the
     * current values of the room state entries.
     */
    public async readRoomState(roomId: string, eventType: string, stateKey: string | undefined): Promise<IRoomEvent[]> {
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (room === null) return [];
        const state = room.getLiveTimeline().getState(Direction.Forward);
        if (state === undefined) return [];

        if (stateKey === undefined)
            return state.getStateEvents(eventType).map((e) => e.getEffectiveEvent() as IRoomEvent);
        const event = state.getStateEvents(eventType, stateKey);
        return event === null ? [] : [event.getEffectiveEvent() as IRoomEvent];
    }

    public async askOpenID(observer: SimpleObservable<IOpenIDUpdate>): Promise<void> {
        const opts: ApprovalOpts = { approved: undefined };
        ModuleRunner.instance.invoke(WidgetLifecycle.IdentityRequest, opts, this.forWidget);
        if (opts.approved) {
            return observer.update({
                state: OpenIDRequestState.Allowed,
                token: await MatrixClientPeg.safeGet().getOpenIdToken(),
            });
        }

        const oidcState = SdkContextClass.instance.widgetPermissionStore.getOIDCState(
            this.forWidget,
            this.forWidgetKind,
            this.inRoomId,
        );

        const getToken = (): Promise<IOpenIDCredentials> => {
            return MatrixClientPeg.safeGet().getOpenIdToken();
        };

        if (oidcState === OIDCState.Denied) {
            return observer.update({ state: OpenIDRequestState.Blocked });
        }
        if (oidcState === OIDCState.Allowed) {
            return observer.update({ state: OpenIDRequestState.Allowed, token: await getToken() });
        }

        observer.update({ state: OpenIDRequestState.PendingUserConfirmation });

        Modal.createDialog(WidgetOpenIDPermissionsDialog, {
            widget: this.forWidget,
            widgetKind: this.forWidgetKind,
            inRoomId: this.inRoomId,

            onFinished: async (confirm): Promise<void> => {
                if (!confirm) {
                    return observer.update({ state: OpenIDRequestState.Blocked });
                }

                return observer.update({ state: OpenIDRequestState.Allowed, token: await getToken() });
            },
        });
    }

    public async navigate(uri: string): Promise<void> {
        navigateToPermalink(uri);
    }

    public async *getTurnServers(): AsyncGenerator<ITurnServer> {
        const client = MatrixClientPeg.safeGet();
        if (!client.pollingTurnServers || !client.getTurnServers().length) return;

        let setTurnServer: (server: ITurnServer) => void;
        let setError: (error: Error) => void;

        const onTurnServers = ([server]: IClientTurnServer[]): void => setTurnServer(normalizeTurnServer(server));
        const onTurnServersError = (error: Error, fatal: boolean): void => {
            if (fatal) setError(error);
        };

        client.on(ClientEvent.TurnServers, onTurnServers);
        client.on(ClientEvent.TurnServersError, onTurnServersError);

        try {
            const initialTurnServer = client.getTurnServers()[0];
            yield normalizeTurnServer(initialTurnServer);

            // Repeatedly listen for new TURN servers until an error occurs or
            // the caller stops this generator
            while (true) {
                yield await new Promise<ITurnServer>((resolve, reject) => {
                    setTurnServer = resolve;
                    setError = reject;
                });
            }
        } finally {
            // The loop was broken - clean up
            client.off(ClientEvent.TurnServers, onTurnServers);
            client.off(ClientEvent.TurnServersError, onTurnServersError);
        }
    }

    public async readEventRelations(
        eventId: string,
        roomId?: string,
        relationType?: string,
        eventType?: string,
        from?: string,
        to?: string,
        limit?: number,
        direction?: "f" | "b",
    ): Promise<IReadEventRelationsResult> {
        const client = MatrixClientPeg.safeGet();
        const dir = direction as Direction;
        roomId = roomId ?? SdkContextClass.instance.roomViewStore.getRoomId() ?? undefined;

        if (typeof roomId !== "string") {
            throw new Error("Error while reading the current room");
        }

        const { events, nextBatch, prevBatch } = await client.relations(
            roomId,
            eventId,
            relationType ?? null,
            eventType ?? null,
            { from, to, limit, dir },
        );

        return {
            chunk: events.map((e) => e.getEffectiveEvent() as IRoomEvent),
            nextBatch: nextBatch ?? undefined,
            prevBatch: prevBatch ?? undefined,
        };
    }

    public async searchUserDirectory(searchTerm: string, limit?: number): Promise<ISearchUserDirectoryResult> {
        const client = MatrixClientPeg.safeGet();

        const { limited, results } = await client.searchUserDirectory({ term: searchTerm, limit });

        return {
            limited,
            results: results.map((r) => ({
                userId: r.user_id,
                displayName: r.display_name,
                avatarUrl: r.avatar_url,
            })),
        };
    }

    public async getMediaConfig(): Promise<IGetMediaConfigResult> {
        const client = MatrixClientPeg.safeGet();

        return await client.getMediaConfig();
    }

    public async uploadFile(file: XMLHttpRequestBodyInit): Promise<{ contentUri: string }> {
        const client = MatrixClientPeg.safeGet();

        const uploadResult = await client.uploadContent(file);

        return { contentUri: uploadResult.content_uri };
    }

    /**
     * Download a file from the media repository on the homeserver.
     *
     * @param contentUri - the MXC URI of the file to download
     * @returns an object with: file - response contents as Blob
     */
    public async downloadFile(contentUri: string): Promise<{ file: XMLHttpRequestBodyInit }> {
        const client = MatrixClientPeg.safeGet();
        const media = mediaFromMxc(contentUri, client);
        const response = await media.downloadSource();
        const blob = await response.blob();
        return { file: blob };
    }

    /**
     * Gets the IDs of all joined or invited rooms currently known to the
     * client.
     * @returns The room IDs.
     */
    public getKnownRooms(): string[] {
        return MatrixClientPeg.safeGet()
            .getVisibleRooms(SettingsStore.getValue("feature_dynamic_room_predecessors"))
            .map((r) => r.roomId);
    }

    /**
     * Expresses a {@link MatrixError} as a JSON payload
     * for use by Widget API error responses.
     * @param error The error to handle.
     * @returns The error expressed as a JSON payload,
     * or undefined if it is not a {@link MatrixError}.
     */
    public processError(error: unknown): IWidgetApiErrorResponseDataDetails | undefined {
        return error instanceof MatrixError ? { matrix_api_error: error.asWidgetApiErrorData() } : undefined;
    }
}
