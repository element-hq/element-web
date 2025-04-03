/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type ChangeEvent,
    type ComponentProps,
    createRef,
    type ReactElement,
    type ReactNode,
    type RefObject,
    type JSX,
} from "react";
import classNames from "classnames";
import {
    type IRecommendedVersion,
    NotificationCountType,
    type Room,
    RoomEvent,
    type RoomState,
    RoomStateEvent,
    type MatrixEvent,
    MatrixEventEvent,
    type EventTimeline,
    type IRoomTimelineData,
    EventType,
    HistoryVisibility,
    JoinRule,
    ClientEvent,
    type MatrixError,
    type ISearchResults,
    THREAD_RELATION_TYPE,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import { type CallState, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { debounce, throttle } from "lodash";
import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { type ViewRoomOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";

import shouldHideEvent from "../../shouldHideEvent";
import { _t } from "../../languageHandler";
import * as TimezoneHandler from "../../TimezoneHandler";
import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import ContentMessages from "../../ContentMessages";
import Modal from "../../Modal";
import { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import defaultDispatcher from "../../dispatcher/dispatcher";
import * as Rooms from "../../Rooms";
import MainSplit from "./MainSplit";
import RightPanel from "./RightPanel";
import RoomScrollStateStore, { type ScrollState } from "../../stores/RoomScrollStateStore";
import WidgetEchoStore from "../../stores/WidgetEchoStore";
import SettingsStore from "../../settings/SettingsStore";
import { Layout } from "../../settings/enums/Layout";
import AccessibleButton, { type ButtonEvent } from "../views/elements/AccessibleButton";
import { TimelineRenderingType, MainSplitContentType } from "../../contexts/RoomContext";
import { E2EStatus, shieldStatusForRoom } from "../../utils/ShieldUtils";
import { Action } from "../../dispatcher/actions";
import { type IMatrixClientCreds } from "../../MatrixClientPeg";
import ScrollPanel from "./ScrollPanel";
import TimelinePanel from "./TimelinePanel";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import RoomPreviewBar from "../views/rooms/RoomPreviewBar";
import RoomPreviewCard from "../views/rooms/RoomPreviewCard";
import RoomUpgradeWarningBar from "../views/rooms/RoomUpgradeWarningBar";
import AuxPanel from "../views/rooms/AuxPanel";
import RoomHeader from "../views/rooms/RoomHeader/RoomHeader";
import { type IOOBData, type IThreepidInvite } from "../../stores/ThreepidInviteStore";
import EffectsOverlay from "../views/elements/EffectsOverlay";
import { containsEmoji } from "../../effects/utils";
import { CHAT_EFFECTS } from "../../effects";
import { CallView } from "../views/voip/CallView";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import Notifier from "../../Notifier";
import { showToast as showNotificationsToast } from "../../toasts/DesktopNotificationsToast";
import { Container, WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import { getKeyBindingsManager } from "../../KeyBindingsManager";
import { objectHasDiff } from "../../utils/objects";
import SpaceRoomView from "./SpaceRoomView";
import { type IOpts } from "../../createRoom";
import EditorStateTransfer from "../../utils/EditorStateTransfer";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import UploadBar from "./UploadBar";
import RoomStatusBar from "./RoomStatusBar";
import MessageComposer from "../views/rooms/MessageComposer";
import JumpToBottomButton from "../views/rooms/JumpToBottomButton";
import TopUnreadMessagesBar from "../views/rooms/TopUnreadMessagesBar";
import { fetchInitialEvent } from "../../utils/EventUtils";
import { type ComposerInsertPayload, ComposerType } from "../../dispatcher/payloads/ComposerInsertPayload";
import AppsDrawer from "../views/rooms/AppsDrawer";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import { type ActionPayload } from "../../dispatcher/payloads";
import { KeyBindingAction } from "../../accessibility/KeyboardShortcuts";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { type JoinRoomPayload } from "../../dispatcher/payloads/JoinRoomPayload";
import { type DoAfterSyncPreparedPayload } from "../../dispatcher/payloads/DoAfterSyncPreparedPayload";
import FileDropTarget from "./FileDropTarget";
import Measured from "../views/elements/Measured";
import { type FocusComposerPayload } from "../../dispatcher/payloads/FocusComposerPayload";
import { LocalRoom, LocalRoomState } from "../../models/LocalRoom";
import { createRoomFromLocalRoom } from "../../utils/direct-messages";
import NewRoomIntro from "../views/rooms/NewRoomIntro";
import EncryptionEvent from "../views/messages/EncryptionEvent";
import { StaticNotificationState } from "../../stores/notifications/StaticNotificationState";
import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { type ShowThreadPayload } from "../../dispatcher/payloads/ShowThreadPayload";
import { RoomStatusBarUnsentMessages } from "./RoomStatusBarUnsentMessages";
import { LargeLoader } from "./LargeLoader";
import { isVideoRoom } from "../../utils/video-rooms";
import { SDKContext } from "../../contexts/SDKContext";
import { RoomSearchView } from "./RoomSearchView";
import eventSearch, { type SearchInfo, SearchScope } from "../../Searching";
import VoipUserMapper from "../../VoipUserMapper";
import { isCallEvent } from "./LegacyCallEventGrouper";
import { WidgetType } from "../../widgets/WidgetType";
import WidgetUtils from "../../utils/WidgetUtils";
import { shouldEncryptRoomWithSingle3rdPartyInvite } from "../../utils/room/shouldEncryptRoomWithSingle3rdPartyInvite";
import { WaitingForThirdPartyRoomView } from "./WaitingForThirdPartyRoomView";
import { isNotUndefined } from "../../Typeguards";
import { type CancelAskToJoinPayload } from "../../dispatcher/payloads/CancelAskToJoinPayload";
import { type SubmitAskToJoinPayload } from "../../dispatcher/payloads/SubmitAskToJoinPayload";
import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { onView3pidInvite } from "../../stores/right-panel/action-handlers";
import RoomSearchAuxPanel from "../views/rooms/RoomSearchAuxPanel";
import { PinnedMessageBanner } from "../views/rooms/PinnedMessageBanner";
import { ScopedRoomContextProvider, useScopedRoomContext } from "../../contexts/ScopedRoomContext";
import { DeclineAndBlockInviteDialog } from "../views/dialogs/DeclineAndBlockInviteDialog";

const DEBUG = false;
const PREVENT_MULTIPLE_JITSI_WITHIN = 30_000;
let debuglog = function (msg: string): void {};

const BROWSER_SUPPORTS_SANDBOX = "sandbox" in document.createElement("iframe");

/* istanbul ignore next */
if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    debuglog = logger.log.bind(console);
}

interface IRoomProps {
    threepidInvite?: IThreepidInvite;
    oobData?: IOOBData;

    resizeNotifier: ResizeNotifier;
    justCreatedOpts?: IOpts;

    forceTimeline?: boolean; // should we force access to the timeline, overriding (for eg) spaces

    // Called with the credentials of a registered user (if they were a ROU that transitioned to PWLU)
    onRegistered?(credentials: IMatrixClientCreds): void;
}

export { MainSplitContentType };

export interface IRoomState {
    room?: Room;
    virtualRoom?: Room;
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
    // Whether to scroll the event into view
    initialEventScrollIntoView?: boolean;
    replyToEvent?: MatrixEvent;
    numUnreadMessages: number;
    /**
     * The state of an ongoing search if there is one.
     */
    search?: SearchInfo;
    callState?: CallState;
    canPeek: boolean;
    canSelfRedact: boolean;
    showApps: boolean;
    isPeeking: boolean;
    showRightPanel: boolean;
    // error object, as from the matrix client/server API
    // If we failed to load information about the room,
    // store the error here.
    roomLoadError?: MatrixError;
    // Have we sent a request to join the room that we're waiting to complete?
    joining: boolean;
    // this is true if we are fully scrolled-down, and are looking at
    // the end of the live timeline. It has the effect of hiding the
    // 'scroll to bottom' knob, among a couple of other things.
    atEndOfLiveTimeline?: boolean;
    showTopUnreadMessagesBar: boolean;
    statusBarVisible: boolean;
    // We load this later by asking the js-sdk to suggest a version for us.
    // This object is the result of Room#getRecommendedVersion()

    upgradeRecommendation?: IRecommendedVersion;
    canReact: boolean;
    canSendMessages: boolean;
    tombstone?: MatrixEvent;
    resizing: boolean;
    layout: Layout;
    lowBandwidth: boolean;
    alwaysShowTimestamps: boolean;
    showTwelveHourTimestamps: boolean;
    userTimezone: string | undefined;
    readMarkerInViewThresholdMs: number;
    readMarkerOutOfViewThresholdMs: number;
    showHiddenEvents: boolean;
    showReadReceipts: boolean;
    showRedactions: boolean;
    showJoinLeaves: boolean;
    showAvatarChanges: boolean;
    showDisplaynameChanges: boolean;
    matrixClientIsReady: boolean;
    showUrlPreview?: boolean;
    e2eStatus?: E2EStatus;
    rejecting?: boolean;
    hasPinnedWidgets?: boolean;
    mainSplitContentType: MainSplitContentType;
    // whether or not a spaces context switch brought us here,
    // if it did we don't want the room to be marked as read as soon as it is loaded.
    wasContextSwitch?: boolean;
    editState?: EditorStateTransfer;
    timelineRenderingType: TimelineRenderingType;
    liveTimeline?: EventTimeline;
    narrow: boolean;
    msc3946ProcessDynamicPredecessor: boolean;
    /**
     * Whether the room is encrypted or not.
     * If null, we are still determining the encryption status.
     */
    isRoomEncrypted: boolean | null;

    canAskToJoin: boolean;
    promptAskToJoin: boolean;

    viewRoomOpts: ViewRoomOpts;
}

interface LocalRoomViewProps {
    localRoom: LocalRoom;
    resizeNotifier: ResizeNotifier;
    permalinkCreator: RoomPermalinkCreator;
    roomView: RefObject<HTMLElement | null>;
    onFileDrop: (dataTransfer: DataTransfer) => Promise<void>;
    mainSplitContentType: MainSplitContentType;
}

/**
 * Local room view. Uses only the bits necessary to display a local room view like room header or composer.
 *
 * @param {LocalRoomViewProps} props Room view props
 * @returns {ReactElement}
 */
function LocalRoomView(props: LocalRoomViewProps): ReactElement {
    const context = useScopedRoomContext("room");
    const room = context.room as LocalRoom;
    const encryptionEvent = props.localRoom.currentState.getStateEvents(EventType.RoomEncryption)[0];
    let encryptionTile: ReactNode;

    if (encryptionEvent) {
        encryptionTile = <EncryptionEvent mxEvent={encryptionEvent} />;
    }

    const onRetryClicked = (): void => {
        // eslint-disable-next-line react-compiler/react-compiler
        room.state = LocalRoomState.NEW;
        defaultDispatcher.dispatch({
            action: "local_room_event",
            roomId: room.roomId,
        });
    };

    let statusBar: ReactElement | null = null;
    let composer: ReactElement | null = null;

    if (room.isError) {
        const buttons = (
            <AccessibleButton onClick={onRetryClicked} className="mx_RoomStatusBar_unsentRetry">
                {_t("action|retry")}
            </AccessibleButton>
        );

        statusBar = (
            <RoomStatusBarUnsentMessages
                title={_t("room|status_bar|some_messages_not_sent")}
                notificationState={StaticNotificationState.RED_EXCLAMATION}
                buttons={buttons}
            />
        );
    } else {
        composer = (
            <MessageComposer
                room={props.localRoom}
                resizeNotifier={props.resizeNotifier}
                permalinkCreator={props.permalinkCreator}
            />
        );
    }

    return (
        <div className="mx_RoomView mx_RoomView--local">
            <ErrorBoundary>
                <RoomHeader room={room} />
                <main className="mx_RoomView_body" ref={props.roomView}>
                    <FileDropTarget parent={props.roomView.current} onFileDrop={props.onFileDrop} />
                    <div className="mx_RoomView_timeline">
                        <ScrollPanel className="mx_RoomView_messagePanel" resizeNotifier={props.resizeNotifier}>
                            {encryptionTile}
                            <NewRoomIntro />
                        </ScrollPanel>
                    </div>
                    {statusBar}
                    {composer}
                </main>
            </ErrorBoundary>
        </div>
    );
}

interface ILocalRoomCreateLoaderProps {
    localRoom: LocalRoom;
    names: string;
    resizeNotifier: ResizeNotifier;
    mainSplitContentType: MainSplitContentType;
}

/**
 * Room create loader view displaying a message and a spinner.
 *
 * @param {ILocalRoomCreateLoaderProps} props Room view props
 * @return {ReactElement}
 */
function LocalRoomCreateLoader(props: ILocalRoomCreateLoaderProps): ReactElement {
    const text = _t("room|creating_room_text", { names: props.names });
    return (
        <div className="mx_RoomView mx_RoomView--local">
            <ErrorBoundary>
                <RoomHeader room={props.localRoom} />
                <div className="mx_RoomView_body">
                    <LargeLoader text={text} />
                </div>
            </ErrorBoundary>
        </div>
    );
}

export class RoomView extends React.Component<IRoomProps, IRoomState> {
    // We cache the latest computed e2eStatus per room to show as soon as we switch rooms otherwise defaulting to
    // unencrypted causes a flicker which can yield confusion/concern in a larger room.
    private static e2eStatusCache = new Map<string, E2EStatus>();

    private readonly askToJoinEnabled: boolean;
    private dispatcherRef?: string;
    private settingWatchers: string[] = [];

    private unmounted = false;
    private permalinkCreators: Record<string, RoomPermalinkCreator> = {};

    private roomView = createRef<HTMLDivElement>();
    private searchResultsPanel = createRef<ScrollPanel>();
    private messagePanel: TimelinePanel | null = null;
    private roomViewBody = createRef<HTMLDivElement>();

    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    public constructor(props: IRoomProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);

        this.askToJoinEnabled = SettingsStore.getValue("feature_ask_to_join");

        if (!context.client) {
            throw new Error("Unable to create RoomView without MatrixClient");
        }

        const llMembers = context.client.hasLazyLoadMembersEnabled();
        this.state = {
            roomId: undefined,
            roomLoading: true,
            peekLoading: false,
            shouldPeek: true,
            membersLoaded: !llMembers,
            numUnreadMessages: 0,
            callState: undefined,
            canPeek: false,
            canSelfRedact: false,
            showApps: false,
            isPeeking: false,
            showRightPanel: false,
            joining: false,
            showTopUnreadMessagesBar: false,
            statusBarVisible: false,
            canReact: false,
            canSendMessages: false,
            resizing: false,
            layout: SettingsStore.getValue("layout"),
            lowBandwidth: SettingsStore.getValue("lowBandwidth"),
            alwaysShowTimestamps: SettingsStore.getValue("alwaysShowTimestamps"),
            showTwelveHourTimestamps: SettingsStore.getValue("showTwelveHourTimestamps"),
            userTimezone: TimezoneHandler.getUserTimezone(),
            readMarkerInViewThresholdMs: SettingsStore.getValue("readMarkerInViewThresholdMs"),
            readMarkerOutOfViewThresholdMs: SettingsStore.getValue("readMarkerOutOfViewThresholdMs"),
            showHiddenEvents: SettingsStore.getValue("showHiddenEventsInTimeline"),
            showReadReceipts: true,
            showRedactions: true,
            showJoinLeaves: true,
            showAvatarChanges: true,
            showDisplaynameChanges: true,
            matrixClientIsReady: context.client?.isInitialSyncComplete(),
            mainSplitContentType: MainSplitContentType.Timeline,
            timelineRenderingType: TimelineRenderingType.Room,
            liveTimeline: undefined,
            narrow: false,
            msc3946ProcessDynamicPredecessor: SettingsStore.getValue("feature_dynamic_room_predecessors"),
            canAskToJoin: this.askToJoinEnabled,
            promptAskToJoin: false,
            viewRoomOpts: { buttons: [] },
            isRoomEncrypted: null,
        };
    }

    private onIsResizing = (resizing: boolean): void => {
        this.setState({ resizing });
    };

    private onWidgetStoreUpdate = (): void => {
        if (!this.state.room) return;
        this.checkWidgets(this.state.room);
        this.doMaybeRemoveOwnJitsiWidget();
    };

    private onWidgetEchoStoreUpdate = (): void => {
        if (!this.state.room) return;
        this.checkWidgets(this.state.room);
    };

    private onWidgetLayoutChange = (): void => {
        if (!this.state.room) return;
        defaultDispatcher.dispatch({
            action: "appsDrawer",
            show: true,
        });
        if (this.context.widgetLayoutStore.hasMaximisedWidget(this.state.room)) {
            // Show chat in right panel when a widget is maximised
            this.context.rightPanelStore.setCard({ phase: RightPanelPhases.Timeline });
        }
        this.checkWidgets(this.state.room);
    };

    /**
     * Removes the Jitsi widget from the current user if
     * - Multiple Jitsi widgets have been added within {@link PREVENT_MULTIPLE_JITSI_WITHIN}
     * - The last (server timestamp) of these widgets is from the current user
     * This solves the issue if some people decide to start a conference and click the call button at the same time.
     */
    private doMaybeRemoveOwnJitsiWidget(): void {
        if (!this.state.roomId || !this.state.room || !this.context.client) return;

        const apps = this.context.widgetStore.getApps(this.state.roomId);
        const jitsiApps = apps.filter((app) => app.eventId && WidgetType.JITSI.matches(app.type));

        // less than two Jitsi widgets → nothing to do
        if (jitsiApps.length < 2) return;

        const currentUserId = this.context.client.getSafeUserId();
        const createdByCurrentUser = jitsiApps.find((apps) => apps.creatorUserId === currentUserId);

        // no Jitsi widget from current user → nothing to do
        if (!createdByCurrentUser) return;

        const createdByCurrentUserEvent = this.state.room.findEventById(createdByCurrentUser.eventId!);

        // widget event not found → nothing can be done
        if (!createdByCurrentUserEvent) return;

        const createdByCurrentUserTs = createdByCurrentUserEvent.getTs();

        // widget timestamp is empty → nothing can be done
        if (!createdByCurrentUserTs) return;

        const lastCreatedByOtherTs = jitsiApps.reduce((maxByNow: number, app) => {
            if (app.eventId === createdByCurrentUser.eventId) return maxByNow;

            const appCreateTs = this.state.room!.findEventById(app.eventId!)?.getTs() || 0;
            return Math.max(maxByNow, appCreateTs);
        }, 0);

        // last widget timestamp from other is empty → nothing can be done
        if (!lastCreatedByOtherTs) return;

        if (
            createdByCurrentUserTs > lastCreatedByOtherTs &&
            createdByCurrentUserTs - lastCreatedByOtherTs < PREVENT_MULTIPLE_JITSI_WITHIN
        ) {
            // more than one Jitsi widget with the last one from the current user → remove it
            WidgetUtils.setRoomWidget(this.context.client, this.state.roomId, createdByCurrentUser.id);
        }
    }

    private checkWidgets = (room: Room): void => {
        this.setState({
            hasPinnedWidgets: this.context.widgetLayoutStore.hasPinnedWidgets(room),
            mainSplitContentType: this.getMainSplitContentType(room),
            showApps: this.shouldShowApps(room),
        });
    };

    private getMainSplitContentType = (room: Room): MainSplitContentType => {
        if (this.context.roomViewStore.isViewingCall() || isVideoRoom(room)) {
            return MainSplitContentType.Call;
        }
        if (this.context.widgetLayoutStore.hasMaximisedWidget(room)) {
            return MainSplitContentType.MaximisedWidget;
        }
        return MainSplitContentType.Timeline;
    };

    private onRoomViewStoreUpdate = async (initial?: boolean): Promise<void> => {
        if (this.unmounted) {
            return;
        }

        const roomLoadError = this.context.roomViewStore.getRoomLoadError() ?? undefined;
        if (!initial && !roomLoadError && this.state.roomId !== this.context.roomViewStore.getRoomId()) {
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

        const roomId = this.context.roomViewStore.getRoomId() ?? null;
        const room = this.context.client?.getRoom(roomId ?? undefined) ?? undefined;

        const newState: Partial<IRoomState> = {
            roomId: roomId ?? undefined,
            roomAlias: this.context.roomViewStore.getRoomAlias() ?? undefined,
            roomLoading: this.context.roomViewStore.isRoomLoading(),
            roomLoadError,
            joining: this.context.roomViewStore.isJoining(),
            replyToEvent: this.context.roomViewStore.getQuotingEvent() ?? undefined,
            // we should only peek once we have a ready client
            shouldPeek: this.state.matrixClientIsReady && this.context.roomViewStore.shouldPeek(),
            showReadReceipts: SettingsStore.getValue("showReadReceipts", roomId),
            showRedactions: SettingsStore.getValue("showRedactions", roomId),
            showJoinLeaves: SettingsStore.getValue("showJoinLeaves", roomId),
            showAvatarChanges: SettingsStore.getValue("showAvatarChanges", roomId),
            showDisplaynameChanges: SettingsStore.getValue("showDisplaynameChanges", roomId),
            wasContextSwitch: this.context.roomViewStore.getWasContextSwitch(),
            mainSplitContentType: room ? this.getMainSplitContentType(room) : undefined,
            initialEventId: undefined, // default to clearing this, will get set later in the method if needed
            showRightPanel: roomId ? this.context.rightPanelStore.isOpenForRoom(roomId) : false,
            promptAskToJoin: this.context.roomViewStore.promptAskToJoin(),
            viewRoomOpts: this.context.roomViewStore.getViewRoomOpts(),
        };

        if (
            this.state.mainSplitContentType !== MainSplitContentType.Timeline &&
            newState.mainSplitContentType === MainSplitContentType.Timeline &&
            this.context.rightPanelStore.isOpen &&
            this.context.rightPanelStore.currentCard.phase === RightPanelPhases.Timeline &&
            this.context.rightPanelStore.roomPhaseHistory.some((card) => card.phase === RightPanelPhases.Timeline)
        ) {
            // We're returning to the main timeline, so hide the right panel timeline
            this.context.rightPanelStore.setCard({ phase: RightPanelPhases.RoomSummary });
            this.context.rightPanelStore.togglePanel(this.state.roomId ?? null);
            newState.showRightPanel = false;
        }

        const initialEventId = this.context.roomViewStore.getInitialEventId() ?? this.state.initialEventId;
        if (initialEventId) {
            let initialEvent = room?.findEventById(initialEventId);
            // The event does not exist in the current sync data
            // We need to fetch it to know whether to route this request
            // to the main timeline or to a threaded one
            // In the current state, if a thread does not exist in the sync data
            // We will only display the event targeted by the `matrix.to` link
            // and the root event.
            // The rest will be lost for now, until the aggregation API on the server
            // becomes available to fetch a whole thread
            if (!initialEvent && this.context.client && roomId) {
                initialEvent = (await fetchInitialEvent(this.context.client, roomId, initialEventId)) ?? undefined;
            }

            // If we have an initial event, we want to reset the event pixel offset to ensure it ends up visible
            newState.initialEventPixelOffset = undefined;

            const thread = initialEvent?.getThread();
            // Handle the use case of a link to a thread message
            // ie: #/room/roomId/eventId (eventId of a thread message)
            if (thread?.rootEvent && !initialEvent?.isThreadRoot) {
                defaultDispatcher.dispatch<ShowThreadPayload>({
                    action: Action.ShowThread,
                    rootEvent: thread.rootEvent,
                    initialEvent,
                    highlighted: this.context.roomViewStore.isInitialEventHighlighted(),
                    scroll_into_view: this.context.roomViewStore.initialEventScrollIntoView(),
                });
            } else {
                newState.initialEventId = initialEventId;
                newState.isInitialEventHighlighted = this.context.roomViewStore.isInitialEventHighlighted();
                newState.initialEventScrollIntoView = this.context.roomViewStore.initialEventScrollIntoView();
            }
        }

        // Add watchers for each of the settings we just looked up
        this.settingWatchers = this.settingWatchers.concat([
            SettingsStore.watchSetting("showReadReceipts", roomId, (...[, , , value]) =>
                this.setState({ showReadReceipts: value as boolean }),
            ),
            SettingsStore.watchSetting("showRedactions", roomId, (...[, , , value]) =>
                this.setState({ showRedactions: value as boolean }),
            ),
            SettingsStore.watchSetting("showJoinLeaves", roomId, (...[, , , value]) =>
                this.setState({ showJoinLeaves: value as boolean }),
            ),
            SettingsStore.watchSetting("showAvatarChanges", roomId, (...[, , , value]) =>
                this.setState({ showAvatarChanges: value as boolean }),
            ),
            SettingsStore.watchSetting("showDisplaynameChanges", roomId, (...[, , , value]) =>
                this.setState({ showDisplaynameChanges: value as boolean }),
            ),
        ]);

        if (!initial && this.state.shouldPeek && !newState.shouldPeek) {
            // Stop peeking because we have joined this room now
            this.context.client?.stopPeeking();
        }

        // Temporary logging to diagnose https://github.com/vector-im/element-web/issues/4307
        logger.log(
            "RVS update:",
            newState.roomId,
            newState.roomAlias,
            "loading?",
            newState.roomLoading,
            "joining?",
            newState.joining,
            "initial?",
            initial,
            "shouldPeek?",
            newState.shouldPeek,
        );

        // NB: This does assume that the roomID will not change for the lifetime of
        // the RoomView instance
        if (initial) {
            newState.room = this.context.client!.getRoom(newState.roomId) || undefined;
            newState.isRoomEncrypted = null;
            if (newState.room) {
                newState.showApps = this.shouldShowApps(newState.room);
                this.onRoomLoaded(newState.room);
            }
        }

        if (this.state.roomId === undefined && newState.roomId !== undefined) {
            // Get the scroll state for the new room

            // If an event ID wasn't specified, default to the one saved for this room
            // in the scroll state store. Assume initialEventPixelOffset should be set.
            if (!newState.initialEventId && newState.roomId) {
                const roomScrollState = RoomScrollStateStore.getScrollState(newState.roomId);
                if (roomScrollState) {
                    newState.initialEventId = roomScrollState.focussedEvent;
                    newState.initialEventPixelOffset = roomScrollState.pixelOffset;
                }
            }
        }

        // Clear the search results when clicking a search result (which changes the
        // currently scrolled to event, this.state.initialEventId).
        if (
            this.state.timelineRenderingType === TimelineRenderingType.Search &&
            this.state.initialEventId !== newState.initialEventId
        ) {
            newState.timelineRenderingType = TimelineRenderingType.Room;
            this.state.search?.abortController?.abort();
            newState.search = undefined;
        }

        this.setState(newState as IRoomState);
        // At this point, newState.roomId could be null (e.g. the alias might not
        // have been resolved yet) so anything called here must handle this case.

        // We pass the new state into this function for it to read: it needs to
        // observe the new state but we don't want to put it in the setState
        // callback because this would prevent the setStates from being batched,
        // ie. cause it to render RoomView twice rather than the once that is necessary.
        if (initial) {
            this.setupRoom(newState.room, newState.roomId, !!newState.joining, !!newState.shouldPeek);
        }

        // We don't block the initial setup but we want to make it early to not block the timeline rendering
        const isRoomEncrypted = await this.getIsRoomEncrypted(newState.roomId);
        this.setState({
            isRoomEncrypted,
            ...(isRoomEncrypted &&
                newState.roomId && { e2eStatus: RoomView.e2eStatusCache.get(newState.roomId) ?? E2EStatus.Warning }),
        });
    };

    private onCallClose = (): void => {
        // Stop viewing the call
        defaultDispatcher.dispatch<ViewRoomPayload>(
            {
                action: Action.ViewRoom,
                room_id: this.state.roomId,
                view_call: false,
                metricsTrigger: undefined,
            },
            true,
        ); // Synchronous so that CallView disappears immediately
    };

    private getRoomId = (): string | undefined => {
        // According to `onRoomViewStoreUpdate`, `state.roomId` can be null
        // if we have a room alias we haven't resolved yet. To work around this,
        // first we'll try the room object if it's there, and then fallback to
        // the bare room ID. (We may want to update `state.roomId` after
        // resolving aliases, so we could always trust it.)
        return this.state.room?.roomId ?? this.state.roomId;
    };

    private getPermalinkCreatorForRoom(): RoomPermalinkCreator {
        const { room, roomId } = this.state;

        // If room is undefined, attempt to use the roomId to create and store a permalinkCreator.
        // Throw an error if we can not find a roomId in state.
        if (room === undefined) {
            if (isNotUndefined(roomId)) {
                const permalinkCreator = new RoomPermalinkCreator(null, roomId);
                this.permalinkCreators[roomId] = permalinkCreator;
                return permalinkCreator;
            } else {
                throw new Error("Cannot get a permalink creator without a roomId");
            }
        }

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

    private stopAllPermalinkCreators(): void {
        if (!this.permalinkCreators) return;
        for (const roomId of Object.keys(this.permalinkCreators)) {
            this.permalinkCreators[roomId].stop();
        }
    }

    private setupRoom(room: Room | undefined, roomId: string | undefined, joining: boolean, shouldPeek: boolean): void {
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
            if (!room && shouldPeek) {
                logger.info(`Attempting to peek into room ${roomId}`);
                this.setState({
                    peekLoading: true,
                    isPeeking: true, // this will change to false if peeking fails
                });
                this.context.client
                    ?.peekInRoom(roomId)
                    .then((room) => {
                        if (this.unmounted) {
                            return;
                        }
                        this.setState({
                            room: room,
                            peekLoading: false,
                            canAskToJoin: this.askToJoinEnabled && room.getJoinRule() === JoinRule.Knock,
                        });
                        this.onRoomLoaded(room);
                    })
                    .catch((err) => {
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
                        if (err.errcode === "M_GUEST_ACCESS_FORBIDDEN" || err.errcode === "M_FORBIDDEN") {
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
                this.context.client?.stopPeeking();
                this.setState({
                    isPeeking: false,
                    canAskToJoin: this.askToJoinEnabled && room.getJoinRule() === JoinRule.Knock,
                });
            }
        }
    }

    private shouldShowApps(room: Room): boolean {
        if (!BROWSER_SUPPORTS_SANDBOX || !room) return false;

        // Check if user has previously chosen to hide the app drawer for this
        // room. If so, do not show apps
        const hideWidgetKey = room.roomId + "_hide_widget_drawer";
        const hideWidgetDrawer = localStorage.getItem(hideWidgetKey);

        // If unset show the Tray
        // Otherwise (in case the user set hideWidgetDrawer by clicking the button) follow the parameter.
        const isManuallyShown = hideWidgetDrawer ? hideWidgetDrawer === "false" : true;

        const widgets = this.context.widgetLayoutStore.getContainerWidgets(room, Container.Top);
        return isManuallyShown && widgets.length > 0;
    }

    public componentDidMount(): void {
        this.unmounted = false;

        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        if (this.context.client) {
            this.context.client.on(ClientEvent.Room, this.onRoom);
            this.context.client.on(RoomEvent.Timeline, this.onRoomTimeline);
            this.context.client.on(RoomEvent.TimelineReset, this.onRoomTimelineReset);
            this.context.client.on(RoomEvent.Name, this.onRoomName);
            this.context.client.on(RoomStateEvent.Events, this.onRoomStateEvents);
            this.context.client.on(RoomStateEvent.Update, this.onRoomStateUpdate);
            this.context.client.on(RoomEvent.MyMembership, this.onMyMembership);
            this.context.client.on(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatus);
            this.context.client.on(CryptoEvent.UserTrustStatusChanged, this.onUserVerificationChanged);
            this.context.client.on(CryptoEvent.KeysChanged, this.onCrossSigningKeysChanged);
            this.context.client.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        }
        // Start listening for RoomViewStore updates
        this.context.roomViewStore.on(UPDATE_EVENT, this.onRoomViewStoreUpdate);

        this.context.rightPanelStore.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);

        WidgetEchoStore.on(UPDATE_EVENT, this.onWidgetEchoStoreUpdate);
        this.context.widgetStore.on(UPDATE_EVENT, this.onWidgetStoreUpdate);

        this.props.resizeNotifier.on("isResizing", this.onIsResizing);

        this.settingWatchers = [
            SettingsStore.watchSetting("layout", null, (...[, , , value]) =>
                this.setState({ layout: value as Layout }),
            ),
            SettingsStore.watchSetting("lowBandwidth", null, (...[, , , value]) =>
                this.setState({ lowBandwidth: value as boolean }),
            ),
            SettingsStore.watchSetting("alwaysShowTimestamps", null, (...[, , , value]) =>
                this.setState({ alwaysShowTimestamps: value as boolean }),
            ),
            SettingsStore.watchSetting("showTwelveHourTimestamps", null, (...[, , , value]) =>
                this.setState({ showTwelveHourTimestamps: value as boolean }),
            ),
            SettingsStore.watchSetting(TimezoneHandler.USER_TIMEZONE_KEY, null, (...[, , , value]) =>
                this.setState({ userTimezone: value as string }),
            ),
            SettingsStore.watchSetting("readMarkerInViewThresholdMs", null, (...[, , , value]) =>
                this.setState({ readMarkerInViewThresholdMs: value as number }),
            ),
            SettingsStore.watchSetting("readMarkerOutOfViewThresholdMs", null, (...[, , , value]) =>
                this.setState({ readMarkerOutOfViewThresholdMs: value as number }),
            ),
            SettingsStore.watchSetting("showHiddenEventsInTimeline", null, (...[, , , value]) =>
                this.setState({ showHiddenEvents: value as boolean }),
            ),
            SettingsStore.watchSetting("urlPreviewsEnabled", null, this.onUrlPreviewsEnabledChange),
            SettingsStore.watchSetting("urlPreviewsEnabled_e2ee", null, this.onUrlPreviewsEnabledChange),
            SettingsStore.watchSetting("feature_dynamic_room_predecessors", null, (...[, , , value]) =>
                this.setState({ msc3946ProcessDynamicPredecessor: value as boolean }),
            ),
        ];

        this.onRoomViewStoreUpdate(true);

        const call = this.getCallForRoom();
        const callState = call?.state;
        this.setState({
            callState,
        });

        this.context.legacyCallHandler.on(LegacyCallHandlerEvent.CallState, this.onCallState);
        window.addEventListener("beforeunload", this.onPageUnload);
    }

    public shouldComponentUpdate(nextProps: IRoomProps, nextState: IRoomState): boolean {
        const hasPropsDiff = objectHasDiff(this.props, nextProps);

        const { upgradeRecommendation, ...state } = this.state;
        const { upgradeRecommendation: newUpgradeRecommendation, ...newState } = nextState;

        const hasStateDiff =
            newUpgradeRecommendation?.needsUpgrade !== upgradeRecommendation?.needsUpgrade ||
            objectHasDiff(state, newState);

        return hasPropsDiff || hasStateDiff;
    }

    public componentDidUpdate(): void {
        // Note: We check the ref here with a flag because componentDidMount, despite
        // documentation, does not define our messagePanel ref. It looks like our spinner
        // in render() prevents the ref from being set on first mount, so we try and
        // catch the messagePanel when it does mount. Because we only want the ref once,
        // we use a boolean flag to avoid duplicate work.
        if (this.messagePanel && this.state.atEndOfLiveTimeline === undefined) {
            this.setState({
                atEndOfLiveTimeline: this.messagePanel.isAtEndOfLiveTimeline(),
            });
        }
    }

    public componentWillUnmount(): void {
        // set a boolean to say we've been unmounted, which any pending
        // promises can use to throw away their results.
        //
        // (We could use isMounted, but facebook have deprecated that.)
        this.unmounted = true;

        this.context.legacyCallHandler.removeListener(LegacyCallHandlerEvent.CallState, this.onCallState);

        // update the scroll map before we get unmounted
        if (this.state.roomId) {
            RoomScrollStateStore.setScrollState(this.state.roomId, this.getScrollState());
        }

        if (this.state.shouldPeek) {
            this.context.client?.stopPeeking();
        }

        // stop tracking room changes to format permalinks
        this.stopAllPermalinkCreators();

        defaultDispatcher.unregister(this.dispatcherRef);
        if (this.context.client) {
            this.context.client.removeListener(ClientEvent.Room, this.onRoom);
            this.context.client.removeListener(RoomEvent.Timeline, this.onRoomTimeline);
            this.context.client.removeListener(RoomEvent.TimelineReset, this.onRoomTimelineReset);
            this.context.client.removeListener(RoomEvent.Name, this.onRoomName);
            this.context.client.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
            this.context.client.removeListener(RoomEvent.MyMembership, this.onMyMembership);
            this.context.client.removeListener(RoomStateEvent.Update, this.onRoomStateUpdate);
            this.context.client.removeListener(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatus);
            this.context.client.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserVerificationChanged);
            this.context.client.removeListener(CryptoEvent.KeysChanged, this.onCrossSigningKeysChanged);
            this.context.client.removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        }

        window.removeEventListener("beforeunload", this.onPageUnload);

        this.context.roomViewStore.off(UPDATE_EVENT, this.onRoomViewStoreUpdate);

        this.context.rightPanelStore.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        WidgetEchoStore.removeListener(UPDATE_EVENT, this.onWidgetEchoStoreUpdate);
        this.context.widgetStore.removeListener(UPDATE_EVENT, this.onWidgetStoreUpdate);

        this.props.resizeNotifier.off("isResizing", this.onIsResizing);

        if (this.state.room) {
            this.context.widgetLayoutStore.off(
                WidgetLayoutStore.emissionForRoom(this.state.room),
                this.onWidgetLayoutChange,
            );
        }

        this.context.legacyCallHandler.off(LegacyCallHandlerEvent.CallState, this.onCallState);

        // cancel any pending calls to the throttled updated
        this.updateRoomMembers.cancel();

        for (const watcher of this.settingWatchers) {
            SettingsStore.unwatchSetting(watcher);
        }

        if (this.viewsLocalRoom && this.state.room) {
            // clean up if this was a local room
            this.context.client?.store.removeRoom(this.state.room.roomId);
        }
    }

    private onRightPanelStoreUpdate = (): void => {
        const { roomId } = this.state;
        this.setState({
            showRightPanel: roomId ? this.context.rightPanelStore.isOpenForRoom(roomId) : false,
        });
    };

    private onPageUnload = (event: BeforeUnloadEvent): string | undefined => {
        if (ContentMessages.sharedInstance().getCurrentUploads().length > 0) {
            return (event.returnValue = _t("quit_warning|file_upload_in_progress"));
        } else if (this.getCallForRoom() && this.state.callState !== "ended") {
            return (event.returnValue = _t("quit_warning|call_in_progress"));
        }
    };

    private onReactKeyDown = (ev: React.KeyboardEvent): void => {
        let handled = false;

        const action = getKeyBindingsManager().getRoomAction(ev);
        switch (action) {
            case KeyBindingAction.DismissReadMarker:
                this.messagePanel?.forgetReadMarker();
                this.jumpToLiveTimeline();
                handled = true;
                break;
            case KeyBindingAction.JumpToOldestUnread:
                this.jumpToReadMarker();
                handled = true;
                break;
            case KeyBindingAction.UploadFile: {
                defaultDispatcher.dispatch(
                    {
                        action: "upload_file",
                        context: TimelineRenderingType.Room,
                    },
                    true,
                );
                handled = true;
                break;
            }
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    };

    private onCallState = (roomId: string | null): void => {
        // don't filter out payloads for room IDs other than props.room because
        // we may be interested in the conf 1:1 room

        if (!roomId) return;
        const call = this.getCallForRoom();
        this.setState({ callState: call?.state });
    };

    private onAction = async (payload: ActionPayload): Promise<void> => {
        if (!this.context.client) return;
        switch (payload.action) {
            case "message_sent":
                this.checkDesktopNotifications();
                break;
            case "post_sticker_message":
                this.injectSticker(
                    payload.data.content.url,
                    payload.data.content.info,
                    payload.data.description || payload.data.name,
                    payload.data.threadId,
                );
                break;
            case "picture_snapshot": {
                const roomId = this.getRoomId();
                if (isNotUndefined(roomId)) {
                    ContentMessages.sharedInstance().sendContentListToRoom(
                        [payload.file],
                        roomId,
                        undefined,
                        this.context.client,
                    );
                }

                break;
            }
            case "notifier_enabled":
            case Action.UploadStarted:
            case Action.UploadFinished:
            case Action.UploadCanceled:
                this.forceUpdate();
                break;
            case "appsDrawer":
                this.setState({
                    showApps: payload.show,
                });
                break;
            case "reply_to_event":
                if (
                    !this.unmounted &&
                    this.state.search &&
                    payload.event?.getRoomId() === this.state.roomId &&
                    payload.context === TimelineRenderingType.Search
                ) {
                    this.onCancelSearchClick();
                    // we don't need to re-dispatch as RoomViewStore knows to persist with context=Search also
                }
                break;
            case "MatrixActions.sync":
                if (!this.state.matrixClientIsReady) {
                    const isReadyNow = Boolean(this.context.client?.isInitialSyncComplete());
                    this.setState(
                        {
                            matrixClientIsReady: isReadyNow,
                        },
                        () => {
                            // send another "initial" RVS update to trigger peeking if needed
                            if (isReadyNow) this.onRoomViewStoreUpdate(true);
                        },
                    );
                }
                break;

            case "local_room_event":
                this.onLocalRoomEvent(payload.roomId);
                break;

            case Action.EditEvent: {
                // Quit early if we're trying to edit events in wrong rendering context
                if (payload.timelineRenderingType !== this.state.timelineRenderingType) return;
                if (payload.event && payload.event.getRoomId() !== this.state.roomId) {
                    // If the event is in a different room (e.g. because the event to be edited is being displayed
                    // in the results of an all-rooms search), we need to view that room first.
                    defaultDispatcher.dispatch<ViewRoomPayload>({
                        action: Action.ViewRoom,
                        room_id: payload.event.getRoomId(),
                        metricsTrigger: undefined,
                        deferred_action: payload,
                    });
                    return;
                }

                const editState = payload.event ? new EditorStateTransfer(payload.event) : undefined;
                this.setState(
                    {
                        editState,
                        // If a search is active (implying that the "edit" button has been pressed on one of the
                        // events in the search result), we need to close that search, because RoomSearchView
                        // doesn't handle editing and won't render the composer.
                        search: undefined,
                    },
                    () => {
                        if (payload.event) {
                            this.messagePanel?.scrollToEventIfNeeded(payload.event.getId());
                        }
                    },
                );
                break;
            }

            case Action.ComposerInsert: {
                if (payload.composerType) break;

                let timelineRenderingType: TimelineRenderingType = payload.timelineRenderingType;
                // ThreadView handles Action.ComposerInsert itself due to it having its own editState
                if (timelineRenderingType === TimelineRenderingType.Thread) break;
                if (
                    this.state.timelineRenderingType === TimelineRenderingType.Search &&
                    payload.timelineRenderingType === TimelineRenderingType.Search
                ) {
                    // we don't have the composer rendered in this state, so bring it back first
                    await this.onCancelSearchClick();
                    timelineRenderingType = TimelineRenderingType.Room;
                }

                // re-dispatch to the correct composer
                defaultDispatcher.dispatch<ComposerInsertPayload>({
                    ...(payload as ComposerInsertPayload),
                    timelineRenderingType,
                    composerType: this.state.editState ? ComposerType.Edit : ComposerType.Send,
                });
                break;
            }

            case Action.FocusAComposer: {
                defaultDispatcher.dispatch<FocusComposerPayload>({
                    ...(payload as FocusComposerPayload),
                    // re-dispatch to the correct composer (the send message will still be on screen even when editing a message)
                    action: this.state.editState ? Action.FocusEditMessageComposer : Action.FocusSendMessageComposer,
                });
                break;
            }

            case "scroll_to_bottom":
                if (payload.timelineRenderingType === TimelineRenderingType.Room) {
                    this.messagePanel?.jumpToLiveTimeline();
                }
                break;
            case Action.ViewUser:
                if (payload.member) {
                    if (payload.push) {
                        RightPanelStore.instance.pushCard({
                            phase: RightPanelPhases.MemberInfo,
                            state: { member: payload.member },
                        });
                    } else {
                        RightPanelStore.instance.setCards([
                            { phase: RightPanelPhases.RoomSummary },
                            { phase: RightPanelPhases.MemberList },
                            { phase: RightPanelPhases.MemberInfo, state: { member: payload.member } },
                        ]);
                    }
                } else {
                    RightPanelStore.instance.showOrHidePhase(RightPanelPhases.MemberList);
                }
                break;
            case Action.View3pidInvite:
                onView3pidInvite(payload, RightPanelStore.instance);
                break;
        }
    };

    private onLocalRoomEvent(roomId: string): void {
        if (!this.context.client || !this.state.room || roomId !== this.state.room.roomId) return;
        createRoomFromLocalRoom(this.context.client, this.state.room as LocalRoom);
    }

    private onRoomTimeline = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (this.unmounted) return;

        // ignore events for other rooms or the notification timeline set
        if (!room || room.roomId !== this.state.room?.roomId) return;

        // ignore events from filtered timelines
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;

        if (ev.getType() === "org.matrix.room.preview_urls") {
            this.updatePreviewUrlVisibility(room);
        }

        if (ev.getType() === "m.room.encryption") {
            this.updateE2EStatus(room);
            this.updatePreviewUrlVisibility(room);
        }

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data?.liveEvent) return;

        // no point handling anything while we're waiting for the join to finish:
        // we'll only be showing a spinner.
        if (this.state.joining) return;

        if (!ev.isBeingDecrypted() && !ev.isDecryptionFailure()) {
            this.handleEffects(ev);
        }

        if (this.context.client && ev.getSender() !== this.context.client.getSafeUserId()) {
            // update unread count when scrolled up
            if (!this.state.search && this.state.atEndOfLiveTimeline) {
                // no change
            } else if (!shouldHideEvent(ev, this.state)) {
                this.setState((state) => {
                    return { numUnreadMessages: state.numUnreadMessages + 1 };
                });
            }
        }
    };

    private onEventDecrypted = (ev: MatrixEvent): void => {
        if (!this.state.room || !this.state.matrixClientIsReady) return; // not ready at all
        if (ev.getRoomId() !== this.state.room.roomId) return; // not for us
        if (ev.isDecryptionFailure()) return;
        this.handleEffects(ev);
    };

    private handleEffects = (ev: MatrixEvent): void => {
        if (!this.state.room) return;
        const notifState = this.context.roomNotificationStateStore.getRoomState(this.state.room);
        if (!notifState.isUnread) return;

        CHAT_EFFECTS.forEach((effect) => {
            if (containsEmoji(ev.getContent(), effect.emojis) || ev.getContent().msgtype === effect.msgType) {
                // For initial threads launch, chat effects are disabled see #19731
                if (!ev.isRelation(THREAD_RELATION_TYPE.name)) {
                    defaultDispatcher.dispatch({ action: `effects.${effect.command}`, event: ev });
                }
            }
        });
    };

    private onRoomName = (room: Room): void => {
        if (this.state.room && room.roomId == this.state.room.roomId) {
            this.forceUpdate();
        }
    };

    private onKeyBackupStatus = (): void => {
        // Key backup status changes affect whether the in-room recovery
        // reminder is displayed.
        this.forceUpdate();
    };

    public canResetTimeline = (): boolean => {
        if (!this.messagePanel) {
            return true;
        }
        return this.messagePanel.canResetTimeline();
    };

    private loadVirtualRoom = async (room?: Room): Promise<void> => {
        const virtualRoom = room?.roomId && (await VoipUserMapper.sharedInstance().getVirtualRoomForRoom(room?.roomId));

        this.setState({ virtualRoom: virtualRoom || undefined });
    };

    // called when state.room is first initialised (either at initial load,
    // after a successful peek, or after we join the room).
    private onRoomLoaded = (room: Room): void => {
        if (this.unmounted) return;
        // Attach a widget store listener only when we get a room
        this.context.widgetLayoutStore.on(WidgetLayoutStore.emissionForRoom(room), this.onWidgetLayoutChange);

        this.calculatePeekRules(room);
        this.loadMembersIfJoined(room);
        this.calculateRecommendedVersion(room);
        this.updatePermissions(room);
        this.checkWidgets(room);
        this.loadVirtualRoom(room);
        this.updateRoomEncrypted(room);

        if (
            this.getMainSplitContentType(room) !== MainSplitContentType.Timeline &&
            this.context.roomNotificationStateStore.getRoomState(room).isUnread
        ) {
            // Automatically open the chat panel to make unread messages easier to discover
            this.context.rightPanelStore.setCard({ phase: RightPanelPhases.Timeline }, true, room.roomId);
        }

        this.setState({
            tombstone: this.getRoomTombstone(room),
            liveTimeline: room.getLiveTimeline(),
        });

        defaultDispatcher.dispatch<ActionPayload>({ action: Action.RoomLoaded });
    };

    private onRoomTimelineReset = (room?: Room): void => {
        if (room && room.roomId === this.state.room?.roomId && room.getLiveTimeline() !== this.state.liveTimeline) {
            logger.log(`Live timeline of ${room.roomId} was reset`);
            this.setState({ liveTimeline: room.getLiveTimeline() });
        }
    };

    private getRoomTombstone(room = this.state.room): MatrixEvent | undefined {
        return room?.currentState.getStateEvents(EventType.RoomTombstone, "") ?? undefined;
    }

    private async getIsRoomEncrypted(roomId = this.state.roomId): Promise<boolean> {
        const crypto = this.context.client?.getCrypto();
        if (!crypto || !roomId) return false;

        return await crypto.isEncryptionEnabledInRoom(roomId);
    }

    private async calculateRecommendedVersion(room: Room): Promise<void> {
        const upgradeRecommendation = await room.getRecommendedVersion();
        if (this.unmounted) return;
        this.setState({ upgradeRecommendation });
    }

    private async loadMembersIfJoined(room: Room): Promise<void> {
        // lazy load members if enabled
        if (this.context.client?.hasLazyLoadMembersEnabled()) {
            if (room && room.getMyMembership() === KnownMembership.Join) {
                try {
                    await room.loadMembersIfNeeded();
                    if (!this.unmounted) {
                        this.setState({ membersLoaded: true });
                    }
                } catch (err) {
                    const errorMessage =
                        `Fetching room members for ${room.roomId} failed.` + " Room members will appear incomplete.";
                    logger.error(errorMessage);
                    logger.error(err);
                }
            }
        }
    }

    private calculatePeekRules(room: Room): void {
        const historyVisibility = room.currentState.getStateEvents(EventType.RoomHistoryVisibility, "");
        this.setState({
            canPeek: historyVisibility?.getContent().history_visibility === HistoryVisibility.WorldReadable,
        });
    }

    private updatePreviewUrlVisibility(room: Room): void {
        this.setState(({ isRoomEncrypted }) => ({
            showUrlPreview: this.getPreviewUrlVisibility(room, isRoomEncrypted),
        }));
    }

    private getPreviewUrlVisibility({ roomId }: Room, isRoomEncrypted: boolean | null): boolean {
        const key = isRoomEncrypted ? "urlPreviewsEnabled_e2ee" : "urlPreviewsEnabled";
        return SettingsStore.getValue(key, roomId);
    }

    private onRoom = (room: Room): void => {
        if (!room || room.roomId !== this.state.roomId) {
            return;
        }

        // Detach the listener if the room is changing for some reason
        if (this.state.room) {
            this.context.widgetLayoutStore.off(
                WidgetLayoutStore.emissionForRoom(this.state.room),
                this.onWidgetLayoutChange,
            );
        }

        this.setState(
            {
                room: room,
            },
            () => {
                this.onRoomLoaded(room);
            },
        );
    };

    private onUserVerificationChanged = (userId: string): void => {
        const room = this.state.room;
        if (!room || !room.currentState.getMember(userId)) {
            return;
        }
        this.updateE2EStatus(room);
    };

    private onCrossSigningKeysChanged = (): void => {
        const room = this.state.room;
        if (room) {
            this.updateE2EStatus(room);
        }
    };

    private async updateE2EStatus(room: Room): Promise<void> {
        if (!this.context.client || !this.state.isRoomEncrypted) return;
        const e2eStatus = await this.cacheAndGetE2EStatus(room, this.context.client);
        if (this.unmounted) return;
        this.setState({ e2eStatus });
    }

    private async cacheAndGetE2EStatus(room: Room, client: MatrixClient): Promise<E2EStatus> {
        let e2eStatus = RoomView.e2eStatusCache.get(room.roomId);
        // set the state immediately then update, so we don't scare the user into thinking the room is unencrypted
        if (e2eStatus) this.setState({ e2eStatus });

        e2eStatus = await shieldStatusForRoom(client, room);
        RoomView.e2eStatusCache.set(room.roomId, e2eStatus);
        return e2eStatus;
    }

    private onUrlPreviewsEnabledChange = (): void => {
        if (this.state.room) {
            this.updatePreviewUrlVisibility(this.state.room);
        }
    };

    private onRoomStateEvents = async (ev: MatrixEvent, state: RoomState): Promise<void> => {
        // ignore if we don't have a room yet
        if (!this.state.room || this.state.room.roomId !== state.roomId || !this.context.client) return;

        switch (ev.getType()) {
            case EventType.RoomTombstone:
                this.setState({ tombstone: this.getRoomTombstone() });
                break;
            case EventType.RoomEncryption: {
                await this.updateRoomEncrypted();
                break;
            }
            default:
                this.updatePermissions(this.state.room);
        }
    };

    private async updateRoomEncrypted(room = this.state.room): Promise<void> {
        if (!room || !this.context.client) return;

        const isRoomEncrypted = await this.getIsRoomEncrypted(room.roomId);
        const newE2EStatus = isRoomEncrypted ? await this.cacheAndGetE2EStatus(room, this.context.client) : null;

        this.setState({
            isRoomEncrypted,
            showUrlPreview: this.getPreviewUrlVisibility(room, isRoomEncrypted),
            ...(newE2EStatus && { e2eStatus: newE2EStatus }),
        });
    }

    private onRoomStateUpdate = (state: RoomState): void => {
        // ignore members in other rooms
        if (state.roomId !== this.state.room?.roomId) {
            return;
        }

        this.updateRoomMembers();
    };

    private onMyMembership = (room: Room): void => {
        if (room.roomId === this.state.roomId) {
            this.forceUpdate();
            this.loadMembersIfJoined(room);
            this.updatePermissions(room);
        }
    };

    private updatePermissions(room: Room): void {
        if (room && this.context.client) {
            const me = this.context.client.getSafeUserId();
            const canReact =
                room.getMyMembership() === KnownMembership.Join &&
                room.currentState.maySendEvent(EventType.Reaction, me);
            const canSendMessages = room.maySendMessage();
            const canSelfRedact = room.currentState.maySendEvent(EventType.RoomRedaction, me);

            this.setState({
                canReact,
                canSendMessages,
                canSelfRedact,
            });
        }
    }

    // rate limited because a power level change will emit an event for every member in the room.
    private updateRoomMembers = throttle(
        () => {
            if (!this.state.room) return;
            this.updateDMState();
            this.updateE2EStatus(this.state.room);
        },
        500,
        { leading: true, trailing: true },
    );

    private checkDesktopNotifications(): void {
        if (!this.state.room) return;
        const memberCount = this.state.room.getJoinedMemberCount() + this.state.room.getInvitedMemberCount();
        // if they are not alone prompt the user about notifications so they don't miss replies
        if (memberCount > 1 && Notifier.shouldShowPrompt()) {
            showNotificationsToast(true);
        }
    }

    private updateDMState(): void {
        const room = this.state.room;
        if (room?.getMyMembership() != KnownMembership.Join) {
            return;
        }
        const dmInviter = room?.getDMInviter();
        if (dmInviter) {
            Rooms.setDMRoom(room.client, room.roomId, dmInviter);
        }
    }

    private onInviteClick = (): void => {
        // open the room inviter
        defaultDispatcher.dispatch({
            action: "view_invite",
            roomId: this.getRoomId(),
        });
    };

    private onJoinButtonClicked = (): void => {
        // If the user is a ROU, allow them to transition to a PWLU
        if (this.context.client?.isGuest()) {
            // Join this room once the user has registered and logged in
            // (If we failed to peek, we may not have a valid room object.)
            defaultDispatcher.dispatch<DoAfterSyncPreparedPayload<ViewRoomPayload>>({
                action: Action.DoAfterSyncPrepared,
                deferred_action: {
                    action: Action.ViewRoom,
                    room_id: this.getRoomId(),
                    metricsTrigger: undefined,
                },
            });
            defaultDispatcher.dispatch({ action: "require_registration" });
        } else {
            Promise.resolve().then(() => {
                const signUrl = this.props.threepidInvite?.signUrl;
                const roomId = this.getRoomId();
                if (isNotUndefined(roomId)) {
                    defaultDispatcher.dispatch<JoinRoomPayload>({
                        action: Action.JoinRoom,
                        roomId,
                        opts: { inviteSignUrl: signUrl },
                        metricsTrigger:
                            this.state.room?.getMyMembership() === KnownMembership.Invite ? "Invite" : "RoomPreview",
                        canAskToJoin: this.state.canAskToJoin,
                    });
                }

                return Promise.resolve();
            });
        }
    };

    private onMessageListScroll = (): void => {
        if (this.messagePanel?.isAtEndOfLiveTimeline()) {
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

    private resetJumpToEvent = (eventId?: string): void => {
        if (
            this.state.initialEventId &&
            this.state.initialEventScrollIntoView &&
            this.state.initialEventId === eventId
        ) {
            debuglog("Removing scroll_into_view flag from initial event");
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: this.getRoomId(),
                event_id: this.state.initialEventId,
                highlighted: this.state.isInitialEventHighlighted,
                scroll_into_view: false,
                replyingToEvent: this.state.replyToEvent,
                metricsTrigger: undefined, // room doesn't change
            });
        }
    };

    private injectSticker(url: string, info: object, text: string, threadId: string | null): void {
        const roomId = this.getRoomId();
        if (!this.context.client || !roomId) return;
        if (this.context.client.isGuest()) {
            defaultDispatcher.dispatch({ action: "require_registration" });
            return;
        }

        ContentMessages.sharedInstance()
            .sendStickerContentToRoom(url, roomId, threadId, info, text, this.context.client)
            .then(undefined, (error) => {
                if (error.name === "UnknownDeviceError") {
                    // Let the staus bar handle this
                    return;
                }
            });
    }

    private onSearch = (term: string, scope = SearchScope.Room): void => {
        const roomId = scope === SearchScope.Room ? this.getRoomId() : undefined;
        debuglog("sending search request");
        const abortController = new AbortController();
        const promise = eventSearch(this.context.client!, term, roomId, abortController.signal);

        this.setState({
            timelineRenderingType: TimelineRenderingType.Search,
            search: {
                // make sure that we don't end up showing results from
                // an aborted search by keeping a unique id.
                searchId: new Date().getTime(),
                roomId,
                term,
                scope,
                promise,
                abortController,
            },
        });
    };

    private onSearchScopeChange = (scope: SearchScope): void => {
        this.onSearch(this.state.search?.term ?? "", scope);
    };

    private onSearchUpdate = (inProgress: boolean, searchResults: ISearchResults | null): void => {
        this.setState({
            search: {
                ...this.state.search!,
                count: searchResults?.count,
                inProgress,
            },
        });
    };

    private onForgetClick = (): void => {
        defaultDispatcher.dispatch({
            action: "forget_room",
            room_id: this.getRoomId(),
        });
    };

    private onDeclineAndBlockButtonClicked = async (): Promise<void> => {
        if (!this.state.room || !this.context.client) return;
        const [shouldReject, ignoreUser, reportRoom] = await Modal.createDialog(DeclineAndBlockInviteDialog, {
            roomName: this.state.room.name,
        }).finished;
        if (!shouldReject) {
            return;
        }

        this.setState({
            rejecting: true,
        });

        const actions: Promise<unknown>[] = [];

        if (ignoreUser) {
            const myMember = this.state.room.getMember(this.context.client!.getSafeUserId());
            const inviteEvent = myMember!.events.member;
            const ignoredUsers = this.context.client.getIgnoredUsers();
            ignoredUsers.push(inviteEvent!.getSender()!); // de-duped internally in the js-sdk
            actions.push(this.context.client.setIgnoredUsers(ignoredUsers));
        }

        if (reportRoom !== false) {
            actions.push(this.context.client.reportRoom(this.state.room.roomId, reportRoom));
        }

        actions.push(this.context.client.leave(this.state.room.roomId));
        try {
            await Promise.all(actions);
            defaultDispatcher.dispatch({ action: Action.ViewHomePage });
            this.setState({
                rejecting: false,
            });
        } catch (error) {
            logger.error(`Failed to reject invite: ${error}`);

            const msg = error instanceof Error ? error.message : JSON.stringify(error);
            Modal.createDialog(ErrorDialog, {
                title: _t("room|failed_reject_invite"),
                description: msg,
            });

            this.setState({
                rejecting: false,
            });
        }
    };

    private onDeclineButtonClicked = async (): Promise<void> => {
        if (!this.state.room || !this.context.client) {
            return;
        }
        try {
            await this.context.client.leave(this.state.room.roomId);
            defaultDispatcher.dispatch({ action: Action.ViewHomePage });
            this.setState({
                rejecting: false,
            });
        } catch (error) {
            logger.error(`Failed to reject invite: ${error}`);

            const msg = error instanceof Error ? error.message : JSON.stringify(error);
            Modal.createDialog(ErrorDialog, {
                title: _t("room|failed_reject_invite"),
                description: msg,
            });

            this.setState({
                rejecting: false,
            });
        }
    };

    private onRejectThreepidInviteButtonClicked = (): void => {
        // We can reject 3pid invites in the same way that we accept them,
        // using /leave rather than /join. In the short term though, we
        // just ignore them.
        // https://github.com/vector-im/vector-web/issues/1134
        defaultDispatcher.fire(Action.ViewRoomDirectory);
    };

    private onSearchChange = debounce((e: ChangeEvent): void => {
        const term = (e.target as HTMLInputElement).value;
        this.onSearch(term);
    }, 300);

    private onCancelSearchClick = (): Promise<void> => {
        return new Promise<void>((resolve) => {
            this.setState(
                {
                    timelineRenderingType: TimelineRenderingType.Room,
                    search: undefined,
                },
                resolve,
            );
        });
    };

    // jump down to the bottom of this room, where new events are arriving
    private jumpToLiveTimeline = (): void => {
        if (this.state.initialEventId && this.state.isInitialEventHighlighted) {
            // If we were viewing a highlighted event, firing view_room without
            // an event will take care of both clearing the URL fragment and
            // jumping to the bottom
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: this.getRoomId(),
                metricsTrigger: undefined, // room doesn't change
            });
        } else {
            // Otherwise we have to jump manually
            this.messagePanel?.jumpToLiveTimeline();
            defaultDispatcher.fire(Action.FocusSendMessageComposer);
        }
    };

    // jump up to wherever our read marker is
    private jumpToReadMarker = (): void => {
        this.messagePanel?.jumpToReadMarker();
    };

    // update the read marker to match the read-receipt
    private forgetReadMarker = (ev: ButtonEvent): void => {
        ev.stopPropagation();
        this.messagePanel?.forgetReadMarker();
    };

    // decide whether or not the top 'unread messages' bar should be shown
    private updateTopUnreadMessagesBar = (): void => {
        if (!this.messagePanel) {
            return;
        }

        const showBar = this.messagePanel.canJumpToReadMarker();
        if (this.state.showTopUnreadMessagesBar != showBar) {
            this.setState({ showTopUnreadMessagesBar: showBar });
        }
    };

    // get the current scroll position of the room, so that it can be
    // restored when we switch back to it.
    //
    private getScrollState(): ScrollState | null {
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

    private onStatusBarVisible = (): void => {
        if (this.unmounted || this.state.statusBarVisible) return;
        this.setState({ statusBarVisible: true });
    };

    private onStatusBarHidden = (): void => {
        // This is currently not desired as it is annoying if it keeps expanding and collapsing
        if (this.unmounted || !this.state.statusBarVisible) return;
        this.setState({ statusBarVisible: false });
    };

    /**
     * called by the parent component when PageUp/Down/etc is pressed.
     *
     * We pass it down to the scroll panel.
     */
    public handleScrollKey = (ev: React.KeyboardEvent | KeyboardEvent): void => {
        let panel: ScrollPanel | TimelinePanel | undefined;
        if (this.searchResultsPanel.current) {
            panel = this.searchResultsPanel.current;
        } else if (this.messagePanel) {
            panel = this.messagePanel;
        }

        panel?.handleScrollKey(ev);
    };

    /**
     * get any current call for this room
     */
    private getCallForRoom(): MatrixCall | null {
        if (!this.state.room) {
            return null;
        }
        return this.context.legacyCallHandler.getCallForRoom(this.state.room.roomId);
    }

    // this has to be a proper method rather than an unnamed function,
    // otherwise react calls it with null on each update.
    private gatherTimelinePanelRef = (r: TimelinePanel | null): void => {
        this.messagePanel = r;
    };

    private getOldRoom(): Room | null {
        const { roomId } = this.state.room?.findPredecessor(this.state.msc3946ProcessDynamicPredecessor) || {};
        return this.context.client?.getRoom(roomId) || null;
    }

    public getHiddenHighlightCount(): number {
        const oldRoom = this.getOldRoom();
        if (!oldRoom) return 0;
        return oldRoom.getUnreadNotificationCount(NotificationCountType.Highlight);
    }

    public onHiddenHighlightsClick = (): void => {
        const oldRoom = this.getOldRoom();
        if (!oldRoom) return;
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: oldRoom.roomId,
            metricsTrigger: "Predecessor",
        });
    };

    private get messagePanelClassNames(): string {
        return classNames("mx_RoomView_messagePanel", {
            mx_IRCLayout: this.state.layout === Layout.IRC,
        });
    }

    private onFileDrop = async (dataTransfer: DataTransfer): Promise<void> => {
        const roomId = this.getRoomId();
        if (!roomId || !this.context.client) return;
        await ContentMessages.sharedInstance().sendContentListToRoom(
            Array.from(dataTransfer.files),
            roomId,
            undefined,
            this.context.client,
            TimelineRenderingType.Room,
        );
    };

    private onMeasurement = (narrow: boolean): void => {
        this.setState({ narrow });
    };

    private get viewsLocalRoom(): boolean {
        return isLocalRoom(this.state.room);
    }

    private get permalinkCreator(): RoomPermalinkCreator {
        return this.getPermalinkCreatorForRoom();
    }

    private renderLocalRoomCreateLoader(localRoom: LocalRoom): ReactNode {
        if (!this.state.room || !this.context?.client) return null;
        const names = this.state.room.getDefaultRoomName(this.context.client.getSafeUserId());
        return (
            <ScopedRoomContextProvider {...this.state}>
                <LocalRoomCreateLoader
                    localRoom={localRoom}
                    names={names}
                    resizeNotifier={this.props.resizeNotifier}
                    mainSplitContentType={this.state.mainSplitContentType}
                />
            </ScopedRoomContextProvider>
        );
    }

    private renderLocalRoomView(localRoom: LocalRoom): ReactNode {
        return (
            <ScopedRoomContextProvider {...this.state}>
                <LocalRoomView
                    localRoom={localRoom}
                    resizeNotifier={this.props.resizeNotifier}
                    permalinkCreator={this.permalinkCreator}
                    roomView={this.roomView}
                    onFileDrop={this.onFileDrop}
                    mainSplitContentType={this.state.mainSplitContentType}
                />
            </ScopedRoomContextProvider>
        );
    }

    private renderWaitingForThirdPartyRoomView(inviteEvent: MatrixEvent): ReactNode {
        return (
            <ScopedRoomContextProvider {...this.state}>
                <WaitingForThirdPartyRoomView
                    resizeNotifier={this.props.resizeNotifier}
                    roomView={this.roomView}
                    inviteEvent={inviteEvent}
                />
            </ScopedRoomContextProvider>
        );
    }

    /**
     * Handles the submission of a request to join a room.
     *
     * @param {string} reason - An optional reason for the request to join.
     * @returns {void}
     */
    private onSubmitAskToJoin = (reason?: string): void => {
        const roomId = this.getRoomId();

        if (isNotUndefined(roomId)) {
            defaultDispatcher.dispatch<SubmitAskToJoinPayload>({
                action: Action.SubmitAskToJoin,
                roomId,
                opts: { reason },
            });
        }
    };

    /**
     * Handles the cancellation of a request to join a room.
     *
     * @returns {void}
     */
    private onCancelAskToJoin = (): void => {
        const roomId = this.getRoomId();

        if (isNotUndefined(roomId)) {
            defaultDispatcher.dispatch<CancelAskToJoinPayload>({
                action: Action.CancelAskToJoin,
                roomId,
            });
        }
    };

    public render(): ReactNode {
        if (!this.context.client) return null;
        const { isRoomEncrypted } = this.state;
        const isRoomEncryptionLoading = isRoomEncrypted === null;

        if (this.state.room instanceof LocalRoom) {
            if (this.state.room.state === LocalRoomState.CREATING) {
                return this.renderLocalRoomCreateLoader(this.state.room);
            }

            return this.renderLocalRoomView(this.state.room);
        }

        if (this.state.room) {
            const { shouldEncrypt, inviteEvent } = shouldEncryptRoomWithSingle3rdPartyInvite(this.state.room);

            if (shouldEncrypt) {
                return this.renderWaitingForThirdPartyRoomView(inviteEvent);
            }
        }

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
                                roomId={this.state.roomId}
                            />
                        </ErrorBoundary>
                    </div>
                );
            } else {
                let inviterName: string | undefined;
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
                                onDeclineClick={this.onRejectThreepidInviteButtonClicked}
                                canPreview={false}
                                error={this.state.roomLoadError}
                                roomAlias={roomAlias}
                                joining={this.state.joining}
                                inviterName={inviterName}
                                invitedEmail={invitedEmail}
                                oobData={this.props.oobData}
                                signUrl={this.props.threepidInvite?.signUrl}
                                roomId={this.state.roomId}
                                promptAskToJoin={this.state.promptAskToJoin}
                                onSubmitAskToJoin={this.onSubmitAskToJoin}
                                onCancelAskToJoin={this.onCancelAskToJoin}
                            />
                        </ErrorBoundary>
                    </div>
                );
            }
        }

        const myMembership = this.state.room.getMyMembership();
        if (isVideoRoom(this.state.room) && myMembership !== KnownMembership.Join) {
            return (
                <ErrorBoundary>
                    <div className="mx_MainSplit">
                        <RoomPreviewCard
                            room={this.state.room}
                            onJoinButtonClicked={this.onJoinButtonClicked}
                            onRejectButtonClicked={this.onDeclineButtonClicked}
                        />
                    </div>
                    ;
                </ErrorBoundary>
            );
        }

        // SpaceRoomView handles invites itself
        if (myMembership === KnownMembership.Invite && !this.state.room.isSpaceRoom()) {
            if (this.state.joining || this.state.rejecting) {
                return (
                    <ErrorBoundary>
                        <RoomPreviewBar
                            canPreview={false}
                            error={this.state.roomLoadError}
                            joining={this.state.joining}
                            rejecting={this.state.rejecting}
                            roomId={this.state.roomId}
                        />
                    </ErrorBoundary>
                );
            } else {
                const myUserId = this.context.client.getSafeUserId();
                const myMember = this.state.room.getMember(myUserId);
                const inviteEvent = myMember ? myMember.events.member : null;
                let inviterName = _t("room|inviter_unknown");
                if (inviteEvent) {
                    inviterName = inviteEvent.sender?.name ?? inviteEvent.getSender()!;
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
                                onDeclineClick={this.onDeclineButtonClicked}
                                onDeclineAndBlockClick={this.onDeclineAndBlockButtonClicked}
                                promptRejectionOptions={true}
                                inviterName={inviterName}
                                canPreview={false}
                                joining={this.state.joining}
                                room={this.state.room}
                                roomId={this.state.roomId}
                            />
                        </ErrorBoundary>
                    </div>
                );
            }
        }

        if (
            this.state.canAskToJoin &&
            ([KnownMembership.Knock, KnownMembership.Leave] as Array<string>).includes(myMembership)
        ) {
            return (
                <div className="mx_RoomView">
                    <ErrorBoundary>
                        <RoomPreviewBar
                            onJoinClick={this.onJoinButtonClicked}
                            room={this.state.room}
                            canAskToJoinAndMembershipIsLeave={myMembership === KnownMembership.Leave}
                            promptAskToJoin={this.state.promptAskToJoin}
                            knocked={myMembership === KnownMembership.Knock}
                            onSubmitAskToJoin={this.onSubmitAskToJoin}
                            onCancelAskToJoin={this.onCancelAskToJoin}
                            onForgetClick={this.onForgetClick}
                        />
                    </ErrorBoundary>
                </div>
            );
        }

        // We have successfully loaded this room, and are not previewing.
        // Display the "normal" room view.

        let activeCall: MatrixCall | null = null;
        {
            // New block because this variable doesn't need to hang around for the rest of the function
            const call = this.getCallForRoom();
            if (call && this.state.callState !== "ended" && this.state.callState !== "ringing") {
                activeCall = call;
            }
        }

        let statusBar: JSX.Element | undefined;
        let isStatusAreaExpanded = true;

        if (ContentMessages.sharedInstance().getCurrentUploads().length > 0) {
            statusBar = <UploadBar room={this.state.room} />;
        } else if (!this.state.search) {
            isStatusAreaExpanded = this.state.statusBarVisible;
            statusBar = (
                <RoomStatusBar
                    room={this.state.room}
                    isPeeking={myMembership !== KnownMembership.Join}
                    onInviteClick={this.onInviteClick}
                    onVisible={this.onStatusBarVisible}
                    onHidden={this.onStatusBarHidden}
                />
            );
        }

        const statusBarAreaClass = classNames("mx_RoomView_statusArea", {
            mx_RoomView_statusArea_expanded: isStatusAreaExpanded,
        });

        // if statusBar does not exist then statusBarArea is blank and takes up unnecessary space on the screen
        // show statusBarArea only if statusBar is present
        const statusBarArea = statusBar && (
            <div role="region" className={statusBarAreaClass} aria-label={_t("a11y|room_status_bar")}>
                <div className="mx_RoomView_statusAreaBox">
                    <div className="mx_RoomView_statusAreaBox_line" />
                    {statusBar}
                </div>
            </div>
        );

        const roomVersionRecommendation = this.state.upgradeRecommendation;
        const showRoomUpgradeBar =
            roomVersionRecommendation &&
            roomVersionRecommendation.needsUpgrade &&
            this.state.room.userMayUpgradeRoom(this.context.client.getSafeUserId());

        const hiddenHighlightCount = this.getHiddenHighlightCount();

        let aux: JSX.Element | undefined;
        let previewBar;
        if (this.state.timelineRenderingType === TimelineRenderingType.Search) {
            if (!isRoomEncryptionLoading) {
                aux = (
                    <RoomSearchAuxPanel
                        searchInfo={this.state.search}
                        onCancelClick={this.onCancelSearchClick}
                        onSearchScopeChange={this.onSearchScopeChange}
                        isRoomEncrypted={isRoomEncrypted}
                    />
                );
            }
        } else if (showRoomUpgradeBar) {
            aux = <RoomUpgradeWarningBar room={this.state.room} />;
        } else if (myMembership !== KnownMembership.Join) {
            // We do have a room object for this room, but we're not currently in it.
            // We may have a 3rd party invite to it.
            let inviterName: string | undefined;
            if (this.props.oobData) {
                inviterName = this.props.oobData.inviterName;
            }
            const invitedEmail = this.props.threepidInvite?.toEmail;
            previewBar = (
                <RoomPreviewBar
                    onJoinClick={this.onJoinButtonClicked}
                    onForgetClick={this.onForgetClick}
                    onDeclineClick={this.onRejectThreepidInviteButtonClicked}
                    promptRejectionOptions={true}
                    joining={this.state.joining}
                    inviterName={inviterName}
                    invitedEmail={invitedEmail}
                    oobData={this.props.oobData}
                    canPreview={this.state.canPeek}
                    room={this.state.room}
                    roomId={this.state.roomId}
                />
            );
            if (!this.state.canPeek && !this.state.room?.isSpaceRoom()) {
                return <div className="mx_RoomView">{previewBar}</div>;
            }
        } else if (hiddenHighlightCount > 0) {
            aux = (
                <AccessibleButton
                    element="div"
                    className="mx_RoomView_auxPanel_hiddenHighlights"
                    onClick={this.onHiddenHighlightsClick}
                >
                    {_t("room|unread_notifications_predecessor", {
                        count: hiddenHighlightCount,
                    })}
                </AccessibleButton>
            );
        }

        if (this.state.room?.isSpaceRoom() && !this.props.forceTimeline) {
            return (
                <SpaceRoomView
                    space={this.state.room}
                    justCreatedOpts={this.props.justCreatedOpts}
                    resizeNotifier={this.props.resizeNotifier}
                    permalinkCreator={this.permalinkCreator}
                    onJoinButtonClicked={this.onJoinButtonClicked}
                    onRejectButtonClicked={
                        this.props.threepidInvite
                            ? this.onRejectThreepidInviteButtonClicked
                            : this.onDeclineButtonClicked
                    }
                />
            );
        }

        const auxPanel = (
            <AuxPanel
                room={this.state.room}
                userId={this.context.client.getSafeUserId()}
                showApps={this.state.showApps}
                resizeNotifier={this.props.resizeNotifier}
            >
                {aux}
            </AuxPanel>
        );

        const pinnedMessageBanner = (
            <PinnedMessageBanner
                room={this.state.room}
                permalinkCreator={this.permalinkCreator}
                resizeNotifier={this.props.resizeNotifier}
            />
        );

        let messageComposer;
        const showComposer =
            !isRoomEncryptionLoading &&
            // joined and not showing search results
            myMembership === KnownMembership.Join &&
            !this.state.search;
        if (showComposer) {
            messageComposer = (
                <MessageComposer
                    room={this.state.room}
                    e2eStatus={this.state.e2eStatus}
                    resizeNotifier={this.props.resizeNotifier}
                    replyToEvent={this.state.replyToEvent}
                    permalinkCreator={this.permalinkCreator}
                />
            );
        }

        // if we have search results, we keep the messagepanel (so that it preserves its
        // scroll state), but hide it.
        let searchResultsPanel;
        let hideMessagePanel = false;

        if (this.state.search) {
            searchResultsPanel = (
                <RoomSearchView
                    key={this.state.search.searchId}
                    ref={this.searchResultsPanel}
                    term={this.state.search.term}
                    scope={this.state.search.scope}
                    promise={this.state.search.promise}
                    abortController={this.state.search.abortController}
                    inProgress={!!this.state.search.inProgress}
                    resizeNotifier={this.props.resizeNotifier}
                    className={this.messagePanelClassNames}
                    onUpdate={this.onSearchUpdate}
                />
            );
            hideMessagePanel = true;
        }

        let highlightedEventId: string | undefined;
        if (this.state.isInitialEventHighlighted) {
            highlightedEventId = this.state.initialEventId;
        }

        let messagePanel: JSX.Element | undefined;
        if (!isRoomEncryptionLoading) {
            messagePanel = (
                <TimelinePanel
                    ref={this.gatherTimelinePanelRef}
                    timelineSet={this.state.room.getUnfilteredTimelineSet()}
                    overlayTimelineSet={this.state.virtualRoom?.getUnfilteredTimelineSet()}
                    overlayTimelineSetFilter={isCallEvent}
                    showReadReceipts={this.state.showReadReceipts}
                    manageReadReceipts={!this.state.isPeeking}
                    sendReadReceiptOnLoad={!this.state.wasContextSwitch}
                    manageReadMarkers={!this.state.isPeeking}
                    hidden={hideMessagePanel}
                    highlightedEventId={highlightedEventId}
                    eventId={this.state.initialEventId}
                    eventScrollIntoView={this.state.initialEventScrollIntoView}
                    eventPixelOffset={this.state.initialEventPixelOffset}
                    onScroll={this.onMessageListScroll}
                    onEventScrolledIntoView={this.resetJumpToEvent}
                    onReadMarkerUpdated={this.updateTopUnreadMessagesBar}
                    showUrlPreview={this.state.showUrlPreview}
                    className={this.messagePanelClassNames}
                    membersLoaded={this.state.membersLoaded}
                    permalinkCreator={this.permalinkCreator}
                    resizeNotifier={this.props.resizeNotifier}
                    showReactions={true}
                    layout={this.state.layout}
                    editState={this.state.editState}
                />
            );
        }

        let topUnreadMessagesBar: JSX.Element | undefined;
        // Do not show TopUnreadMessagesBar if we have search results showing, it makes no sense
        if (this.state.showTopUnreadMessagesBar && !this.state.search) {
            topUnreadMessagesBar = (
                <TopUnreadMessagesBar onScrollUpClick={this.jumpToReadMarker} onCloseClick={this.forgetReadMarker} />
            );
        }
        let jumpToBottom;
        // Do not show JumpToBottomButton if we have search results showing, it makes no sense
        if (this.state.atEndOfLiveTimeline === false && !this.state.search) {
            jumpToBottom = (
                <JumpToBottomButton
                    highlight={this.state.room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0}
                    numUnreadMessages={this.state.numUnreadMessages}
                    onScrollToBottomClick={this.jumpToLiveTimeline}
                />
            );
        }

        const showRightPanel = !isRoomEncryptionLoading && this.state.room && this.state.showRightPanel;

        const rightPanel = showRightPanel ? (
            <RightPanel
                room={this.state.room}
                resizeNotifier={this.props.resizeNotifier}
                permalinkCreator={this.permalinkCreator}
                e2eStatus={this.state.e2eStatus}
                onSearchChange={this.onSearchChange}
                onSearchCancel={this.onCancelSearchClick}
            />
        ) : undefined;

        const timelineClasses = classNames("mx_RoomView_timeline", {
            mx_RoomView_timeline_rr_enabled: this.state.showReadReceipts,
        });

        let { mainSplitContentType } = this.state;
        if (this.state.search) {
            // When in the middle of a search force the main split content type to timeline
            mainSplitContentType = MainSplitContentType.Timeline;
        }

        const mainClasses = classNames("mx_RoomView", {
            mx_RoomView_inCall: Boolean(activeCall),
            mx_RoomView_immersive: mainSplitContentType !== MainSplitContentType.Timeline,
        });

        const showChatEffects = SettingsStore.getValue("showChatEffects");

        let mainSplitBody: JSX.Element | undefined;
        let mainSplitContentClassName: string | undefined;
        // Decide what to show in the main split
        switch (mainSplitContentType) {
            case MainSplitContentType.Timeline:
                mainSplitContentClassName = "mx_MainSplit_timeline";
                mainSplitBody = (
                    <>
                        <Measured sensor={this.roomViewBody} onMeasurement={this.onMeasurement} />
                        {auxPanel}
                        {pinnedMessageBanner}
                        <main className={timelineClasses}>
                            <FileDropTarget parent={this.roomView.current} onFileDrop={this.onFileDrop} />
                            {topUnreadMessagesBar}
                            {jumpToBottom}
                            {messagePanel}
                            {searchResultsPanel}
                        </main>
                        {statusBarArea}
                        {previewBar}
                        {messageComposer}
                    </>
                );
                break;
            case MainSplitContentType.MaximisedWidget:
                mainSplitContentClassName = "mx_MainSplit_maximisedWidget";
                mainSplitBody = (
                    <>
                        <AppsDrawer
                            room={this.state.room}
                            userId={this.context.client.getSafeUserId()}
                            resizeNotifier={this.props.resizeNotifier}
                            showApps={true}
                            role="main"
                        />
                        {previewBar}
                    </>
                );
                break;
            case MainSplitContentType.Call: {
                mainSplitContentClassName = "mx_MainSplit_call";
                mainSplitBody = (
                    <>
                        <CallView
                            room={this.state.room}
                            resizing={this.state.resizing}
                            skipLobby={this.context.roomViewStore.skipCallLobby() ?? false}
                            role="main"
                            onClose={this.onCallClose}
                        />
                        {previewBar}
                    </>
                );
            }
        }
        const mainSplitContentClasses = classNames("mx_RoomView_body", mainSplitContentClassName);

        let sizeKey: string | undefined;
        let defaultSize: number | undefined;
        let analyticsRoomType: ComponentProps<typeof MainSplit>["analyticsRoomType"] = "other_room";
        if (this.state.mainSplitContentType !== MainSplitContentType.Timeline) {
            // Override defaults for video rooms where more space is needed for the chat timeline
            sizeKey = "wide";
            defaultSize = 420;
            analyticsRoomType =
                this.state.mainSplitContentType === MainSplitContentType.Call ? "video_room" : "maximised_widget";
        }

        return (
            <ScopedRoomContextProvider {...this.state}>
                <div className={mainClasses} ref={this.roomView} onKeyDown={this.onReactKeyDown}>
                    {showChatEffects && this.roomView.current && (
                        <EffectsOverlay roomWidth={this.roomView.current.offsetWidth} />
                    )}
                    <ErrorBoundary>
                        <MainSplit
                            panel={rightPanel}
                            resizeNotifier={this.props.resizeNotifier}
                            sizeKey={sizeKey}
                            defaultSize={defaultSize}
                            analyticsRoomType={analyticsRoomType}
                        >
                            <div
                                className={mainSplitContentClasses}
                                ref={this.roomViewBody}
                                data-layout={this.state.layout}
                            >
                                <RoomHeader
                                    room={this.state.room}
                                    additionalButtons={this.state.viewRoomOpts.buttons}
                                />
                                {mainSplitBody}
                            </div>
                        </MainSplit>
                    </ErrorBoundary>
                </div>
            </ScopedRoomContextProvider>
        );
    }
}
