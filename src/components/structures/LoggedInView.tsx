/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { ClipboardEvent } from 'react';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import classNames from 'classnames';
import { ISyncStateData, SyncState } from 'matrix-js-sdk/src/sync';
import { IUsageLimit } from 'matrix-js-sdk/src/@types/partials';

import { Key } from '../../Keyboard';
import PageTypes from '../../PageTypes';
import MediaDeviceHandler from '../../MediaDeviceHandler';
import { fixupColorFonts } from '../../utils/FontManager';
import dis from '../../dispatcher/dispatcher';
import { IMatrixClientCreds } from '../../MatrixClientPeg';
import SettingsStore from "../../settings/SettingsStore";
import ResizeHandle from '../views/elements/ResizeHandle';
import { CollapseDistributor, Resizer } from '../../resizer';
import MatrixClientContext from "../../contexts/MatrixClientContext";
import * as KeyboardShortcuts from "../../accessibility/KeyboardShortcuts";
import HomePage from "./HomePage";
import ResizeNotifier from "../../utils/ResizeNotifier";
import PlatformPeg from "../../PlatformPeg";
import { DefaultTagID } from "../../stores/room-list/models";
import { hideToast as hideServerLimitToast, showToast as showServerLimitToast } from "../../toasts/ServerLimitToast";
import { Action } from "../../dispatcher/actions";
import LeftPanel from "./LeftPanel";
import CallContainer from '../views/voip/CallContainer';
import { ViewRoomDeltaPayload } from "../../dispatcher/payloads/ViewRoomDeltaPayload";
import RoomListStore from "../../stores/room-list/RoomListStore";
import NonUrgentToastContainer from "./NonUrgentToastContainer";
import { ToggleRightPanelPayload } from "../../dispatcher/payloads/ToggleRightPanelPayload";
import { IOOBData, IThreepidInvite } from "../../stores/ThreepidInviteStore";
import Modal from "../../Modal";
import { ICollapseConfig } from "../../resizer/distributors/collapse";
import HostSignupContainer from '../views/host_signup/HostSignupContainer';
import { getKeyBindingsManager, NavigationAction, RoomAction } from '../../KeyBindingsManager';
import { IOpts } from "../../createRoom";
import SpacePanel from "../views/spaces/SpacePanel";
import { replaceableComponent } from "../../utils/replaceableComponent";
import CallHandler, { CallHandlerEvent } from '../../CallHandler';
import AudioFeedArrayForCall from '../views/voip/AudioFeedArrayForCall';
import { OwnProfileStore } from '../../stores/OwnProfileStore';
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import RoomView from './RoomView';
import ToastContainer from './ToastContainer';
import MyGroups from "./MyGroups";
import UserView from "./UserView";
import GroupView from "./GroupView";
import BackdropPanel from "./BackdropPanel";
import SpaceStore from "../../stores/spaces/SpaceStore";
import GroupFilterPanel from './GroupFilterPanel';
import CustomRoomTagPanel from './CustomRoomTagPanel';
import { mediaFromMxc } from "../../customisations/Media";
import LegacyCommunityPreview from "./LegacyCommunityPreview";

// We need to fetch each pinned message individually (if we don't already have it)
// so each pinned message may trigger a request. Limit the number per room for sanity.
// NB. this is just for server notices rather than pinned messages in general.
const MAX_PINNED_NOTICES_PER_ROOM = 2;

// Used to find the closest inputable thing. Because of how our composer works,
// your caret might be within a paragraph/font/div/whatever within the
// contenteditable rather than directly in something inputable.
function getInputableElement(el: HTMLElement): HTMLElement | null {
    return el.closest("input, textarea, select, [contenteditable=true]");
}

interface IProps {
    matrixClient: MatrixClient;
    // Called with the credentials of a registered user (if they were a ROU that
    // transitioned to PWLU)
    onRegistered: (credentials: IMatrixClientCreds) => Promise<MatrixClient>;
    hideToSRUsers: boolean;
    resizeNotifier: ResizeNotifier;
    // eslint-disable-next-line camelcase
    page_type?: string;
    autoJoin?: boolean;
    threepidInvite?: IThreepidInvite;
    roomOobData?: IOOBData;
    currentRoomId: string;
    collapseLhs: boolean;
    config: {
        piwik: {
            policyUrl: string;
        };
        [key: string]: any;
    };
    currentUserId?: string;
    currentGroupId?: string;
    currentGroupIsNew?: boolean;
    justRegistered?: boolean;
    roomJustCreatedOpts?: IOpts;
    forceTimeline?: boolean; // see props on MatrixChat
}

interface IState {
    syncErrorData?: ISyncStateData;
    usageLimitDismissed: boolean;
    usageLimitEventContent?: IUsageLimit;
    usageLimitEventTs?: number;
    useCompactLayout: boolean;
    activeCalls: Array<MatrixCall>;
    backgroundImage?: string;
}

/**
 * This is what our MatrixChat shows when we are logged in. The precise view is
 * determined by the page_type property.
 *
 * Currently, it's very tightly coupled with MatrixChat. We should try to do
 * something about that.
 *
 * Components mounted below us can access the matrix client via the react context.
 */
@replaceableComponent("structures.LoggedInView")
class LoggedInView extends React.Component<IProps, IState> {
    static displayName = 'LoggedInView';

    protected readonly _matrixClient: MatrixClient;
    protected readonly _roomView: React.RefObject<any>;
    protected readonly _resizeContainer: React.RefObject<HTMLDivElement>;
    protected readonly resizeHandler: React.RefObject<HTMLDivElement>;
    protected layoutWatcherRef: string;
    protected compactLayoutWatcherRef: string;
    protected backgroundImageWatcherRef: string;
    protected resizer: Resizer;

    constructor(props, context) {
        super(props, context);

        this.state = {
            syncErrorData: undefined,
            // use compact timeline view
            useCompactLayout: SettingsStore.getValue('useCompactLayout'),
            usageLimitDismissed: false,
            activeCalls: CallHandler.instance.getAllActiveCalls(),
        };

        // stash the MatrixClient in case we log out before we are unmounted
        this._matrixClient = this.props.matrixClient;

        MediaDeviceHandler.loadDevices();

        fixupColorFonts();

        this._roomView = React.createRef();
        this._resizeContainer = React.createRef();
        this.resizeHandler = React.createRef();
    }

    componentDidMount() {
        document.addEventListener('keydown', this.onNativeKeyDown, false);
        CallHandler.instance.addListener(CallHandlerEvent.CallState, this.onCallState);

        this.updateServerNoticeEvents();

        this._matrixClient.on("accountData", this.onAccountData);
        this._matrixClient.on("sync", this.onSync);
        // Call `onSync` with the current state as well
        this.onSync(
            this._matrixClient.getSyncState(),
            null,
            this._matrixClient.getSyncStateData(),
        );
        this._matrixClient.on("RoomState.events", this.onRoomStateEvents);

        this.layoutWatcherRef = SettingsStore.watchSetting("layout", null, this.onCompactLayoutChanged);
        this.compactLayoutWatcherRef = SettingsStore.watchSetting(
            "useCompactLayout", null, this.onCompactLayoutChanged,
        );
        this.backgroundImageWatcherRef = SettingsStore.watchSetting(
            "RoomList.backgroundImage", null, this.refreshBackgroundImage,
        );

        this.resizer = this.createResizer();
        this.resizer.attach();

        OwnProfileStore.instance.on(UPDATE_EVENT, this.refreshBackgroundImage);
        this.loadResizerPreferences();
        this.refreshBackgroundImage();
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onNativeKeyDown, false);
        CallHandler.instance.removeListener(CallHandlerEvent.CallState, this.onCallState);
        this._matrixClient.removeListener("accountData", this.onAccountData);
        this._matrixClient.removeListener("sync", this.onSync);
        this._matrixClient.removeListener("RoomState.events", this.onRoomStateEvents);
        OwnProfileStore.instance.off(UPDATE_EVENT, this.refreshBackgroundImage);
        SettingsStore.unwatchSetting(this.layoutWatcherRef);
        SettingsStore.unwatchSetting(this.compactLayoutWatcherRef);
        SettingsStore.unwatchSetting(this.backgroundImageWatcherRef);
        this.resizer.detach();
    }

    private onCallState = (): void => {
        const activeCalls = CallHandler.instance.getAllActiveCalls();
        if (activeCalls === this.state.activeCalls) return;
        this.setState({ activeCalls });
    };

    private refreshBackgroundImage = async (): Promise<void> => {
        let backgroundImage = SettingsStore.getValue("RoomList.backgroundImage");
        if (backgroundImage) {
            // convert to http before going much further
            backgroundImage = mediaFromMxc(backgroundImage).srcHttp;
        } else {
            backgroundImage = OwnProfileStore.instance.getHttpAvatarUrl();
        }
        this.setState({ backgroundImage });
    };

    public canResetTimelineInRoom = (roomId: string) => {
        if (!this._roomView.current) {
            return true;
        }
        return this._roomView.current.canResetTimeline();
    };

    private createResizer() {
        let panelSize;
        let panelCollapsed;
        const collapseConfig: ICollapseConfig = {
            // TODO decrease this once Spaces launches as it'll no longer need to include the 56px Community Panel
            toggleSize: 206 - 50,
            onCollapsed: (collapsed) => {
                panelCollapsed = collapsed;
                if (collapsed) {
                    dis.dispatch({ action: "hide_left_panel" });
                    window.localStorage.setItem("mx_lhs_size", '0');
                } else {
                    dis.dispatch({ action: "show_left_panel" });
                }
            },
            onResized: (size) => {
                panelSize = size;
                this.props.resizeNotifier.notifyLeftHandleResized();
            },
            onResizeStart: () => {
                this.props.resizeNotifier.startResizing();
            },
            onResizeStop: () => {
                if (!panelCollapsed) window.localStorage.setItem("mx_lhs_size", '' + panelSize);
                this.props.resizeNotifier.stopResizing();
            },
            isItemCollapsed: domNode => {
                return domNode.classList.contains("mx_LeftPanel_minimized");
            },
            handler: this.resizeHandler.current,
        };
        const resizer = new Resizer(this._resizeContainer.current, CollapseDistributor, collapseConfig);
        resizer.setClassNames({
            handle: "mx_ResizeHandle",
            vertical: "mx_ResizeHandle_vertical",
            reverse: "mx_ResizeHandle_reverse",
        });
        return resizer;
    }

    private loadResizerPreferences() {
        let lhsSize = parseInt(window.localStorage.getItem("mx_lhs_size"), 10);
        if (isNaN(lhsSize)) {
            lhsSize = 350;
        }
        this.resizer.forHandleWithId('lp-resizer').resize(lhsSize);
    }

    private onAccountData = (event: MatrixEvent) => {
        if (event.getType() === "m.ignored_user_list") {
            dis.dispatch({ action: "ignore_state_changed" });
        }
    };

    private onCompactLayoutChanged = () => {
        this.setState({
            useCompactLayout: SettingsStore.getValue("useCompactLayout"),
        });
    };

    private onSync = (syncState: SyncState, oldSyncState?: SyncState, data?: ISyncStateData): void => {
        const oldErrCode = this.state.syncErrorData?.error?.errcode;
        const newErrCode = data && data.error && data.error.errcode;
        if (syncState === oldSyncState && oldErrCode === newErrCode) return;

        this.setState({
            syncErrorData: syncState === SyncState.Error ? data : null,
        });

        if (oldSyncState === SyncState.Prepared && syncState === SyncState.Syncing) {
            this.updateServerNoticeEvents();
        } else {
            this.calculateServerLimitToast(this.state.syncErrorData, this.state.usageLimitEventContent);
        }
    };

    private onRoomStateEvents = (ev: MatrixEvent): void => {
        const serverNoticeList = RoomListStore.instance.orderedLists[DefaultTagID.ServerNotice];
        if (serverNoticeList && serverNoticeList.some(r => r.roomId === ev.getRoomId())) {
            this.updateServerNoticeEvents();
        }
    };

    private onUsageLimitDismissed = () => {
        this.setState({
            usageLimitDismissed: true,
        });
    };

    private calculateServerLimitToast(syncError: IState["syncErrorData"], usageLimitEventContent?: IUsageLimit) {
        const error = syncError && syncError.error && syncError.error.errcode === "M_RESOURCE_LIMIT_EXCEEDED";
        if (error) {
            usageLimitEventContent = syncError.error.data as IUsageLimit;
        }

        // usageLimitDismissed is true when the user has explicitly hidden the toast
        // and it will be reset to false if a *new* usage alert comes in.
        if (usageLimitEventContent && this.state.usageLimitDismissed) {
            showServerLimitToast(
                usageLimitEventContent.limit_type,
                this.onUsageLimitDismissed,
                usageLimitEventContent.admin_contact,
                error,
            );
        } else {
            hideServerLimitToast();
        }
    }

    private updateServerNoticeEvents = async () => {
        const serverNoticeList = RoomListStore.instance.orderedLists[DefaultTagID.ServerNotice];
        if (!serverNoticeList) return [];

        const events = [];
        let pinnedEventTs = 0;
        for (const room of serverNoticeList) {
            const pinStateEvent = room.currentState.getStateEvents("m.room.pinned_events", "");

            if (!pinStateEvent || !pinStateEvent.getContent().pinned) continue;
            pinnedEventTs = pinStateEvent.getTs();

            const pinnedEventIds = pinStateEvent.getContent().pinned.slice(0, MAX_PINNED_NOTICES_PER_ROOM);
            for (const eventId of pinnedEventIds) {
                const timeline = await this._matrixClient.getEventTimeline(room.getUnfilteredTimelineSet(), eventId);
                const event = timeline.getEvents().find(ev => ev.getId() === eventId);
                if (event) events.push(event);
            }
        }

        if (pinnedEventTs && this.state.usageLimitEventTs > pinnedEventTs) {
            // We've processed a newer event than this one, so ignore it.
            return;
        }

        const usageLimitEvent = events.find((e) => {
            return (
                e && e.getType() === 'm.room.message' &&
                e.getContent()['server_notice_type'] === 'm.server_notice.usage_limit_reached'
            );
        });
        const usageLimitEventContent = usageLimitEvent && usageLimitEvent.getContent();
        this.calculateServerLimitToast(this.state.syncErrorData, usageLimitEventContent);
        this.setState({
            usageLimitEventContent,
            usageLimitEventTs: pinnedEventTs,
            // This is a fresh toast, we can show toasts again
            usageLimitDismissed: false,
        });
    };

    private onPaste = (ev: ClipboardEvent) => {
        const element = ev.target as HTMLElement;
        const inputableElement = getInputableElement(element);

        if (inputableElement) {
            inputableElement.focus();
        } else {
            // refocusing during a paste event will make the
            // paste end up in the newly focused element,
            // so dispatch synchronously before paste happens
            dis.fire(Action.FocusSendMessageComposer, true);
        }
    };

    /*
    SOME HACKERY BELOW:
    React optimizes event handlers, by always attaching only 1 handler to the document for a given type.
    It then internally determines the order in which React event handlers should be called,
    emulating the capture and bubbling phases the DOM also has.

    But, as the native handler for React is always attached on the document,
    it will always run last for bubbling (first for capturing) handlers,
    and thus React basically has its own event phases, and will always run
    after (before for capturing) any native other event handlers (as they tend to be attached last).

    So ideally one wouldn't mix React and native event handlers to have bubbling working as expected,
    but we do need a native event handler here on the document,
    to get keydown events when there is no focused element (target=body).

    We also do need bubbling here to give child components a chance to call `stopPropagation()`,
    for keydown events it can handle itself, and shouldn't be redirected to the composer.

    So we listen with React on this component to get any events on focused elements, and get bubbling working as expected.
    We also listen with a native listener on the document to get keydown events when no element is focused.
    Bubbling is irrelevant here as the target is the body element.
    */
    private onReactKeyDown = (ev) => {
        // events caught while bubbling up on the root element
        // of this component, so something must be focused.
        this.onKeyDown(ev);
    };

    private onNativeKeyDown = (ev) => {
        // only pass this if there is no focused element.
        // if there is, onKeyDown will be called by the
        // react keydown handler that respects the react bubbling order.
        if (ev.target === document.body) {
            this.onKeyDown(ev);
        }
    };

    private onKeyDown = (ev) => {
        let handled = false;

        const roomAction = getKeyBindingsManager().getRoomAction(ev);
        switch (roomAction) {
            case RoomAction.ScrollUp:
            case RoomAction.RoomScrollDown:
            case RoomAction.JumpToFirstMessage:
            case RoomAction.JumpToLatestMessage:
                // pass the event down to the scroll panel
                this.onScrollKeyPressed(ev);
                handled = true;
                break;
            case RoomAction.FocusSearch:
                dis.dispatch({
                    action: 'focus_search',
                });
                handled = true;
                break;
        }
        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
            return;
        }

        const navAction = getKeyBindingsManager().getNavigationAction(ev);
        switch (navAction) {
            case NavigationAction.FocusRoomSearch:
                dis.dispatch({
                    action: 'focus_room_filter',
                });
                handled = true;
                break;
            case NavigationAction.ToggleUserMenu:
                dis.fire(Action.ToggleUserMenu);
                handled = true;
                break;
            case NavigationAction.ToggleShortCutDialog:
                KeyboardShortcuts.toggleDialog();
                handled = true;
                break;
            case NavigationAction.GoToHome:
                dis.dispatch({
                    action: 'view_home_page',
                });
                Modal.closeCurrentModal("homeKeyboardShortcut");
                handled = true;
                break;
            case NavigationAction.ToggleSpacePanel:
                dis.fire(Action.ToggleSpacePanel);
                handled = true;
                break;
            case NavigationAction.ToggleRoomSidePanel:
                if (this.props.page_type === "room_view" || this.props.page_type === "group_view") {
                    dis.dispatch<ToggleRightPanelPayload>({
                        action: Action.ToggleRightPanel,
                        type: this.props.page_type === "room_view" ? "room" : "group",
                    });
                    handled = true;
                }
                break;
            case NavigationAction.SelectPrevRoom:
                dis.dispatch<ViewRoomDeltaPayload>({
                    action: Action.ViewRoomDelta,
                    delta: -1,
                    unread: false,
                });
                handled = true;
                break;
            case NavigationAction.SelectNextRoom:
                dis.dispatch<ViewRoomDeltaPayload>({
                    action: Action.ViewRoomDelta,
                    delta: 1,
                    unread: false,
                });
                handled = true;
                break;
            case NavigationAction.SelectPrevUnreadRoom:
                dis.dispatch<ViewRoomDeltaPayload>({
                    action: Action.ViewRoomDelta,
                    delta: -1,
                    unread: true,
                });
                break;
            case NavigationAction.SelectNextUnreadRoom:
                dis.dispatch<ViewRoomDeltaPayload>({
                    action: Action.ViewRoomDelta,
                    delta: 1,
                    unread: true,
                });
                break;
            default:
                // if we do not have a handler for it, pass it to the platform which might
                handled = PlatformPeg.get().onKeyDown(ev);
        }
        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
            return;
        }

        const isModifier = ev.key === Key.ALT || ev.key === Key.CONTROL || ev.key === Key.META || ev.key === Key.SHIFT;
        if (!isModifier && !ev.ctrlKey && !ev.metaKey) {
            // The above condition is crafted to _allow_ characters with Shift
            // already pressed (but not the Shift key down itself).
            const isClickShortcut = ev.target !== document.body &&
                (ev.key === Key.SPACE || ev.key === Key.ENTER);

            // We explicitly allow alt to be held due to it being a common accent modifier.
            // XXX: Forwarding Dead keys in this way does not work as intended but better to at least
            // move focus to the composer so the user can re-type the dead key correctly.
            const isPrintable = ev.key.length === 1 || ev.key === "Dead";

            // If the user is entering a printable character outside of an input field
            // redirect it to the composer for them.
            if (!isClickShortcut && isPrintable && !getInputableElement(ev.target as HTMLElement)) {
                // synchronous dispatch so we focus before key generates input
                dis.fire(Action.FocusSendMessageComposer, true);
                ev.stopPropagation();
                // we should *not* preventDefault() here as that would prevent typing in the now-focused composer
            }
        }
    };

    /**
     * dispatch a page-up/page-down/etc to the appropriate component
     * @param {Object} ev The key event
     */
    private onScrollKeyPressed = (ev) => {
        if (this._roomView.current) {
            this._roomView.current.handleScrollKey(ev);
        }
    };

    render() {
        let pageElement;

        switch (this.props.page_type) {
            case PageTypes.RoomView:
                pageElement = <RoomView
                    ref={this._roomView}
                    onRegistered={this.props.onRegistered}
                    threepidInvite={this.props.threepidInvite}
                    oobData={this.props.roomOobData}
                    key={this.props.currentRoomId || 'roomview'}
                    resizeNotifier={this.props.resizeNotifier}
                    justCreatedOpts={this.props.roomJustCreatedOpts}
                    forceTimeline={this.props.forceTimeline}
                />;
                break;

            case PageTypes.MyGroups:
                pageElement = <MyGroups />;
                break;

            case PageTypes.RoomDirectory:
                // handled by MatrixChat for now
                break;

            case PageTypes.HomePage:
                pageElement = <HomePage justRegistered={this.props.justRegistered} />;
                break;

            case PageTypes.UserView:
                pageElement = <UserView userId={this.props.currentUserId} resizeNotifier={this.props.resizeNotifier} />;
                break;
            case PageTypes.GroupView:
                if (SpaceStore.spacesEnabled) {
                    pageElement = <LegacyCommunityPreview groupId={this.props.currentGroupId} />;
                } else {
                    pageElement = <GroupView
                        groupId={this.props.currentGroupId}
                        isNew={this.props.currentGroupIsNew}
                        resizeNotifier={this.props.resizeNotifier}
                    />;
                }
                break;
        }

        const wrapperClasses = classNames({
            'mx_MatrixChat_wrapper': true,
            'mx_MatrixChat_useCompactLayout': this.state.useCompactLayout,
        });
        const bodyClasses = classNames({
            'mx_MatrixChat': true,
            'mx_MatrixChat--with-avatar': this.state.backgroundImage,
        });

        const audioFeedArraysForCalls = this.state.activeCalls.map((call) => {
            return (
                <AudioFeedArrayForCall call={call} key={call.callId} />
            );
        });

        return (
            <MatrixClientContext.Provider value={this._matrixClient}>
                <div
                    onPaste={this.onPaste}
                    onKeyDown={this.onReactKeyDown}
                    className={wrapperClasses}
                    aria-hidden={this.props.hideToSRUsers}
                >
                    <ToastContainer />
                    <div className={bodyClasses}>
                        <div className='mx_LeftPanel_wrapper'>
                            { SettingsStore.getValue('TagPanel.enableTagPanel') &&
                                (<div className="mx_GroupFilterPanelContainer">
                                    <BackdropPanel
                                        blurMultiplier={0.5}
                                        backgroundImage={this.state.backgroundImage}
                                    />
                                    <GroupFilterPanel />
                                    { SettingsStore.getValue("feature_custom_tags") ? <CustomRoomTagPanel /> : null }
                                </div>)
                            }
                            { SpaceStore.spacesEnabled ? <>
                                <BackdropPanel
                                    blurMultiplier={0.5}
                                    backgroundImage={this.state.backgroundImage}
                                />
                                <SpacePanel />
                            </> : null }
                            <BackdropPanel
                                backgroundImage={this.state.backgroundImage}
                            />
                            <div
                                className="mx_LeftPanel_wrapper--user"
                                ref={this._resizeContainer}
                                data-collapsed={this.props.collapseLhs ? true : undefined}
                            >
                                <LeftPanel
                                    isMinimized={this.props.collapseLhs || false}
                                    resizeNotifier={this.props.resizeNotifier}
                                />
                            </div>
                        </div>
                        <ResizeHandle passRef={this.resizeHandler} id="lp-resizer" />
                        <div className="mx_RoomView_wrapper">
                            { pageElement }
                        </div>
                    </div>
                </div>
                <CallContainer />
                <NonUrgentToastContainer />
                <HostSignupContainer />
                { audioFeedArraysForCalls }
            </MatrixClientContext.Provider>
        );
    }
}

export default LoggedInView;
