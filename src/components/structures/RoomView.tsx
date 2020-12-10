/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

// TODO: This component is enormous! There's several things which could stand-alone:
//  - Search results component
//  - Drag and drop

import React, {createRef} from 'react';
import classNames from 'classnames';
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import {EventSubscription} from "fbemitter";

import shouldHideEvent from '../../shouldHideEvent';
import {_t} from '../../languageHandler';
import {RoomPermalinkCreator} from '../../utils/permalinks/Permalinks';
import ResizeNotifier from '../../utils/ResizeNotifier';
import ContentMessages from '../../ContentMessages';
import Modal from '../../Modal';
import * as sdk from '../../index';
import CallHandler from '../../CallHandler';
import dis from '../../dispatcher/dispatcher';
import Tinter from '../../Tinter';
import rateLimitedFunc from '../../ratelimitedfunc';
import * as ObjectUtils from '../../ObjectUtils';
import * as Rooms from '../../Rooms';
import eventSearch, {searchPagination} from '../../Searching';
import {isOnlyCtrlOrCmdIgnoreShiftKeyEvent, Key} from '../../Keyboard';
import MainSplit from './MainSplit';
import RightPanel from './RightPanel';
import RoomViewStore from '../../stores/RoomViewStore';
import RoomScrollStateStore from '../../stores/RoomScrollStateStore';
import WidgetEchoStore from '../../stores/WidgetEchoStore';
import SettingsStore from "../../settings/SettingsStore";
import AccessibleButton from "../views/elements/AccessibleButton";
import RightPanelStore from "../../stores/RightPanelStore";
import {haveTileForEvent} from "../views/rooms/EventTile";
import RoomContext from "../../contexts/RoomContext";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import {E2EStatus, shieldStatusForRoom} from '../../utils/ShieldUtils';
import {Action} from "../../dispatcher/actions";
import {SettingLevel} from "../../settings/SettingLevel";
import {IMatrixClientCreds} from "../../MatrixClientPeg";
import ScrollPanel from "./ScrollPanel";
import TimelinePanel from "./TimelinePanel";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import RoomPreviewBar from "../views/rooms/RoomPreviewBar";
import ForwardMessage from "../views/rooms/ForwardMessage";
import SearchBar from "../views/rooms/SearchBar";
import RoomUpgradeWarningBar from "../views/rooms/RoomUpgradeWarningBar";
import PinnedEventsPanel from "../views/rooms/PinnedEventsPanel";
import AuxPanel from "../views/rooms/AuxPanel";
import RoomHeader from "../views/rooms/RoomHeader";
import {XOR} from "../../@types/common";
import { IThreepidInvite } from "../../stores/ThreepidInviteStore";
import EffectsOverlay from "../views/elements/EffectsOverlay";
import {containsEmoji} from '../../effects/utils';
import {CHAT_EFFECTS} from '../../effects';
import { CallState, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import WidgetStore from "../../stores/WidgetStore";
import {UPDATE_EVENT} from "../../stores/AsyncStore";
import Notifier from "../../Notifier";
import {showToast as showNotificationsToast} from "../../toasts/DesktopNotificationsToast";
import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";

const DEBUG = false;
let debuglog = function(msg: string) {};

const BROWSER_SUPPORTS_SANDBOX = 'sandbox' in document.createElement('iframe');

if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    debuglog = console.log.bind(console);
}

interface IProps {
    threepidInvite: IThreepidInvite,

    // Any data about the room that would normally come from the homeserver
    // but has been passed out-of-band, eg. the room name and avatar URL
    // from an email invite (a workaround for the fact that we can't
    // get this information from the HS using an email invite).
    // Fields:
    //  * name (string) The room's name
    //  * avatarUrl (string) The mxc:// avatar URL for the room
    //  * inviterName (string) The display name of the person who
    //  *                      invited us to the room
    oobData?: {
        name?: string;
        avatarUrl?: string;
        inviterName?: string;
    };

    // Servers the RoomView can use to try and assist joins
    viaServers?: string[];

    autoJoin?: boolean;
    resizeNotifier: ResizeNotifier;

    // Called with the credentials of a registered user (if they were a ROU that transitioned to PWLU)
    onRegistered?(credentials: IMatrixClientCreds): void;
}

export interface IState {
    room?: Room;
    roomId?: string;
    roomAlias?: string;
    roomLoading: boolean;
    peekLoading: boolean;
    shouldPeek: boolean;
    // used to trigger a rerender in TimelinePanel once the members are loaded,
    // so RR are rendered again (now with the members available), ...
    membersLoaded: boolean;
    // The event to be scrolled to initially
    initialEventId?: string;
    // The offset in pixels from the event with which to scroll vertically
    initialEventPixelOffset?: number;
    // Whether to highlight the event scrolled to
    isInitialEventHighlighted?: boolean;
    replyToEvent?: MatrixEvent;
    forwardingEvent?: MatrixEvent;
    numUnreadMessages: number;
    draggingFile: boolean;
    searching: boolean;
    searchTerm?: string;
    searchScope?: "All" | "Room";
    searchResults?: XOR<{}, {
        count: number;
        highlights: string[];
        results: MatrixEvent[];
        next_batch: string; // eslint-disable-line camelcase
    }>;
    searchHighlights?: string[];
    searchInProgress?: boolean;
    callState?: CallState;
    guestsCanJoin: boolean;
    canPeek: boolean;
    showApps: boolean;
    isPeeking: boolean;
    showingPinned: boolean;
    showReadReceipts: boolean;
    showRightPanel: boolean;
    // error object, as from the matrix client/server API
    // If we failed to load information about the room,
    // store the error here.
    roomLoadError?: Error;
    // Have we sent a request to join the room that we're waiting to complete?
    joining: boolean;
    // this is true if we are fully scrolled-down, and are looking at
    // the end of the live timeline. It has the effect of hiding the
    // 'scroll to bottom' knob, among a couple of other things.
    atEndOfLiveTimeline: boolean;
    // used by componentDidUpdate to avoid unnecessary checks
    atEndOfLiveTimelineInit: boolean;
    showTopUnreadMessagesBar: boolean;
    auxPanelMaxHeight?: number;
    statusBarVisible: boolean;
    // We load this later by asking the js-sdk to suggest a version for us.
    // This object is the result of Room#getRecommendedVersion()
    upgradeRecommendation?: {
        version: string;
        needsUpgrade: boolean;
        urgent: boolean;
    };
    canReact: boolean;
    canReply: boolean;
    useIRCLayout: boolean;
    matrixClientIsReady: boolean;
    showUrlPreview?: boolean;
    e2eStatus?: E2EStatus;
    rejecting?: boolean;
    rejectError?: Error;
    hasPinnedWidgets?: boolean;
}

export default class RoomView extends React.Component<IProps, IState> {
    private readonly dispatcherRef: string;
    private readonly roomStoreToken: EventSubscription;
    private readonly rightPanelStoreToken: EventSubscription;
    private readonly showReadReceiptsWatchRef: string;
    private readonly layoutWatcherRef: string;

    private unmounted = false;
    private permalinkCreators: Record<string, RoomPermalinkCreator> = {};
    private searchId: number;

    private roomView = createRef<HTMLElement>();
    private searchResultsPanel = createRef<ScrollPanel>();
    private messagePanel: TimelinePanel;

    static contextType = MatrixClientContext;

    constructor(props, context) {
        super(props, context);

        const llMembers = this.context.hasLazyLoadMembersEnabled();
        this.state = {
            roomId: null,
            roomLoading: true,
            peekLoading: false,
            shouldPeek: true,
            membersLoaded: !llMembers,
            numUnreadMessages: 0,
            draggingFile: false,
            searching: false,
            searchResults: null,
            callState: null,
            guestsCanJoin: false,
            canPeek: false,
            showApps: false,
            isPeeking: false,
            showingPinned: false,
            showReadReceipts: true,
            showRightPanel: RightPanelStore.getSharedInstance().isOpenForRoom,
            joining: false,
            atEndOfLiveTimeline: true,
            atEndOfLiveTimelineInit: false,
            showTopUnreadMessagesBar: false,
            statusBarVisible: false,
            canReact: false,
            canReply: false,
            useIRCLayout: SettingsStore.getValue("useIRCLayout"),
            matrixClientIsReady: this.context && this.context.isInitialSyncComplete(),
        };

        this.dispatcherRef = dis.register(this.onAction);
        this.context.on("Room", this.onRoom);
        this.context.on("Room.timeline", this.onRoomTimeline);
        this.context.on("Room.name", this.onRoomName);
        this.context.on("Room.accountData", this.onRoomAccountData);
        this.context.on("RoomState.events", this.onRoomStateEvents);
        this.context.on("RoomState.members", this.onRoomStateMember);
        this.context.on("Room.myMembership", this.onMyMembership);
        this.context.on("accountData", this.onAccountData);
        this.context.on("crypto.keyBackupStatus", this.onKeyBackupStatus);
        this.context.on("deviceVerificationChanged", this.onDeviceVerificationChanged);
        this.context.on("userTrustStatusChanged", this.onUserVerificationChanged);
        this.context.on("crossSigning.keysChanged", this.onCrossSigningKeysChanged);
        this.context.on("Event.decrypted", this.onEventDecrypted);
        this.context.on("event", this.onEvent);
        // Start listening for RoomViewStore updates
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        this.rightPanelStoreToken = RightPanelStore.getSharedInstance().addListener(this.onRightPanelStoreUpdate);

        WidgetEchoStore.on(UPDATE_EVENT, this.onWidgetEchoStoreUpdate);
        WidgetStore.instance.on(UPDATE_EVENT, this.onWidgetStoreUpdate);

        this.showReadReceiptsWatchRef = SettingsStore.watchSetting("showReadReceipts", null,
            this.onReadReceiptsChange);
        this.layoutWatcherRef = SettingsStore.watchSetting("useIRCLayout", null, this.onLayoutChange);
    }

    // TODO: [REACT-WARNING] Move into constructor
    // eslint-disable-next-line camelcase
    UNSAFE_componentWillMount() {
        this.onRoomViewStoreUpdate(true);
    }

    private onWidgetStoreUpdate = () => {
        if (this.state.room) {
            this.checkWidgets(this.state.room);
        }
    }

    private checkWidgets = (room) => {
        this.setState({
            hasPinnedWidgets: WidgetStore.instance.getPinnedApps(room.roomId).length > 0,
        })
    };

    private onReadReceiptsChange = () => {
        this.setState({
            showReadReceipts: SettingsStore.getValue("showReadReceipts", this.state.roomId),
        });
    };

    private onRoomViewStoreUpdate = (initial?: boolean) => {
        if (this.unmounted) {
            return;
        }

        if (!initial && this.state.roomId !== RoomViewStore.getRoomId()) {
            // RoomView explicitly does not support changing what room
            // is being viewed: instead it should just be re-mounted when
            // switching rooms. Therefore, if the room ID changes, we
            // ignore this. We either need to do this or add code to handle
            // saving the scroll position (otherwise we end up saving the
            // scroll position against the wrong room).

            // Given that doing the setState here would cause a bunch of
            // unnecessary work, we just ignore the change since we know
            // that if the current room ID has changed from what we thought
            // it was, it means we're about to be unmounted.
            return;
        }

        const roomId = RoomViewStore.getRoomId();

        const newState: Pick<IState, any> = {
            roomId,
            roomAlias: RoomViewStore.getRoomAlias(),
            roomLoading: RoomViewStore.isRoomLoading(),
            roomLoadError: RoomViewStore.getRoomLoadError(),
            joining: RoomViewStore.isJoining(),
            initialEventId: RoomViewStore.getInitialEventId(),
            isInitialEventHighlighted: RoomViewStore.isInitialEventHighlighted(),
            replyToEvent: RoomViewStore.getQuotingEvent(),
            forwardingEvent: RoomViewStore.getForwardingEvent(),
            // we should only peek once we have a ready client
            shouldPeek: this.state.matrixClientIsReady && RoomViewStore.shouldPeek(),
            showingPinned: SettingsStore.getValue("PinnedEvents.isOpen", roomId),
            showReadReceipts: SettingsStore.getValue("showReadReceipts", roomId),
        };

        if (!initial && this.state.shouldPeek && !newState.shouldPeek) {
            // Stop peeking because we have joined this room now
            this.context.stopPeeking();
        }

        // Temporary logging to diagnose https://github.com/vector-im/element-web/issues/4307
        console.log(
            'RVS update:',
            newState.roomId,
            newState.roomAlias,
            'loading?', newState.roomLoading,
            'joining?', newState.joining,
            'initial?', initial,
            'shouldPeek?', newState.shouldPeek,
        );

        // NB: This does assume that the roomID will not change for the lifetime of
        // the RoomView instance
        if (initial) {
            newState.room = this.context.getRoom(newState.roomId);
            if (newState.room) {
                newState.showApps = this.shouldShowApps(newState.room);
                this.onRoomLoaded(newState.room);
            }
        }

        if (this.state.roomId === null && newState.roomId !== null) {
            // Get the scroll state for the new room

            // If an event ID wasn't specified, default to the one saved for this room
            // in the scroll state store. Assume initialEventPixelOffset should be set.
            if (!newState.initialEventId) {
                const roomScrollState = RoomScrollStateStore.getScrollState(newState.roomId);
                if (roomScrollState) {
                    newState.initialEventId = roomScrollState.focussedEvent;
                    newState.initialEventPixelOffset = roomScrollState.pixelOffset;
                }
            }
        }

        // Clear the search results when clicking a search result (which changes the
        // currently scrolled to event, this.state.initialEventId).
        if (this.state.initialEventId !== newState.initialEventId) {
            newState.searchResults = null;
        }

        this.setState(newState);
        // At this point, newState.roomId could be null (e.g. the alias might not
        // have been resolved yet) so anything called here must handle this case.

        // We pass the new state into this function for it to read: it needs to
        // observe the new state but we don't want to put it in the setState
        // callback because this would prevent the setStates from being batched,
        // ie. cause it to render RoomView twice rather than the once that is necessary.
        if (initial) {
            this.setupRoom(newState.room, newState.roomId, newState.joining, newState.shouldPeek);
        }
    };

    private getRoomId = () => {
        // According to `onRoomViewStoreUpdate`, `state.roomId` can be null
        // if we have a room alias we haven't resolved yet. To work around this,
        // first we'll try the room object if it's there, and then fallback to
        // the bare room ID. (We may want to update `state.roomId` after
        // resolving aliases, so we could always trust it.)
        return this.state.room ? this.state.room.roomId : this.state.roomId;
    };

    private getPermalinkCreatorForRoom(room: Room) {
        if (this.permalinkCreators[room.roomId]) return this.permalinkCreators[room.roomId];

        this.permalinkCreators[room.roomId] = new RoomPermalinkCreator(room);
        if (this.state.room && room.roomId === this.state.room.roomId) {
            // We want to watch for changes in the creator for the primary room in the view, but
            // don't need to do so for search results.
            this.permalinkCreators[room.roomId].start();
        } else {
            this.permalinkCreators[room.roomId].load();
        }
        return this.permalinkCreators[room.roomId];
    }

    private stopAllPermalinkCreators() {
        if (!this.permalinkCreators) return;
        for (const roomId of Object.keys(this.permalinkCreators)) {
            this.permalinkCreators[roomId].stop();
        }
    }

    private onWidgetEchoStoreUpdate = () => {
        this.setState({
            showApps: this.shouldShowApps(this.state.room),
        });
    };

    private setupRoom(room: Room, roomId: string, joining: boolean, shouldPeek: boolean) {
        // if this is an unknown room then we're in one of three states:
        // - This is a room we can peek into (search engine) (we can /peek)
        // - This is a room we can publicly join or were invited to. (we can /join)
        // - This is a room we cannot join at all. (no action can help us)
        // We can't try to /join because this may implicitly accept invites (!)
        // We can /peek though. If it fails then we present the join UI. If it
        // succeeds then great, show the preview (but we still may be able to /join!).
        // Note that peeking works by room ID and room ID only, as opposed to joining
        // which must be by alias or invite wherever possible (peeking currently does
        // not work over federation).

        // NB. We peek if we have never seen the room before (i.e. js-sdk does not know
        // about it). We don't peek in the historical case where we were joined but are
        // now not joined because the js-sdk peeking API will clobber our historical room,
        // making it impossible to indicate a newly joined room.
        if (!joining && roomId) {
            if (this.props.autoJoin) {
                this.onJoinButtonClicked();
            } else if (!room && shouldPeek) {
                console.info("Attempting to peek into room %s", roomId);
                this.setState({
                    peekLoading: true,
                    isPeeking: true, // this will change to false if peeking fails
                });
                this.context.peekInRoom(roomId).then((room) => {
                    if (this.unmounted) {
                        return;
                    }
                    this.setState({
                        room: room,
                        peekLoading: false,
                    });
                    this.onRoomLoaded(room);
                }).catch((err) => {
                    if (this.unmounted) {
                        return;
                    }

                    // Stop peeking if anything went wrong
                    this.setState({
                        isPeeking: false,
                    });

                    // This won't necessarily be a MatrixError, but we duck-type
                    // here and say if it's got an 'errcode' key with the right value,
                    // it means we can't peek.
                    if (err.errcode === "M_GUEST_ACCESS_FORBIDDEN" || err.errcode === 'M_FORBIDDEN') {
                        // This is fine: the room just isn't peekable (we assume).
                        this.setState({
                            peekLoading: false,
                        });
                    } else {
                        throw err;
                    }
                });
            } else if (room) {
                // Stop peeking because we have joined this room previously
                this.context.stopPeeking();
                this.setState({isPeeking: false});
            }
        }
    }

    private shouldShowApps(room: Room) {
        if (!BROWSER_SUPPORTS_SANDBOX) return false;

        // Check if user has previously chosen to hide the app drawer for this
        // room. If so, do not show apps
        const hideWidgetDrawer = localStorage.getItem(
            room.roomId + "_hide_widget_drawer");

        // This is confusing, but it means to say that we default to the tray being
        // hidden unless the user clicked to open it.
        return hideWidgetDrawer === "false";
    }

    componentDidMount() {
        const call = this.getCallForRoom();
        const callState = call ? call.state : null;
        this.setState({
            callState: callState,
        });

        window.addEventListener('beforeunload', this.onPageUnload);
        if (this.props.resizeNotifier) {
            this.props.resizeNotifier.on("middlePanelResized", this.onResize);
        }
        this.onResize();
    }

    shouldComponentUpdate(nextProps, nextState) {
        return (!ObjectUtils.shallowEqual(this.props, nextProps) ||
                !ObjectUtils.shallowEqual(this.state, nextState));
    }

    componentDidUpdate() {
        if (this.roomView.current) {
            const roomView = this.roomView.current;
            if (!roomView.ondrop) {
                roomView.addEventListener('drop', this.onDrop);
                roomView.addEventListener('dragover', this.onDragOver);
                roomView.addEventListener('dragleave', this.onDragLeaveOrEnd);
                roomView.addEventListener('dragend', this.onDragLeaveOrEnd);
            }
        }

        // Note: We check the ref here with a flag because componentDidMount, despite
        // documentation, does not define our messagePanel ref. It looks like our spinner
        // in render() prevents the ref from being set on first mount, so we try and
        // catch the messagePanel when it does mount. Because we only want the ref once,
        // we use a boolean flag to avoid duplicate work.
        if (this.messagePanel && !this.state.atEndOfLiveTimelineInit) {
            this.setState({
                atEndOfLiveTimelineInit: true,
                atEndOfLiveTimeline: this.messagePanel.isAtEndOfLiveTimeline(),
            });
        }
    }

    componentWillUnmount() {
        // set a boolean to say we've been unmounted, which any pending
        // promises can use to throw away their results.
        //
        // (We could use isMounted, but facebook have deprecated that.)
        this.unmounted = true;

        // update the scroll map before we get unmounted
        if (this.state.roomId) {
            RoomScrollStateStore.setScrollState(this.state.roomId, this.getScrollState());
        }

        if (this.state.shouldPeek) {
            this.context.stopPeeking();
        }

        // stop tracking room changes to format permalinks
        this.stopAllPermalinkCreators();

        if (this.roomView.current) {
            // disconnect the D&D event listeners from the room view. This
            // is really just for hygiene - we're going to be
            // deleted anyway, so it doesn't matter if the event listeners
            // don't get cleaned up.
            const roomView = this.roomView.current;
            roomView.removeEventListener('drop', this.onDrop);
            roomView.removeEventListener('dragover', this.onDragOver);
            roomView.removeEventListener('dragleave', this.onDragLeaveOrEnd);
            roomView.removeEventListener('dragend', this.onDragLeaveOrEnd);
        }
        dis.unregister(this.dispatcherRef);
        if (this.context) {
            this.context.removeListener("Room", this.onRoom);
            this.context.removeListener("Room.timeline", this.onRoomTimeline);
            this.context.removeListener("Room.name", this.onRoomName);
            this.context.removeListener("Room.accountData", this.onRoomAccountData);
            this.context.removeListener("RoomState.events", this.onRoomStateEvents);
            this.context.removeListener("Room.myMembership", this.onMyMembership);
            this.context.removeListener("RoomState.members", this.onRoomStateMember);
            this.context.removeListener("accountData", this.onAccountData);
            this.context.removeListener("crypto.keyBackupStatus", this.onKeyBackupStatus);
            this.context.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
            this.context.removeListener("userTrustStatusChanged", this.onUserVerificationChanged);
            this.context.removeListener("crossSigning.keysChanged", this.onCrossSigningKeysChanged);
            this.context.removeListener("Event.decrypted", this.onEventDecrypted);
            this.context.removeListener("event", this.onEvent);
        }

        window.removeEventListener('beforeunload', this.onPageUnload);
        if (this.props.resizeNotifier) {
            this.props.resizeNotifier.removeListener("middlePanelResized", this.onResize);
        }

        // Remove RoomStore listener
        if (this.roomStoreToken) {
            this.roomStoreToken.remove();
        }
        // Remove RightPanelStore listener
        if (this.rightPanelStoreToken) {
            this.rightPanelStoreToken.remove();
        }

        WidgetEchoStore.removeListener(UPDATE_EVENT, this.onWidgetEchoStoreUpdate);
        WidgetStore.instance.removeListener(UPDATE_EVENT, this.onWidgetStoreUpdate);

        if (this.showReadReceiptsWatchRef) {
            SettingsStore.unwatchSetting(this.showReadReceiptsWatchRef);
        }

        // cancel any pending calls to the rate_limited_funcs
        this.updateRoomMembers.cancelPendingCall();

        // no need to do this as Dir & Settings are now overlays. It just burnt CPU.
        // console.log("Tinter.tint from RoomView.unmount");
        // Tinter.tint(); // reset colourscheme

        SettingsStore.unwatchSetting(this.layoutWatcherRef);
    }

    private onLayoutChange = () => {
        this.setState({
            useIRCLayout: SettingsStore.getValue("useIRCLayout"),
        });
    };

    private onRightPanelStoreUpdate = () => {
        this.setState({
            showRightPanel: RightPanelStore.getSharedInstance().isOpenForRoom,
        });
    };

    private onPageUnload = event => {
        if (ContentMessages.sharedInstance().getCurrentUploads().length > 0) {
            return event.returnValue =
                _t("You seem to be uploading files, are you sure you want to quit?");
        } else if (this.getCallForRoom() && this.state.callState !== 'ended') {
            return event.returnValue =
                _t("You seem to be in a call, are you sure you want to quit?");
        }
    };

    private onReactKeyDown = ev => {
        let handled = false;

        switch (ev.key) {
            case Key.ESCAPE:
                if (!ev.altKey && !ev.ctrlKey && !ev.shiftKey && !ev.metaKey) {
                    this.messagePanel.forgetReadMarker();
                    this.jumpToLiveTimeline();
                    handled = true;
                }
                break;
            case Key.PAGE_UP:
                if (!ev.altKey && !ev.ctrlKey && ev.shiftKey && !ev.metaKey) {
                    this.jumpToReadMarker();
                    handled = true;
                }
                break;
            case Key.U: // Mac returns lowercase
            case Key.U.toUpperCase():
                if (isOnlyCtrlOrCmdIgnoreShiftKeyEvent(ev) && ev.shiftKey) {
                    dis.dispatch({ action: "upload_file" }, true);
                    handled = true;
                }
                break;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    };

    private onAction = payload => {
        switch (payload.action) {
            case 'message_sent':
                this.checkDesktopNotifications();
                break;
            case 'post_sticker_message':
                this.injectSticker(
                    payload.data.content.url,
                    payload.data.content.info,
                    payload.data.description || payload.data.name);
                break;
            case 'picture_snapshot':
                ContentMessages.sharedInstance().sendContentListToRoom(
                    [payload.file], this.state.room.roomId, this.context);
                break;
            case 'notifier_enabled':
            case 'upload_started':
            case 'upload_finished':
            case 'upload_canceled':
                this.forceUpdate();
                break;
            case 'call_state': {
                // don't filter out payloads for room IDs other than props.room because
                // we may be interested in the conf 1:1 room

                if (!payload.room_id) {
                    return;
                }

                const call = this.getCallForRoom();

                this.setState({
                    callState: call ? call.state : null,
                });
                break;
            }
            case 'appsDrawer':
                this.setState({
                    showApps: payload.show,
                });
                break;
            case 'reply_to_event':
                if (this.state.searchResults && payload.event.getRoomId() === this.state.roomId && !this.unmounted) {
                    this.onCancelSearchClick();
                }
                break;
            case 'quote':
                if (this.state.searchResults) {
                    const roomId = payload.event.getRoomId();
                    if (roomId === this.state.roomId) {
                        this.onCancelSearchClick();
                    }

                    setImmediate(() => {
                        dis.dispatch({
                            action: 'view_room',
                            room_id: roomId,
                            deferred_action: payload,
                        });
                    });
                }
                break;
            case 'sync_state':
                if (!this.state.matrixClientIsReady) {
                    this.setState({
                        matrixClientIsReady: this.context && this.context.isInitialSyncComplete(),
                    }, () => {
                        // send another "initial" RVS update to trigger peeking if needed
                        this.onRoomViewStoreUpdate(true);
                    });
                }
                break;
        }
    };

    private onRoomTimeline = (ev: MatrixEvent, room: Room, toStartOfTimeline: boolean, removed, data) => {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (!room) return;
        if (!this.state.room || room.roomId != this.state.room.roomId) return;

        // ignore events from filtered timelines
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;

        if (ev.getType() === "org.matrix.room.preview_urls") {
            this.updatePreviewUrlVisibility(room);
        }

        if (ev.getType() === "m.room.encryption") {
            this.updateE2EStatus(room);
        }

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        // no point handling anything while we're waiting for the join to finish:
        // we'll only be showing a spinner.
        if (this.state.joining) return;

        if (ev.getSender() !== this.context.credentials.userId) {
            // update unread count when scrolled up
            if (!this.state.searchResults && this.state.atEndOfLiveTimeline) {
                // no change
            } else if (!shouldHideEvent(ev)) {
                this.setState((state, props) => {
                    return {numUnreadMessages: state.numUnreadMessages + 1};
                });
            }
        }
    };

    private onEventDecrypted = (ev) => {
        if (ev.isDecryptionFailure()) return;
        this.handleEffects(ev);
    };

    private onEvent = (ev) => {
        if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) return;
        this.handleEffects(ev);
    };

    private handleEffects = (ev) => {
        if (!this.state.room || !this.state.matrixClientIsReady) return; // not ready at all
        if (ev.getRoomId() !== this.state.room.roomId) return; // not for us

        const notifState = RoomNotificationStateStore.instance.getRoomState(this.state.room);
        if (!notifState.isUnread) return;

        CHAT_EFFECTS.forEach(effect => {
            if (containsEmoji(ev.getContent(), effect.emojis) || ev.getContent().msgtype === effect.msgType) {
                dis.dispatch({action: `effects.${effect.command}`});
            }
        });
    };

    private onRoomName = (room: Room) => {
        if (this.state.room && room.roomId == this.state.room.roomId) {
            this.forceUpdate();
        }
    };

    private onKeyBackupStatus = () => {
        // Key backup status changes affect whether the in-room recovery
        // reminder is displayed.
        this.forceUpdate();
    };

    public canResetTimeline = () => {
        if (!this.messagePanel) {
            return true;
        }
        return this.messagePanel.canResetTimeline();
    };

    // called when state.room is first initialised (either at initial load,
    // after a successful peek, or after we join the room).
    private onRoomLoaded = (room: Room) => {
        this.calculatePeekRules(room);
        this.updatePreviewUrlVisibility(room);
        this.loadMembersIfJoined(room);
        this.calculateRecommendedVersion(room);
        this.updateE2EStatus(room);
        this.updatePermissions(room);
        this.checkWidgets(room);
    };

    private async calculateRecommendedVersion(room: Room) {
        this.setState({
            upgradeRecommendation: await room.getRecommendedVersion(),
        });
    }

    private async loadMembersIfJoined(room: Room) {
        // lazy load members if enabled
        if (this.context.hasLazyLoadMembersEnabled()) {
            if (room && room.getMyMembership() === 'join') {
                try {
                    await room.loadMembersIfNeeded();
                    if (!this.unmounted) {
                        this.setState({membersLoaded: true});
                    }
                } catch (err) {
                    const errorMessage = `Fetching room members for ${room.roomId} failed.` +
                        " Room members will appear incomplete.";
                    console.error(errorMessage);
                    console.error(err);
                }
            }
        }
    }

    private calculatePeekRules(room: Room) {
        const guestAccessEvent = room.currentState.getStateEvents("m.room.guest_access", "");
        if (guestAccessEvent && guestAccessEvent.getContent().guest_access === "can_join") {
            this.setState({
                guestsCanJoin: true,
            });
        }

        const historyVisibility = room.currentState.getStateEvents("m.room.history_visibility", "");
        if (historyVisibility && historyVisibility.getContent().history_visibility === "world_readable") {
            this.setState({
                canPeek: true,
            });
        }
    }

    private updatePreviewUrlVisibility({roomId}: Room) {
        // URL Previews in E2EE rooms can be a privacy leak so use a different setting which is per-room explicit
        const key = this.context.isRoomEncrypted(roomId) ? 'urlPreviewsEnabled_e2ee' : 'urlPreviewsEnabled';
        this.setState({
            showUrlPreview: SettingsStore.getValue(key, roomId),
        });
    }

    private onRoom = (room: Room) => {
        if (!room || room.roomId !== this.state.roomId) {
            return;
        }
        this.setState({
            room: room,
        }, () => {
            this.onRoomLoaded(room);
        });
    };

    private onDeviceVerificationChanged = (userId: string, device: object) => {
        const room = this.state.room;
        if (!room.currentState.getMember(userId)) {
            return;
        }
        this.updateE2EStatus(room);
    };

    private onUserVerificationChanged = (userId: string, trustStatus: object) => {
        const room = this.state.room;
        if (!room || !room.currentState.getMember(userId)) {
            return;
        }
        this.updateE2EStatus(room);
    };

    private onCrossSigningKeysChanged = () => {
        const room = this.state.room;
        if (room) {
            this.updateE2EStatus(room);
        }
    };

    private async updateE2EStatus(room: Room) {
        if (!this.context.isRoomEncrypted(room.roomId)) {
            return;
        }
        if (!this.context.isCryptoEnabled()) {
            // If crypto is not currently enabled, we aren't tracking devices at all,
            // so we don't know what the answer is. Let's error on the safe side and show
            // a warning for this case.
            this.setState({
                e2eStatus: E2EStatus.Warning,
            });
            return;
        }

        /* At this point, the user has encryption on and cross-signing on */
        this.setState({
            e2eStatus: await shieldStatusForRoom(this.context, room),
        });
    }

    private updateTint() {
        const room = this.state.room;
        if (!room) return;

        console.log("Tinter.tint from updateTint");
        const colorScheme = SettingsStore.getValue("roomColor", room.roomId);
        Tinter.tint(colorScheme.primary_color, colorScheme.secondary_color);
    }

    private onAccountData = (event: MatrixEvent) => {
        const type = event.getType();
        if ((type === "org.matrix.preview_urls" || type === "im.vector.web.settings") && this.state.room) {
            // non-e2ee url previews are stored in legacy event type `org.matrix.room.preview_urls`
            this.updatePreviewUrlVisibility(this.state.room);
        }
    };

    private onRoomAccountData = (event: MatrixEvent, room: Room) => {
        if (room.roomId == this.state.roomId) {
            const type = event.getType();
            if (type === "org.matrix.room.color_scheme") {
                const colorScheme = event.getContent();
                // XXX: we should validate the event
                console.log("Tinter.tint from onRoomAccountData");
                Tinter.tint(colorScheme.primary_color, colorScheme.secondary_color);
            } else if (type === "org.matrix.room.preview_urls" || type === "im.vector.web.settings") {
                // non-e2ee url previews are stored in legacy event type `org.matrix.room.preview_urls`
                this.updatePreviewUrlVisibility(room);
            }
        }
    };

    private onRoomStateEvents = (ev: MatrixEvent, state) => {
        // ignore if we don't have a room yet
        if (!this.state.room || this.state.room.roomId !== state.roomId) {
            return;
        }

        this.updatePermissions(this.state.room);
    };

    private onRoomStateMember = (ev: MatrixEvent, state, member) => {
        // ignore if we don't have a room yet
        if (!this.state.room) {
            return;
        }

        // ignore members in other rooms
        if (member.roomId !== this.state.room.roomId) {
            return;
        }

        this.updateRoomMembers(member);
    };

    private onMyMembership = (room: Room, membership: string, oldMembership: string) => {
        if (room.roomId === this.state.roomId) {
            this.forceUpdate();
            this.loadMembersIfJoined(room);
            this.updatePermissions(room);
        }
    };

    private updatePermissions(room: Room) {
        if (room) {
            const me = this.context.getUserId();
            const canReact = room.getMyMembership() === "join" && room.currentState.maySendEvent("m.reaction", me);
            const canReply = room.maySendMessage();

            this.setState({canReact, canReply});
        }
    }

    // rate limited because a power level change will emit an event for every member in the room.
    private updateRoomMembers = rateLimitedFunc(() => {
        this.updateDMState();
        this.updateE2EStatus(this.state.room);
    }, 500);

    private checkDesktopNotifications() {
        const memberCount = this.state.room.getJoinedMemberCount() + this.state.room.getInvitedMemberCount();
        // if they are not alone prompt the user about notifications so they don't miss replies
        if (memberCount > 1 && Notifier.shouldShowPrompt()) {
            showNotificationsToast(true);
        }
    }

    private updateDMState() {
        const room = this.state.room;
        if (room.getMyMembership() != "join") {
            return;
        }
        const dmInviter = room.getDMInviter();
        if (dmInviter) {
            Rooms.setDMRoom(room.roomId, dmInviter);
        }
    }

    private onSearchResultsFillRequest = (backwards: boolean) => {
        if (!backwards) {
            return Promise.resolve(false);
        }

        if (this.state.searchResults.next_batch) {
            debuglog("requesting more search results");
            const searchPromise = searchPagination(this.state.searchResults);
            return this.handleSearchResult(searchPromise);
        } else {
            debuglog("no more search results");
            return Promise.resolve(false);
        }
    };

    private onInviteButtonClick = () => {
        // call AddressPickerDialog
        dis.dispatch({
            action: 'view_invite',
            roomId: this.state.room.roomId,
        });
    };

    private onJoinButtonClicked = () => {
        // If the user is a ROU, allow them to transition to a PWLU
        if (this.context && this.context.isGuest()) {
            // Join this room once the user has registered and logged in
            // (If we failed to peek, we may not have a valid room object.)
            dis.dispatch({
                action: 'do_after_sync_prepared',
                deferred_action: {
                    action: 'view_room',
                    room_id: this.getRoomId(),
                },
            });
            dis.dispatch({action: 'require_registration'});
        } else {
            Promise.resolve().then(() => {
                const signUrl = this.props.threepidInvite?.signUrl;
                dis.dispatch({
                    action: 'join_room',
                    opts: { inviteSignUrl: signUrl, viaServers: this.props.viaServers },
                    _type: "unknown", // TODO: instrumentation
                });
                return Promise.resolve();
            });
        }
    };

    private onMessageListScroll = ev => {
        if (this.messagePanel.isAtEndOfLiveTimeline()) {
            this.setState({
                numUnreadMessages: 0,
                atEndOfLiveTimeline: true,
            });
        } else {
            this.setState({
                atEndOfLiveTimeline: false,
            });
        }
        this.updateTopUnreadMessagesBar();
    };

    private onDragOver = ev => {
        ev.stopPropagation();
        ev.preventDefault();

        ev.dataTransfer.dropEffect = 'none';

        if (ev.dataTransfer.types.includes("Files") || ev.dataTransfer.types.includes("application/x-moz-file")) {
            this.setState({ draggingFile: true });
            ev.dataTransfer.dropEffect = 'copy';
        }
    };

    private onDrop = ev => {
        ev.stopPropagation();
        ev.preventDefault();
        ContentMessages.sharedInstance().sendContentListToRoom(
            ev.dataTransfer.files, this.state.room.roomId, this.context,
        );
        this.setState({ draggingFile: false });
        dis.fire(Action.FocusComposer);
    };

    private onDragLeaveOrEnd = ev => {
        ev.stopPropagation();
        ev.preventDefault();
        this.setState({ draggingFile: false });
    };

    private injectSticker(url, info, text) {
        if (this.context.isGuest()) {
            dis.dispatch({action: 'require_registration'});
            return;
        }

        ContentMessages.sharedInstance().sendStickerContentToRoom(url, this.state.room.roomId, info, text, this.context)
            .then(undefined, (error) => {
                if (error.name === "UnknownDeviceError") {
                    // Let the staus bar handle this
                    return;
                }
            });
    }

    private onSearch = (term: string, scope) => {
        this.setState({
            searchTerm: term,
            searchScope: scope,
            searchResults: {},
            searchHighlights: [],
        });

        // if we already have a search panel, we need to tell it to forget
        // about its scroll state.
        if (this.searchResultsPanel.current) {
            this.searchResultsPanel.current.resetScrollState();
        }

        // make sure that we don't end up showing results from
        // an aborted search by keeping a unique id.
        //
        // todo: should cancel any previous search requests.
        this.searchId = new Date().getTime();

        let roomId;
        if (scope === "Room") roomId = this.state.room.roomId;

        debuglog("sending search request");
        const searchPromise = eventSearch(term, roomId);
        this.handleSearchResult(searchPromise);
    };

    private handleSearchResult(searchPromise: Promise<any>) {
        // keep a record of the current search id, so that if the search terms
        // change before we get a response, we can ignore the results.
        const localSearchId = this.searchId;

        this.setState({
            searchInProgress: true,
        });

        return searchPromise.then((results) => {
            debuglog("search complete");
            if (this.unmounted || !this.state.searching || this.searchId != localSearchId) {
                console.error("Discarding stale search results");
                return;
            }

            // postgres on synapse returns us precise details of the strings
            // which actually got matched for highlighting.
            //
            // In either case, we want to highlight the literal search term
            // whether it was used by the search engine or not.

            let highlights = results.highlights;
            if (highlights.indexOf(this.state.searchTerm) < 0) {
                highlights = highlights.concat(this.state.searchTerm);
            }

            // For overlapping highlights,
            // favour longer (more specific) terms first
            highlights = highlights.sort(function(a, b) {
                return b.length - a.length;
            });

            this.setState({
                searchHighlights: highlights,
                searchResults: results,
            });
        }, (error) => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Search failed", error);
            Modal.createTrackedDialog('Search failed', '', ErrorDialog, {
                title: _t("Search failed"),
                description: ((error && error.message) ? error.message :
                    _t("Server may be unavailable, overloaded, or search timed out :(")),
            });
        }).finally(() => {
            this.setState({
                searchInProgress: false,
            });
        });
    }

    private getSearchResultTiles() {
        const SearchResultTile = sdk.getComponent('rooms.SearchResultTile');
        const Spinner = sdk.getComponent("elements.Spinner");

        // XXX: todo: merge overlapping results somehow?
        // XXX: why doesn't searching on name work?

        const ret = [];

        if (this.state.searchInProgress) {
            ret.push(<li key="search-spinner">
                <Spinner />
            </li>);
        }

        if (!this.state.searchResults.next_batch) {
            if (!this.state.searchResults?.results?.length) {
                ret.push(<li key="search-top-marker">
                    <h2 className="mx_RoomView_topMarker">{ _t("No results") }</h2>
                </li>,
                );
            } else {
                ret.push(<li key="search-top-marker">
                    <h2 className="mx_RoomView_topMarker">{ _t("No more results") }</h2>
                </li>,
                );
            }
        }

        // once dynamic content in the search results load, make the scrollPanel check
        // the scroll offsets.
        const onHeightChanged = () => {
            const scrollPanel = this.searchResultsPanel.current;
            if (scrollPanel) {
                scrollPanel.checkScroll();
            }
        };

        let lastRoomId;

        for (let i = (this.state.searchResults?.results?.length || 0) - 1; i >= 0; i--) {
            const result = this.state.searchResults.results[i];

            const mxEv = result.context.getEvent();
            const roomId = mxEv.getRoomId();
            const room = this.context.getRoom(roomId);
            if (!room) {
                // if we do not have the room in js-sdk stores then hide it as we cannot easily show it
                // As per the spec, an all rooms search can create this condition,
                // it happens with Seshat but not Synapse.
                // It will make the result count not match the displayed count.
                console.log("Hiding search result from an unknown room", roomId);
                continue;
            }

            if (!haveTileForEvent(mxEv)) {
                // XXX: can this ever happen? It will make the result count
                // not match the displayed count.
                continue;
            }

            if (this.state.searchScope === 'All') {
                if (roomId !== lastRoomId) {
                    ret.push(<li key={mxEv.getId() + "-room"}>
                        <h2>{ _t("Room") }: { room.name }</h2>
                    </li>);
                    lastRoomId = roomId;
                }
            }

            const resultLink = "#/room/"+roomId+"/"+mxEv.getId();

            ret.push(<SearchResultTile
                key={mxEv.getId()}
                searchResult={result}
                searchHighlights={this.state.searchHighlights}
                resultLink={resultLink}
                permalinkCreator={this.getPermalinkCreatorForRoom(room)}
                onHeightChanged={onHeightChanged}
            />);
        }
        return ret;
    }

    private onPinnedClick = () => {
        const nowShowingPinned = !this.state.showingPinned;
        const roomId = this.state.room.roomId;
        this.setState({showingPinned: nowShowingPinned, searching: false});
        SettingsStore.setValue("PinnedEvents.isOpen", roomId, SettingLevel.ROOM_DEVICE, nowShowingPinned);
    };

    private onSettingsClick = () => {
        dis.dispatch({ action: "open_room_settings" });
    };

    private onCancelClick = () => {
        console.log("updateTint from onCancelClick");
        this.updateTint();
        if (this.state.forwardingEvent) {
            dis.dispatch({
                action: 'forward_event',
                event: null,
            });
        }
        dis.fire(Action.FocusComposer);
    };

    private onAppsClick = () => {
        dis.dispatch({
            action: "appsDrawer",
            show: !this.state.showApps,
        });
    };

    private onLeaveClick = () => {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.state.room.roomId,
        });
    };

    private onForgetClick = () => {
        dis.dispatch({
            action: 'forget_room',
            room_id: this.state.room.roomId,
        });
    };

    private onRejectButtonClicked = ev => {
        this.setState({
            rejecting: true,
        });
        this.context.leave(this.state.roomId).then(() => {
            dis.dispatch({ action: 'view_home_page' });
            this.setState({
                rejecting: false,
            });
        }, (error) => {
            console.error("Failed to reject invite: %s", error);

            const msg = error.message ? error.message : JSON.stringify(error);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to reject invite', '', ErrorDialog, {
                title: _t("Failed to reject invite"),
                description: msg,
            });

            this.setState({
                rejecting: false,
                rejectError: error,
            });
        });
    };

    private onRejectAndIgnoreClick = async () => {
        this.setState({
            rejecting: true,
        });

        try {
            const myMember = this.state.room.getMember(this.context.getUserId());
            const inviteEvent = myMember.events.member;
            const ignoredUsers = this.context.getIgnoredUsers();
            ignoredUsers.push(inviteEvent.getSender()); // de-duped internally in the js-sdk
            await this.context.setIgnoredUsers(ignoredUsers);

            await this.context.leave(this.state.roomId);
            dis.dispatch({ action: 'view_home_page' });
            this.setState({
                rejecting: false,
            });
        } catch (error) {
            console.error("Failed to reject invite: %s", error);

            const msg = error.message ? error.message : JSON.stringify(error);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to reject invite', '', ErrorDialog, {
                title: _t("Failed to reject invite"),
                description: msg,
            });

            this.setState({
                rejecting: false,
                rejectError: error,
            });
        }
    };

    private onRejectThreepidInviteButtonClicked = ev => {
        // We can reject 3pid invites in the same way that we accept them,
        // using /leave rather than /join. In the short term though, we
        // just ignore them.
        // https://github.com/vector-im/vector-web/issues/1134
        dis.fire(Action.ViewRoomDirectory);
    };

    private onSearchClick = () => {
        this.setState({
            searching: !this.state.searching,
            showingPinned: false,
        });
    };

    private onCancelSearchClick = () => {
        this.setState({
            searching: false,
            searchResults: null,
        });
    };

    // jump down to the bottom of this room, where new events are arriving
    private jumpToLiveTimeline = () => {
        this.messagePanel.jumpToLiveTimeline();
        dis.fire(Action.FocusComposer);
    };

    // jump up to wherever our read marker is
    private jumpToReadMarker = () => {
        this.messagePanel.jumpToReadMarker();
    };

    // update the read marker to match the read-receipt
    private forgetReadMarker = ev => {
        ev.stopPropagation();
        this.messagePanel.forgetReadMarker();
    };

    // decide whether or not the top 'unread messages' bar should be shown
    private updateTopUnreadMessagesBar = () => {
        if (!this.messagePanel) {
            return;
        }

        const showBar = this.messagePanel.canJumpToReadMarker();
        if (this.state.showTopUnreadMessagesBar != showBar) {
            this.setState({showTopUnreadMessagesBar: showBar});
        }
    };

    // get the current scroll position of the room, so that it can be
    // restored when we switch back to it.
    //
    private getScrollState() {
        const messagePanel = this.messagePanel;
        if (!messagePanel) return null;

        // if we're following the live timeline, we want to return null; that
        // means that, if we switch back, we will jump to the read-up-to mark.
        //
        // That should be more intuitive than slavishly preserving the current
        // scroll state, in the case where the room advances in the meantime
        // (particularly in the case that the user reads some stuff on another
        // device).
        //
        if (this.state.atEndOfLiveTimeline) {
            return null;
        }

        const scrollState = messagePanel.getScrollState();

        // getScrollState on TimelinePanel *may* return null, so guard against that
        if (!scrollState || scrollState.stuckAtBottom) {
            // we don't really expect to be in this state, but it will
            // occasionally happen when no scroll state has been set on the
            // messagePanel (ie, we didn't have an initial event (so it's
            // probably a new room), there has been no user-initiated scroll, and
            // no read-receipts have arrived to update the scroll position).
            //
            // Return null, which will cause us to scroll to last unread on
            // reload.
            return null;
        }

        return {
            focussedEvent: scrollState.trackedScrollToken,
            pixelOffset: scrollState.pixelOffset,
        };
    }

    private onResize = () => {
        // It seems flexbox doesn't give us a way to constrain the auxPanel height to have
        // a minimum of the height of the video element, whilst also capping it from pushing out the page
        // so we have to do it via JS instead.  In this implementation we cap the height by putting
        // a maxHeight on the underlying remote video tag.

        // header + footer + status + give us at least 120px of scrollback at all times.
        let auxPanelMaxHeight = window.innerHeight -
                (54 + // height of RoomHeader
                 36 + // height of the status area
                 51 + // minimum height of the message compmoser
                 120); // amount of desired scrollback

        // XXX: this is a bit of a hack and might possibly cause the video to push out the page anyway
        // but it's better than the video going missing entirely
        if (auxPanelMaxHeight < 50) auxPanelMaxHeight = 50;

        this.setState({auxPanelMaxHeight: auxPanelMaxHeight});
    };

    private onFullscreenClick = () => {
        dis.dispatch({
            action: 'video_fullscreen',
            fullscreen: true,
        }, true);
    };

    private onMuteAudioClick = () => {
        const call = this.getCallForRoom();
        if (!call) {
            return;
        }
        const newState = !call.isMicrophoneMuted();
        call.setMicrophoneMuted(newState);
        this.forceUpdate(); // TODO: just update the voip buttons
    };

    private onMuteVideoClick = () => {
        const call = this.getCallForRoom();
        if (!call) {
            return;
        }
        const newState = !call.isLocalVideoMuted();
        call.setLocalVideoMuted(newState);
        this.forceUpdate(); // TODO: just update the voip buttons
    };

    private onStatusBarVisible = () => {
        if (this.unmounted) return;
        this.setState({
            statusBarVisible: true,
        });
    };

    private onStatusBarHidden = () => {
        // This is currently not desired as it is annoying if it keeps expanding and collapsing
        if (this.unmounted) return;
        this.setState({
            statusBarVisible: false,
        });
    };

    /**
     * called by the parent component when PageUp/Down/etc is pressed.
     *
     * We pass it down to the scroll panel.
     */
    private handleScrollKey = ev => {
        let panel;
        if (this.searchResultsPanel.current) {
            panel = this.searchResultsPanel.current;
        } else if (this.messagePanel) {
            panel = this.messagePanel;
        }

        if (panel) {
            panel.handleScrollKey(ev);
        }
    };

    /**
     * get any current call for this room
     */
    private getCallForRoom(): MatrixCall {
        if (!this.state.room) {
            return null;
        }
        return CallHandler.sharedInstance().getCallForRoom(this.state.room.roomId);
    }

    // this has to be a proper method rather than an unnamed function,
    // otherwise react calls it with null on each update.
    private gatherTimelinePanelRef = r => {
        this.messagePanel = r;
        if (r) {
            console.log("updateTint from RoomView.gatherTimelinePanelRef");
            this.updateTint();
        }
    };

    private getOldRoom() {
        const createEvent = this.state.room.currentState.getStateEvents("m.room.create", "");
        if (!createEvent || !createEvent.getContent()['predecessor']) return null;

        return this.context.getRoom(createEvent.getContent()['predecessor']['room_id']);
    }

    getHiddenHighlightCount() {
        const oldRoom = this.getOldRoom();
        if (!oldRoom) return 0;
        return oldRoom.getUnreadNotificationCount('highlight');
    }

    onHiddenHighlightsClick = () => {
        const oldRoom = this.getOldRoom();
        if (!oldRoom) return;
        dis.dispatch({action: "view_room", room_id: oldRoom.roomId});
    };

    render() {
        if (!this.state.room) {
            const loading = !this.state.matrixClientIsReady || this.state.roomLoading || this.state.peekLoading;
            if (loading) {
                // Assume preview loading if we don't have a ready client or a room ID (still resolving the alias)
                const previewLoading = !this.state.matrixClientIsReady || !this.state.roomId || this.state.peekLoading;
                return (
                    <div className="mx_RoomView">
                        <ErrorBoundary>
                            <RoomPreviewBar
                                canPreview={false}
                                previewLoading={previewLoading && !this.state.roomLoadError}
                                error={this.state.roomLoadError}
                                loading={loading}
                                joining={this.state.joining}
                                oobData={this.props.oobData}
                            />
                        </ErrorBoundary>
                    </div>
                );
            } else {
                let inviterName = undefined;
                if (this.props.oobData) {
                    inviterName = this.props.oobData.inviterName;
                }
                const invitedEmail = this.props.threepidInvite?.toEmail;

                // We have no room object for this room, only the ID.
                // We've got to this room by following a link, possibly a third party invite.
                const roomAlias = this.state.roomAlias;
                return (
                    <div className="mx_RoomView">
                        <ErrorBoundary>
                            <RoomPreviewBar
                                onJoinClick={this.onJoinButtonClicked}
                                onForgetClick={this.onForgetClick}
                                onRejectClick={this.onRejectThreepidInviteButtonClicked}
                                canPreview={false} error={this.state.roomLoadError}
                                roomAlias={roomAlias}
                                joining={this.state.joining}
                                inviterName={inviterName}
                                invitedEmail={invitedEmail}
                                oobData={this.props.oobData}
                                signUrl={this.props.threepidInvite?.signUrl}
                                room={this.state.room}
                            />
                        </ErrorBoundary>
                    </div>
                );
            }
        }

        const myMembership = this.state.room.getMyMembership();
        if (myMembership == 'invite') {
            if (this.state.joining || this.state.rejecting) {
                return (
                    <ErrorBoundary>
                        <RoomPreviewBar
                            canPreview={false}
                            error={this.state.roomLoadError}
                            joining={this.state.joining}
                            rejecting={this.state.rejecting}
                        />
                    </ErrorBoundary>
                );
            } else {
                const myUserId = this.context.credentials.userId;
                const myMember = this.state.room.getMember(myUserId);
                const inviteEvent = myMember ? myMember.events.member : null;
                let inviterName = _t("Unknown");
                if (inviteEvent) {
                    inviterName = inviteEvent.sender ? inviteEvent.sender.name : inviteEvent.getSender();
                }

                // We deliberately don't try to peek into invites, even if we have permission to peek
                // as they could be a spam vector.
                // XXX: in future we could give the option of a 'Preview' button which lets them view anyway.

                // We have a regular invite for this room.
                return (
                    <div className="mx_RoomView">
                        <ErrorBoundary>
                            <RoomPreviewBar
                                onJoinClick={this.onJoinButtonClicked}
                                onForgetClick={this.onForgetClick}
                                onRejectClick={this.onRejectButtonClicked}
                                onRejectAndIgnoreClick={this.onRejectAndIgnoreClick}
                                inviterName={inviterName}
                                canPreview={false}
                                joining={this.state.joining}
                                room={this.state.room}
                            />
                        </ErrorBoundary>
                    </div>
                );
            }
        }

        // We have successfully loaded this room, and are not previewing.
        // Display the "normal" room view.

        let activeCall = null;
        {
            // New block because this variable doesn't need to hang around for the rest of the function
            const call = this.getCallForRoom();
            if (call && (this.state.callState !== 'ended' && this.state.callState !== 'ringing')) {
                activeCall = call;
            }
        }

        const scrollheaderClasses = classNames({
            mx_RoomView_scrollheader: true,
        });

        let statusBar;
        let isStatusAreaExpanded = true;

        if (ContentMessages.sharedInstance().getCurrentUploads().length > 0) {
            const UploadBar = sdk.getComponent('structures.UploadBar');
            statusBar = <UploadBar room={this.state.room} />;
        } else if (!this.state.searchResults) {
            const RoomStatusBar = sdk.getComponent('structures.RoomStatusBar');
            isStatusAreaExpanded = this.state.statusBarVisible;
            statusBar = <RoomStatusBar
                room={this.state.room}
                isPeeking={myMembership !== "join"}
                onInviteClick={this.onInviteButtonClick}
                onVisible={this.onStatusBarVisible}
                onHidden={this.onStatusBarHidden}
            />;
        }

        const roomVersionRecommendation = this.state.upgradeRecommendation;
        const showRoomUpgradeBar = (
            roomVersionRecommendation &&
            roomVersionRecommendation.needsUpgrade &&
            this.state.room.userMayUpgradeRoom(this.context.credentials.userId)
        );

        const hiddenHighlightCount = this.getHiddenHighlightCount();

        let aux = null;
        let previewBar;
        let hideCancel = false;
        if (this.state.forwardingEvent) {
            aux = <ForwardMessage onCancelClick={this.onCancelClick} />;
        } else if (this.state.searching) {
            hideCancel = true; // has own cancel
            aux = <SearchBar
                searchInProgress={this.state.searchInProgress}
                onCancelClick={this.onCancelSearchClick}
                onSearch={this.onSearch}
                isRoomEncrypted={this.context.isRoomEncrypted(this.state.room.roomId)}
            />;
        } else if (showRoomUpgradeBar) {
            aux = <RoomUpgradeWarningBar room={this.state.room} recommendation={roomVersionRecommendation} />;
            hideCancel = true;
        } else if (this.state.showingPinned) {
            hideCancel = true; // has own cancel
            aux = <PinnedEventsPanel room={this.state.room} onCancelClick={this.onPinnedClick} />;
        } else if (myMembership !== "join") {
            // We do have a room object for this room, but we're not currently in it.
            // We may have a 3rd party invite to it.
            let inviterName = undefined;
            if (this.props.oobData) {
                inviterName = this.props.oobData.inviterName;
            }
            const invitedEmail = this.props.threepidInvite?.toEmail;
            hideCancel = true;
            previewBar = (
                <RoomPreviewBar
                    onJoinClick={this.onJoinButtonClicked}
                    onForgetClick={this.onForgetClick}
                    onRejectClick={this.onRejectThreepidInviteButtonClicked}
                    joining={this.state.joining}
                    inviterName={inviterName}
                    invitedEmail={invitedEmail}
                    oobData={this.props.oobData}
                    canPreview={this.state.canPeek}
                    room={this.state.room}
                />
            );
            if (!this.state.canPeek) {
                return (
                    <div className="mx_RoomView">
                        { previewBar }
                    </div>
                );
            }
        } else if (hiddenHighlightCount > 0) {
            aux = (
                <AccessibleButton
                    element="div"
                    className="mx_RoomView_auxPanel_hiddenHighlights"
                    onClick={this.onHiddenHighlightsClick}
                >
                    {_t(
                        "You have %(count)s unread notifications in a prior version of this room.",
                        {count: hiddenHighlightCount},
                    )}
                </AccessibleButton>
            );
        }

        const auxPanel = (
            <AuxPanel
                room={this.state.room}
                fullHeight={false}
                userId={this.context.credentials.userId}
                draggingFile={this.state.draggingFile}
                maxHeight={this.state.auxPanelMaxHeight}
                showApps={this.state.showApps}
                onResize={this.onResize}
                resizeNotifier={this.props.resizeNotifier}
            >
                { aux }
            </AuxPanel>
        );

        let messageComposer; let searchInfo;
        const canSpeak = (
            // joined and not showing search results
            myMembership === 'join' && !this.state.searchResults
        );
        if (canSpeak) {
            const MessageComposer = sdk.getComponent('rooms.MessageComposer');
            messageComposer =
                <MessageComposer
                    room={this.state.room}
                    callState={this.state.callState}
                    showApps={this.state.showApps}
                    e2eStatus={this.state.e2eStatus}
                    resizeNotifier={this.props.resizeNotifier}
                    replyToEvent={this.state.replyToEvent}
                    permalinkCreator={this.getPermalinkCreatorForRoom(this.state.room)}
                />;
        }

        // TODO: Why aren't we storing the term/scope/count in this format
        // in this.state if this is what RoomHeader desires?
        if (this.state.searchResults) {
            searchInfo = {
                searchTerm: this.state.searchTerm,
                searchScope: this.state.searchScope,
                searchCount: this.state.searchResults.count,
            };
        }

        // if we have search results, we keep the messagepanel (so that it preserves its
        // scroll state), but hide it.
        let searchResultsPanel;
        let hideMessagePanel = false;

        if (this.state.searchResults) {
            // show searching spinner
            if (this.state.searchResults.count === undefined) {
                searchResultsPanel = (
                    <div className="mx_RoomView_messagePanel mx_RoomView_messagePanelSearchSpinner" />
                );
            } else {
                searchResultsPanel = (
                    <ScrollPanel
                        ref={this.searchResultsPanel}
                        className="mx_RoomView_messagePanel mx_RoomView_searchResultsPanel mx_GroupLayout"
                        onFillRequest={this.onSearchResultsFillRequest}
                        resizeNotifier={this.props.resizeNotifier}
                    >
                        <li className={scrollheaderClasses} />
                        { this.getSearchResultTiles() }
                    </ScrollPanel>
                );
            }
            hideMessagePanel = true;
        }

        const shouldHighlight = this.state.isInitialEventHighlighted;
        let highlightedEventId = null;
        if (this.state.forwardingEvent) {
            highlightedEventId = this.state.forwardingEvent.getId();
        } else if (shouldHighlight) {
            highlightedEventId = this.state.initialEventId;
        }

        const messagePanelClassNames = classNames(
            "mx_RoomView_messagePanel",
            {
                "mx_IRCLayout": this.state.useIRCLayout,
                "mx_GroupLayout": !this.state.useIRCLayout,
            });

        // console.info("ShowUrlPreview for %s is %s", this.state.room.roomId, this.state.showUrlPreview);
        const messagePanel = (
            <TimelinePanel
                ref={this.gatherTimelinePanelRef}
                timelineSet={this.state.room.getUnfilteredTimelineSet()}
                showReadReceipts={this.state.showReadReceipts}
                manageReadReceipts={!this.state.isPeeking}
                manageReadMarkers={!this.state.isPeeking}
                hidden={hideMessagePanel}
                highlightedEventId={highlightedEventId}
                eventId={this.state.initialEventId}
                eventPixelOffset={this.state.initialEventPixelOffset}
                onScroll={this.onMessageListScroll}
                onReadMarkerUpdated={this.updateTopUnreadMessagesBar}
                showUrlPreview = {this.state.showUrlPreview}
                className={messagePanelClassNames}
                membersLoaded={this.state.membersLoaded}
                permalinkCreator={this.getPermalinkCreatorForRoom(this.state.room)}
                resizeNotifier={this.props.resizeNotifier}
                showReactions={true}
                useIRCLayout={this.state.useIRCLayout}
            />);

        let topUnreadMessagesBar = null;
        // Do not show TopUnreadMessagesBar if we have search results showing, it makes no sense
        if (this.state.showTopUnreadMessagesBar && !this.state.searchResults) {
            const TopUnreadMessagesBar = sdk.getComponent('rooms.TopUnreadMessagesBar');
            topUnreadMessagesBar = (
                <TopUnreadMessagesBar onScrollUpClick={this.jumpToReadMarker} onCloseClick={this.forgetReadMarker} />
            );
        }
        let jumpToBottom;
        // Do not show JumpToBottomButton if we have search results showing, it makes no sense
        if (!this.state.atEndOfLiveTimeline && !this.state.searchResults) {
            const JumpToBottomButton = sdk.getComponent('rooms.JumpToBottomButton');
            jumpToBottom = (<JumpToBottomButton
                highlight={this.state.room.getUnreadNotificationCount('highlight') > 0}
                numUnreadMessages={this.state.numUnreadMessages}
                onScrollToBottomClick={this.jumpToLiveTimeline}
            />);
        }

        const statusBarAreaClass = classNames("mx_RoomView_statusArea", {
            "mx_RoomView_statusArea_expanded": isStatusAreaExpanded,
        });

        const showRightPanel = this.state.room && this.state.showRightPanel;
        const rightPanel = showRightPanel
            ? <RightPanel room={this.state.room} resizeNotifier={this.props.resizeNotifier} />
            : null;

        const timelineClasses = classNames("mx_RoomView_timeline", {
            mx_RoomView_timeline_rr_enabled: this.state.showReadReceipts,
        });

        const mainClasses = classNames("mx_RoomView", {
            mx_RoomView_inCall: Boolean(activeCall),
        });

        const showChatEffects = SettingsStore.getValue('showChatEffects');

        return (
            <RoomContext.Provider value={this.state}>
                <main className={mainClasses} ref={this.roomView} onKeyDown={this.onReactKeyDown}>
                    {showChatEffects && this.roomView.current &&
                        <EffectsOverlay roomWidth={this.roomView.current.offsetWidth} />
                    }
                    <ErrorBoundary>
                        <RoomHeader
                            room={this.state.room}
                            searchInfo={searchInfo}
                            oobData={this.props.oobData}
                            inRoom={myMembership === 'join'}
                            onSearchClick={this.onSearchClick}
                            onSettingsClick={this.onSettingsClick}
                            onPinnedClick={this.onPinnedClick}
                            onCancelClick={(aux && !hideCancel) ? this.onCancelClick : null}
                            onForgetClick={(myMembership === "leave") ? this.onForgetClick : null}
                            onLeaveClick={(myMembership === "join") ? this.onLeaveClick : null}
                            e2eStatus={this.state.e2eStatus}
                            onAppsClick={this.state.hasPinnedWidgets ? this.onAppsClick : null}
                            appsShown={this.state.showApps}
                        />
                        <MainSplit panel={rightPanel} resizeNotifier={this.props.resizeNotifier}>
                            <div className="mx_RoomView_body">
                                {auxPanel}
                                <div className={timelineClasses}>
                                    {topUnreadMessagesBar}
                                    {jumpToBottom}
                                    {messagePanel}
                                    {searchResultsPanel}
                                </div>
                                <div className={statusBarAreaClass}>
                                    <div className="mx_RoomView_statusAreaBox">
                                        <div className="mx_RoomView_statusAreaBox_line" />
                                        {statusBar}
                                    </div>
                                </div>
                                {previewBar}
                                {messageComposer}
                            </div>
                        </MainSplit>
                    </ErrorBoundary>
                </main>
            </RoomContext.Provider>
        );
    }
}
