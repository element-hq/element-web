/*
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { ReactNode } from "react";
import * as utils from "matrix-js-sdk/src/utils";
import { MatrixError } from "matrix-js-sdk/src/http-api";
import { logger } from "matrix-js-sdk/src/logger";
import { ViewRoom as ViewRoomEvent } from "@matrix-org/analytics-events/types/typescript/ViewRoom";
import { JoinedRoom as JoinedRoomEvent } from "@matrix-org/analytics-events/types/typescript/JoinedRoom";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Optional } from "matrix-events-sdk";
import EventEmitter from "events";

import { MatrixDispatcher } from "../dispatcher/dispatcher";
import { MatrixClientPeg } from "../MatrixClientPeg";
import Modal from "../Modal";
import { _t } from "../languageHandler";
import { getCachedRoomIDForAlias, storeRoomAliasInCache } from "../RoomAliasCache";
import { Action } from "../dispatcher/actions";
import { retry } from "../utils/promise";
import { TimelineRenderingType } from "../contexts/RoomContext";
import { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import DMRoomMap from "../utils/DMRoomMap";
import { isMetaSpace, MetaSpace } from "./spaces";
import { JoinRoomPayload } from "../dispatcher/payloads/JoinRoomPayload";
import { JoinRoomReadyPayload } from "../dispatcher/payloads/JoinRoomReadyPayload";
import { JoinRoomErrorPayload } from "../dispatcher/payloads/JoinRoomErrorPayload";
import { ViewRoomErrorPayload } from "../dispatcher/payloads/ViewRoomErrorPayload";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import { ActiveRoomChangedPayload } from "../dispatcher/payloads/ActiveRoomChangedPayload";
import SettingsStore from "../settings/SettingsStore";
import { awaitRoomDownSync } from "../utils/RoomUpgrade";
import { UPDATE_EVENT } from "./AsyncStore";
import { SdkContextClass } from "../contexts/SDKContext";
import { CallStore } from "./CallStore";
import { ThreadPayload } from "../dispatcher/payloads/ThreadPayload";
import {
    doClearCurrentVoiceBroadcastPlaybackIfStopped,
    doMaybeSetCurrentVoiceBroadcastPlayback,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingsStoreEvent,
} from "../voice-broadcast";
import { IRoomStateEventsActionPayload } from "../actions/MatrixActionCreators";
import { showCantStartACallDialog } from "../voice-broadcast/utils/showCantStartACallDialog";
import { pauseNonLiveBroadcastFromOtherRoom } from "../voice-broadcast/utils/pauseNonLiveBroadcastFromOtherRoom";
import { ActionPayload } from "../dispatcher/payloads";

const NUM_JOIN_RETRY = 5;

interface State {
    /**
     * Whether we're joining the currently viewed (see isJoining())
     */
    joining: boolean;
    /**
     * Any error that has occurred during joining
     */
    joinError: Error | null;
    /**
     * The ID of the room currently being viewed
     */
    roomId: string | null;
    /**
     * The ID of the thread currently being viewed
     */
    threadId: string | null;
    /**
     * The ID of the room being subscribed to (in Sliding Sync)
     */
    subscribingRoomId: string | null;
    /**
     * The event to scroll to when the room is first viewed
     */
    initialEventId: string | null;
    initialEventPixelOffset: number | null;
    /**
     * Whether to highlight the initial event
     */
    isInitialEventHighlighted: boolean;
    /**
     * Whether to scroll the initial event into view
     */
    initialEventScrollIntoView: boolean;
    /**
     * The alias of the room (or null if not originally specified in view_room)
     */
    roomAlias: string | null;
    /**
     * Whether the current room is loading
     */
    roomLoading: boolean;
    /**
     * Any error that has occurred during loading
     */
    roomLoadError: MatrixError | null;
    replyingToEvent: MatrixEvent | null;
    shouldPeek: boolean;
    viaServers: string[];
    wasContextSwitch: boolean;
    /**
     * Whether we're viewing a call or call lobby in this room
     */
    viewingCall: boolean;
}

const INITIAL_STATE: State = {
    joining: false,
    joinError: null,
    roomId: null,
    threadId: null,
    subscribingRoomId: null,
    initialEventId: null,
    initialEventPixelOffset: null,
    isInitialEventHighlighted: false,
    initialEventScrollIntoView: true,
    roomAlias: null,
    roomLoading: false,
    roomLoadError: null,
    replyingToEvent: null,
    shouldPeek: false,
    viaServers: [],
    wasContextSwitch: false,
    viewingCall: false,
};

type Listener = (isActive: boolean) => void;

/**
 * A class for storing application state for RoomView.
 */
export class RoomViewStore extends EventEmitter {
    // initialize state as a copy of the initial state. We need to copy else one RVS can talk to
    // another RVS via INITIAL_STATE as they share the same underlying object. Mostly relevant for tests.
    private state = utils.deepCopy(INITIAL_STATE);

    private dis?: MatrixDispatcher;
    private dispatchToken?: string;

    public constructor(dis: MatrixDispatcher, private readonly stores: SdkContextClass) {
        super();
        this.resetDispatcher(dis);
        this.stores.voiceBroadcastRecordingsStore.addListener(
            VoiceBroadcastRecordingsStoreEvent.CurrentChanged,
            this.onCurrentBroadcastRecordingChanged,
        );
    }

    public addRoomListener(roomId: string, fn: Listener): void {
        this.on(roomId, fn);
    }

    public removeRoomListener(roomId: string, fn: Listener): void {
        this.off(roomId, fn);
    }

    private emitForRoom(roomId: string, isActive: boolean): void {
        this.emit(roomId, isActive);
    }

    private onCurrentBroadcastRecordingChanged = (recording: VoiceBroadcastRecording | null): void => {
        if (recording === null) {
            const room = this.stores.client?.getRoom(this.state.roomId || undefined);

            if (room) {
                this.doMaybeSetCurrentVoiceBroadcastPlayback(room);
            }
        }
    };

    private setState(newState: Partial<State>): void {
        // If values haven't changed, there's nothing to do.
        // This only tries a shallow comparison, so unchanged objects will slip
        // through, but that's probably okay for now.
        let stateChanged = false;
        for (const key of Object.keys(newState)) {
            if (this.state[key as keyof State] !== newState[key as keyof State]) {
                stateChanged = true;
                break;
            }
        }
        if (!stateChanged) {
            return;
        }

        if (newState.viewingCall) {
            // Pause current broadcast, if any
            this.stores.voiceBroadcastPlaybacksStore.getCurrent()?.pause();

            if (this.stores.voiceBroadcastRecordingsStore.getCurrent()) {
                showCantStartACallDialog();
                newState.viewingCall = false;
            }
        }

        const lastRoomId = this.state.roomId;
        this.state = Object.assign(this.state, newState);
        if (lastRoomId !== this.state.roomId) {
            if (lastRoomId) this.emitForRoom(lastRoomId, false);
            if (this.state.roomId) this.emitForRoom(this.state.roomId, true);

            // Fired so we can reduce dependency on event emitters to this store, which is relatively
            // central to the application and can easily cause import cycles.
            this.dis?.dispatch<ActiveRoomChangedPayload>({
                action: Action.ActiveRoomChanged,
                oldRoomId: lastRoomId,
                newRoomId: this.state.roomId,
            });
        }

        this.emit(UPDATE_EVENT);
    }

    private doMaybeSetCurrentVoiceBroadcastPlayback(room: Room): void {
        if (!this.stores.client) return;
        doMaybeSetCurrentVoiceBroadcastPlayback(
            room,
            this.stores.client,
            this.stores.voiceBroadcastPlaybacksStore,
            this.stores.voiceBroadcastRecordingsStore,
        );
    }

    private onRoomStateEvents(event: MatrixEvent): void {
        const roomId = event.getRoomId?.();

        // no room or not current room
        if (!roomId || roomId !== this.state.roomId) return;

        const room = this.stores.client?.getRoom(roomId);

        if (room) {
            this.doMaybeSetCurrentVoiceBroadcastPlayback(room);
        }
    }

    private onDispatch(payload: ActionPayload): void {
        // eslint-disable-line @typescript-eslint/naming-convention
        switch (payload.action) {
            // view_room:
            //      - room_alias:   '#somealias:matrix.org'
            //      - room_id:      '!roomid123:matrix.org'
            //      - event_id:     '$213456782:matrix.org'
            //      - event_offset: 100
            //      - highlighted:  true
            case Action.ViewRoom:
                this.viewRoom(payload as ViewRoomPayload);
                break;
            case Action.ViewThread:
                this.viewThread(payload as ThreadPayload);
                break;
            // for these events blank out the roomId as we are no longer in the RoomView
            case "view_welcome_page":
            case Action.ViewHomePage:
                this.setState({
                    roomId: null,
                    roomAlias: null,
                    viaServers: [],
                    wasContextSwitch: false,
                    viewingCall: false,
                });
                doClearCurrentVoiceBroadcastPlaybackIfStopped(this.stores.voiceBroadcastPlaybacksStore);
                break;
            case "MatrixActions.RoomState.events":
                this.onRoomStateEvents((payload as IRoomStateEventsActionPayload).event);
                break;
            case Action.ViewRoomError:
                this.viewRoomError(payload as ViewRoomErrorPayload);
                break;
            case "will_join":
                this.setState({
                    joining: true,
                });
                break;
            case "cancel_join":
                this.setState({
                    joining: false,
                });
                break;
            // join_room:
            //      - opts: options for joinRoom
            case Action.JoinRoom:
                this.joinRoom(payload as JoinRoomPayload);
                break;
            case Action.JoinRoomError:
                this.joinRoomError(payload as JoinRoomErrorPayload);
                break;
            case Action.JoinRoomReady: {
                if (this.state.roomId === payload.roomId) {
                    this.setState({ shouldPeek: false });
                }

                awaitRoomDownSync(MatrixClientPeg.get(), payload.roomId).then((room) => {
                    const numMembers = room.getJoinedMemberCount();
                    const roomSize =
                        numMembers > 1000
                            ? "MoreThanAThousand"
                            : numMembers > 100
                            ? "OneHundredAndOneToAThousand"
                            : numMembers > 10
                            ? "ElevenToOneHundred"
                            : numMembers > 2
                            ? "ThreeToTen"
                            : numMembers > 1
                            ? "Two"
                            : "One";

                    this.stores.posthogAnalytics.trackEvent<JoinedRoomEvent>({
                        eventName: "JoinedRoom",
                        trigger: payload.metricsTrigger,
                        roomSize,
                        isDM: !!DMRoomMap.shared().getUserIdForRoomId(room.roomId),
                        isSpace: room.isSpaceRoom(),
                    });
                });

                break;
            }
            case "on_client_not_viable":
            case Action.OnLoggedOut:
                this.reset();
                break;
            case "reply_to_event":
                // Thread timeline view handles its own reply-to-state
                if (TimelineRenderingType.Thread !== payload.context) {
                    // If currently viewed room does not match the room in which we wish to reply then change rooms this
                    // can happen when performing a search across all rooms. Persist the data from this event for both
                    // room and search timeline rendering types, search will get auto-closed by RoomView at this time.
                    if (payload.event && payload.event.getRoomId() !== this.state.roomId) {
                        this.dis?.dispatch<ViewRoomPayload>({
                            action: Action.ViewRoom,
                            room_id: payload.event.getRoomId(),
                            replyingToEvent: payload.event,
                            metricsTrigger: undefined, // room doesn't change
                        });
                    } else {
                        this.setState({
                            replyingToEvent: payload.event,
                        });
                    }
                }
                break;
        }
    }

    private async viewRoom(payload: ViewRoomPayload): Promise<void> {
        if (payload.room_id) {
            const room = MatrixClientPeg.get().getRoom(payload.room_id);

            if (payload.metricsTrigger !== null && payload.room_id !== this.state.roomId) {
                let activeSpace: ViewRoomEvent["activeSpace"];
                if (this.stores.spaceStore.activeSpace === MetaSpace.Home) {
                    activeSpace = "Home";
                } else if (isMetaSpace(this.stores.spaceStore.activeSpace)) {
                    activeSpace = "Meta";
                } else {
                    activeSpace =
                        this.stores.spaceStore.activeSpaceRoom?.getJoinRule() === JoinRule.Public
                            ? "Public"
                            : "Private";
                }

                this.stores.posthogAnalytics.trackEvent<ViewRoomEvent>({
                    eventName: "ViewRoom",
                    trigger: payload.metricsTrigger,
                    viaKeyboard: payload.metricsViaKeyboard,
                    isDM: !!DMRoomMap.shared().getUserIdForRoomId(payload.room_id),
                    isSpace: room?.isSpaceRoom(),
                    activeSpace,
                });
            }

            if (SettingsStore.getValue("feature_sliding_sync") && this.state.roomId !== payload.room_id) {
                if (this.state.subscribingRoomId && this.state.subscribingRoomId !== payload.room_id) {
                    // unsubscribe from this room, but don't await it as we don't care when this gets done.
                    this.stores.slidingSyncManager.setRoomVisible(this.state.subscribingRoomId, false);
                }
                this.setState({
                    subscribingRoomId: payload.room_id,
                    roomId: payload.room_id,
                    initialEventId: null,
                    initialEventPixelOffset: null,
                    initialEventScrollIntoView: true,
                    roomAlias: null,
                    roomLoading: true,
                    roomLoadError: null,
                    viaServers: payload.via_servers,
                    wasContextSwitch: payload.context_switch,
                    viewingCall: payload.view_call ?? false,
                });
                // set this room as the room subscription. We need to await for it as this will fetch
                // all room state for this room, which is required before we get the state below.
                await this.stores.slidingSyncManager.setRoomVisible(payload.room_id, true);
                // Whilst we were subscribing another room was viewed, so stop what we're doing and
                // unsubscribe
                if (this.state.subscribingRoomId !== payload.room_id) {
                    this.stores.slidingSyncManager.setRoomVisible(payload.room_id, false);
                    return;
                }
                // Re-fire the payload: we won't re-process it because the prev room ID == payload room ID now
                this.dis?.dispatch({
                    ...payload,
                });
                return;
            }

            const newState: Partial<State> = {
                roomId: payload.room_id,
                roomAlias: payload.room_alias ?? null,
                initialEventId: payload.event_id ?? null,
                isInitialEventHighlighted: payload.highlighted ?? false,
                initialEventScrollIntoView: payload.scroll_into_view ?? true,
                roomLoading: false,
                roomLoadError: null,
                // should peek by default
                shouldPeek: payload.should_peek === undefined ? true : payload.should_peek,
                // have we sent a join request for this room and are waiting for a response?
                joining: payload.joining || false,
                // Reset replyingToEvent because we don't want cross-room because bad UX
                replyingToEvent: null,
                viaServers: payload.via_servers ?? [],
                wasContextSwitch: payload.context_switch ?? false,
                viewingCall:
                    payload.view_call ??
                    (payload.room_id === this.state.roomId
                        ? this.state.viewingCall
                        : CallStore.instance.getActiveCall(payload.room_id) !== null),
            };

            // Allow being given an event to be replied to when switching rooms but sanity check its for this room
            if (payload.replyingToEvent?.getRoomId() === payload.room_id) {
                newState.replyingToEvent = payload.replyingToEvent;
            } else if (this.state.replyingToEvent?.getRoomId() === payload.room_id) {
                // if the reply-to matches the desired room, e.g visiting a permalink then maintain replyingToEvent
                // See https://github.com/vector-im/element-web/issues/21462
                newState.replyingToEvent = this.state.replyingToEvent;
            }

            this.setState(newState);

            if (payload.auto_join) {
                this.dis?.dispatch<JoinRoomPayload>({
                    ...payload,
                    action: Action.JoinRoom,
                    roomId: payload.room_id,
                    metricsTrigger: payload.metricsTrigger as JoinRoomPayload["metricsTrigger"],
                });
            }

            if (room) {
                pauseNonLiveBroadcastFromOtherRoom(room, this.stores.voiceBroadcastPlaybacksStore);
                this.doMaybeSetCurrentVoiceBroadcastPlayback(room);
            }
        } else if (payload.room_alias) {
            // Try the room alias to room ID navigation cache first to avoid
            // blocking room navigation on the homeserver.
            let roomId = getCachedRoomIDForAlias(payload.room_alias);
            if (!roomId) {
                // Room alias cache miss, so let's ask the homeserver. Resolve the alias
                // and then do a second dispatch with the room ID acquired.
                this.setState({
                    roomId: null,
                    initialEventId: null,
                    initialEventPixelOffset: null,
                    isInitialEventHighlighted: false,
                    initialEventScrollIntoView: true,
                    roomAlias: payload.room_alias,
                    roomLoading: true,
                    roomLoadError: null,
                    viaServers: payload.via_servers,
                    wasContextSwitch: payload.context_switch,
                    viewingCall: payload.view_call ?? false,
                });
                try {
                    const result = await MatrixClientPeg.get().getRoomIdForAlias(payload.room_alias);
                    storeRoomAliasInCache(payload.room_alias, result.room_id);
                    roomId = result.room_id;
                } catch (err) {
                    logger.error("RVS failed to get room id for alias: ", err);
                    this.dis?.dispatch<ViewRoomErrorPayload>({
                        action: Action.ViewRoomError,
                        room_id: null,
                        room_alias: payload.room_alias,
                        err,
                    });
                    return;
                }
            }

            // Re-fire the payload with the newly found room_id
            this.dis?.dispatch({
                ...payload,
                room_id: roomId,
            });
        }
    }

    private viewThread(payload: ThreadPayload): void {
        this.setState({
            threadId: payload.thread_id,
        });
    }

    private viewRoomError(payload: ViewRoomErrorPayload): void {
        this.setState({
            roomId: payload.room_id,
            roomAlias: payload.room_alias,
            roomLoading: false,
            roomLoadError: payload.err,
        });
    }

    private async joinRoom(payload: JoinRoomPayload): Promise<void> {
        this.setState({
            joining: true,
        });

        const cli = MatrixClientPeg.get();
        // take a copy of roomAlias & roomId as they may change by the time the join is complete
        const { roomAlias, roomId = payload.roomId } = this.state;
        const address = roomAlias || roomId!;
        const viaServers = this.state.viaServers || [];
        try {
            await retry<Room, MatrixError>(
                () =>
                    cli.joinRoom(address, {
                        viaServers,
                        ...(payload.opts || {}),
                    }),
                NUM_JOIN_RETRY,
                (err) => {
                    // if we received a Gateway timeout then retry
                    return err.httpStatus === 504;
                },
            );

            // We do *not* clear the 'joining' flag because the Room object and/or our 'joined' member event may not
            // have come down the sync stream yet, and that's the point at which we'd consider the user joined to the
            // room.
            this.dis?.dispatch<JoinRoomReadyPayload>({
                action: Action.JoinRoomReady,
                roomId: roomId!,
                metricsTrigger: payload.metricsTrigger,
            });
        } catch (err) {
            this.dis?.dispatch({
                action: Action.JoinRoomError,
                roomId,
                err,
            });
        }
    }

    private getInvitingUserId(roomId: string): string | undefined {
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(roomId);
        if (room?.getMyMembership() === "invite") {
            const myMember = room.getMember(cli.getSafeUserId());
            const inviteEvent = myMember ? myMember.events.member : null;
            return inviteEvent?.getSender();
        }
    }

    public showJoinRoomError(err: MatrixError, roomId: string): void {
        let description: ReactNode = err.message ? err.message : JSON.stringify(err);
        logger.log("Failed to join room:", description);

        if (err.name === "ConnectionError") {
            description = _t("There was an error joining.");
        } else if (err.errcode === "M_INCOMPATIBLE_ROOM_VERSION") {
            description = (
                <div>
                    {_t("Sorry, your homeserver is too old to participate here.")}
                    <br />
                    {_t("Please contact your homeserver administrator.")}
                </div>
            );
        } else if (err.httpStatus === 404) {
            const invitingUserId = this.getInvitingUserId(roomId);
            // provide a better error message for invites
            if (invitingUserId) {
                // if the inviting user is on the same HS, there can only be one cause: they left.
                if (invitingUserId.endsWith(`:${MatrixClientPeg.get().getDomain()}`)) {
                    description = _t("The person who invited you has already left.");
                } else {
                    description = _t("The person who invited you has already left, or their server is offline.");
                }
            }

            // provide a more detailed error than "No known servers" when attempting to
            // join using a room ID and no via servers
            if (roomId === this.state.roomId && this.state.viaServers.length === 0) {
                description = (
                    <div>
                        {_t(
                            "You attempted to join using a room ID without providing a list " +
                                "of servers to join through. Room IDs are internal identifiers and " +
                                "cannot be used to join a room without additional information.",
                        )}
                        <br />
                        <br />
                        {_t("If you know a room address, try joining through that instead.")}
                    </div>
                );
            }
        }

        Modal.createDialog(ErrorDialog, {
            title: _t("Failed to join"),
            description,
        });
    }

    private joinRoomError(payload: JoinRoomErrorPayload): void {
        this.setState({
            joining: false,
            joinError: payload.err,
        });
        if (payload.err) {
            this.showJoinRoomError(payload.err, payload.roomId);
        }
    }

    public reset(): void {
        this.state = Object.assign({}, INITIAL_STATE);
    }

    /**
     * Reset which dispatcher should be used to listen for actions. The old dispatcher will be
     * unregistered.
     * @param dis The new dispatcher to use.
     */
    public resetDispatcher(dis: MatrixDispatcher): void {
        if (this.dispatchToken) {
            this.dis?.unregister(this.dispatchToken);
        }
        this.dis = dis;
        if (dis) {
            // Some tests mock the dispatcher file resulting in an empty defaultDispatcher
            // so rather than dying here, just ignore it. When we no longer mock files like this,
            // we should remove the null check.
            this.dispatchToken = this.dis.register(this.onDispatch.bind(this));
        }
    }

    // The room ID of the room currently being viewed
    public getRoomId(): Optional<string> {
        return this.state.roomId;
    }

    public getThreadId(): Optional<string> {
        return this.state.threadId;
    }

    // The event to scroll to when the room is first viewed
    public getInitialEventId(): Optional<string> {
        return this.state.initialEventId;
    }

    // Whether to highlight the initial event
    public isInitialEventHighlighted(): boolean {
        return this.state.isInitialEventHighlighted;
    }

    // Whether to avoid jumping to the initial event
    public initialEventScrollIntoView(): boolean {
        return this.state.initialEventScrollIntoView;
    }

    // The room alias of the room (or null if not originally specified in view_room)
    public getRoomAlias(): Optional<string> {
        return this.state.roomAlias;
    }

    // Whether the current room is loading (true whilst resolving an alias)
    public isRoomLoading(): boolean {
        return this.state.roomLoading;
    }

    // Any error that has occurred during loading
    public getRoomLoadError(): Optional<MatrixError> {
        return this.state.roomLoadError;
    }

    // True if we're expecting the user to be joined to the room currently being
    // viewed. Note that this is left true after the join request has finished,
    // since we should still consider a join to be in progress until the room
    // & member events come down the sync.
    //
    // This flag remains true after the room has been successfully joined,
    // (this store doesn't listen for the appropriate member events)
    // so you should always observe the joined state from the member event
    // if a room object is present.
    // ie. The correct logic is:
    // if (room) {
    //     if (myMember.membership == 'joined') {
    //         // user is joined to the room
    //     } else {
    //         // Not joined
    //     }
    // } else {
    //     if (this.stores.roomViewStore.isJoining()) {
    //         // show spinner
    //     } else {
    //         // show join prompt
    //     }
    // }
    public isJoining(): boolean {
        return this.state.joining;
    }

    // Any error that has occurred during joining
    public getJoinError(): Optional<Error> {
        return this.state.joinError;
    }

    // The mxEvent if one is currently being replied to/quoted
    public getQuotingEvent(): MatrixEvent | null {
        return this.state.replyingToEvent;
    }

    public shouldPeek(): boolean {
        return this.state.shouldPeek;
    }

    public getWasContextSwitch(): boolean {
        return this.state.wasContextSwitch;
    }

    public isViewingCall(): boolean {
        return this.state.viewingCall;
    }
}
