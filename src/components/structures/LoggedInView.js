/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd

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

import * as Matrix from 'matrix-js-sdk';
import React from 'react';
import PropTypes from 'prop-types';
import { DragDropContext } from 'react-beautiful-dnd';

import { KeyCode, isOnlyCtrlOrCmdKeyEvent } from '../../Keyboard';
import Notifier from '../../Notifier';
import PageTypes from '../../PageTypes';
import CallMediaHandler from '../../CallMediaHandler';
import sdk from '../../index';
import dis from '../../dispatcher';
import sessionStore from '../../stores/SessionStore';
import MatrixClientPeg from '../../MatrixClientPeg';
import SettingsStore from "../../settings/SettingsStore";
import RoomListStore from "../../stores/RoomListStore";
import { getHomePageUrl } from '../../utils/pages';

import TagOrderActions from '../../actions/TagOrderActions';
import RoomListActions from '../../actions/RoomListActions';
import ResizeHandle from '../views/elements/ResizeHandle';
import {Resizer, CollapseDistributor} from '../../resizer';
// We need to fetch each pinned message individually (if we don't already have it)
// so each pinned message may trigger a request. Limit the number per room for sanity.
// NB. this is just for server notices rather than pinned messages in general.
const MAX_PINNED_NOTICES_PER_ROOM = 2;

/**
 * This is what our MatrixChat shows when we are logged in. The precise view is
 * determined by the page_type property.
 *
 * Currently it's very tightly coupled with MatrixChat. We should try to do
 * something about that.
 *
 * Components mounted below us can access the matrix client via the react context.
 */
const LoggedInView = React.createClass({
    displayName: 'LoggedInView',

    propTypes: {
        matrixClient: PropTypes.instanceOf(Matrix.MatrixClient).isRequired,
        page_type: PropTypes.string.isRequired,
        onRoomCreated: PropTypes.func,

        // Called with the credentials of a registered user (if they were a ROU that
        // transitioned to PWLU)
        onRegistered: PropTypes.func,
        collapsedRhs: PropTypes.bool,

        // Used by the RoomView to handle joining rooms
        viaServers: PropTypes.arrayOf(PropTypes.string),

        // and lots and lots of other stuff.
    },

    childContextTypes: {
        matrixClient: PropTypes.instanceOf(Matrix.MatrixClient),
        authCache: PropTypes.object,
    },

    getChildContext: function() {
        return {
            matrixClient: this._matrixClient,
            authCache: {
                auth: {},
                lastUpdate: 0,
            },
        };
    },

    getInitialState: function() {
        return {
            // use compact timeline view
            useCompactLayout: SettingsStore.getValue('useCompactLayout'),
            // any currently active server notice events
            serverNoticeEvents: [],
        };
    },

    componentDidMount: function() {
        this.resizer = this._createResizer();
        this.resizer.attach();
        this._loadResizerPreferences();
    },

    componentWillMount: function() {
        // stash the MatrixClient in case we log out before we are unmounted
        this._matrixClient = this.props.matrixClient;

        CallMediaHandler.loadDevices();

        document.addEventListener('keydown', this._onKeyDown);

        this._sessionStore = sessionStore;
        this._sessionStoreToken = this._sessionStore.addListener(
            this._setStateFromSessionStore,
        );
        this._setStateFromSessionStore();

        this._updateServerNoticeEvents();

        this._matrixClient.on("accountData", this.onAccountData);
        this._matrixClient.on("sync", this.onSync);
        this._matrixClient.on("RoomState.events", this.onRoomStateEvents);
    },

    componentWillUnmount: function() {
        document.removeEventListener('keydown', this._onKeyDown);
        this._matrixClient.removeListener("accountData", this.onAccountData);
        this._matrixClient.removeListener("sync", this.onSync);
        this._matrixClient.removeListener("RoomState.events", this.onRoomStateEvents);
        if (this._sessionStoreToken) {
            this._sessionStoreToken.remove();
        }
        this.resizer.detach();
    },

    // Child components assume that the client peg will not be null, so give them some
    // sort of assurance here by only allowing a re-render if the client is truthy.
    //
    // This is required because `LoggedInView` maintains its own state and if this state
    // updates after the client peg has been made null (during logout), then it will
    // attempt to re-render and the children will throw errors.
    shouldComponentUpdate: function() {
        return Boolean(MatrixClientPeg.get());
    },

    canResetTimelineInRoom: function(roomId) {
        if (!this.refs.roomView) {
            return true;
        }
        return this.refs.roomView.canResetTimeline();
    },

    _setStateFromSessionStore() {
        this.setState({
            userHasGeneratedPassword: Boolean(this._sessionStore.getCachedPassword()),
        });
    },

    _createResizer() {
        const classNames = {
            handle: "mx_ResizeHandle",
            vertical: "mx_ResizeHandle_vertical",
            reverse: "mx_ResizeHandle_reverse",
        };
        const collapseConfig = {
            toggleSize: 260 - 50,
            onCollapsed: (collapsed) => {
                if (collapsed) {
                    dis.dispatch({action: "hide_left_panel"}, true);
                    window.localStorage.setItem("mx_lhs_size", '0');
                } else {
                    dis.dispatch({action: "show_left_panel"}, true);
                }
            },
            onResized: (size) => {
                window.localStorage.setItem("mx_lhs_size", '' + size);
            },
        };
        const resizer = new Resizer(
            this.resizeContainer,
            CollapseDistributor,
            collapseConfig);
        resizer.setClassNames(classNames);
        return resizer;
    },

    _loadResizerPreferences() {
        let lhsSize = window.localStorage.getItem("mx_lhs_size");
        if (lhsSize !== null) {
            lhsSize = parseInt(lhsSize, 10);
        } else {
            lhsSize = 350;
        }
        this.resizer.forHandleAt(0).resize(lhsSize);
    },

    onAccountData: function(event) {
        if (event.getType() === "im.vector.web.settings") {
            this.setState({
                useCompactLayout: event.getContent().useCompactLayout,
            });
        }
        if (event.getType() === "m.ignored_user_list") {
            dis.dispatch({action: "ignore_state_changed"});
        }
    },

    onSync: function(syncState, oldSyncState, data) {
        const oldErrCode = (
            this.state.syncErrorData &&
            this.state.syncErrorData.error &&
            this.state.syncErrorData.error.errcode
        );
        const newErrCode = data && data.error && data.error.errcode;
        if (syncState === oldSyncState && oldErrCode === newErrCode) return;

        if (syncState === 'ERROR') {
            this.setState({
                syncErrorData: data,
            });
        } else {
            this.setState({
                syncErrorData: null,
            });
        }

        if (oldSyncState === 'PREPARED' && syncState === 'SYNCING') {
            this._updateServerNoticeEvents();
        }
    },

    onRoomStateEvents: function(ev, state) {
        const roomLists = RoomListStore.getRoomLists();
        if (roomLists['m.server_notice'] && roomLists['m.server_notice'].some(r => r.roomId === ev.getRoomId())) {
            this._updateServerNoticeEvents();
        }
    },

    _updateServerNoticeEvents: async function() {
        const roomLists = RoomListStore.getRoomLists();
        if (!roomLists['m.server_notice']) return [];

        const pinnedEvents = [];
        for (const room of roomLists['m.server_notice']) {
            const pinStateEvent = room.currentState.getStateEvents("m.room.pinned_events", "");

            if (!pinStateEvent || !pinStateEvent.getContent().pinned) continue;

            const pinnedEventIds = pinStateEvent.getContent().pinned.slice(0, MAX_PINNED_NOTICES_PER_ROOM);
            for (const eventId of pinnedEventIds) {
                const timeline = await this._matrixClient.getEventTimeline(room.getUnfilteredTimelineSet(), eventId, 0);
                const ev = timeline.getEvents().find(ev => ev.getId() === eventId);
                if (ev) pinnedEvents.push(ev);
            }
        }
        this.setState({
            serverNoticeEvents: pinnedEvents,
        });
    },


    _onKeyDown: function(ev) {
            /*
            // Remove this for now as ctrl+alt = alt-gr so this breaks keyboards which rely on alt-gr for numbers
            // Will need to find a better meta key if anyone actually cares about using this.
            if (ev.altKey && ev.ctrlKey && ev.keyCode > 48 && ev.keyCode < 58) {
                dis.dispatch({
                    action: 'view_indexed_room',
                    roomIndex: ev.keyCode - 49,
                });
                ev.stopPropagation();
                ev.preventDefault();
                return;
            }
            */

        let handled = false;
        const ctrlCmdOnly = isOnlyCtrlOrCmdKeyEvent(ev);

        switch (ev.keyCode) {
            case KeyCode.UP:
            case KeyCode.DOWN:
                if (ev.altKey && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
                    const action = ev.keyCode == KeyCode.UP ?
                        'view_prev_room' : 'view_next_room';
                    dis.dispatch({action: action});
                    handled = true;
                }
                break;

            case KeyCode.PAGE_UP:
            case KeyCode.PAGE_DOWN:
                if (!ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this._onScrollKeyPressed(ev);
                    handled = true;
                }
                break;

            case KeyCode.HOME:
            case KeyCode.END:
                if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this._onScrollKeyPressed(ev);
                    handled = true;
                }
                break;
            case KeyCode.KEY_K:
                if (ctrlCmdOnly) {
                    dis.dispatch({
                        action: 'focus_room_filter',
                    });
                    handled = true;
                }
                break;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    },

    /**
     * dispatch a page-up/page-down/etc to the appropriate component
     * @param {Object} ev The key event
     */
    _onScrollKeyPressed: function(ev) {
        if (this.refs.roomView) {
            this.refs.roomView.handleScrollKey(ev);
        }
    },

    _onDragEnd: function(result) {
        // Dragged to an invalid destination, not onto a droppable
        if (!result.destination) {
            return;
        }

        const dest = result.destination.droppableId;

        if (dest === 'tag-panel-droppable') {
            // Could be "GroupTile +groupId:domain"
            const draggableId = result.draggableId.split(' ').pop();

            // Dispatch synchronously so that the TagPanel receives an
            // optimistic update from TagOrderStore before the previous
            // state is shown.
            dis.dispatch(TagOrderActions.moveTag(
                this._matrixClient,
                draggableId,
                result.destination.index,
            ), true);
        } else if (dest.startsWith('room-sub-list-droppable_')) {
            this._onRoomTileEndDrag(result);
        }
    },

    _onRoomTileEndDrag: function(result) {
        let newTag = result.destination.droppableId.split('_')[1];
        let prevTag = result.source.droppableId.split('_')[1];
        if (newTag === 'undefined') newTag = undefined;
        if (prevTag === 'undefined') prevTag = undefined;

        const roomId = result.draggableId.split('_')[1];

        const oldIndex = result.source.index;
        const newIndex = result.destination.index;

        dis.dispatch(RoomListActions.tagRoom(
            this._matrixClient,
            this._matrixClient.getRoom(roomId),
            prevTag, newTag,
            oldIndex, newIndex,
        ), true);
    },

    _onMouseDown: function(ev) {
        // When the panels are disabled, clicking on them results in a mouse event
        // which bubbles to certain elements in the tree. When this happens, close
        // any settings page that is currently open (user/room/group).
        if (this.props.leftDisabled && this.props.rightDisabled) {
            const targetClasses = new Set(ev.target.className.split(' '));
            if (
                targetClasses.has('mx_MatrixChat') ||
                targetClasses.has('mx_MatrixChat_middlePanel') ||
                targetClasses.has('mx_RoomView')
            ) {
                this.setState({
                    mouseDown: {
                        x: ev.pageX,
                        y: ev.pageY,
                    },
                });
            }
        }
    },

    _onMouseUp: function(ev) {
        if (!this.state.mouseDown) return;

        const deltaX = ev.pageX - this.state.mouseDown.x;
        const deltaY = ev.pageY - this.state.mouseDown.y;
        const distance = Math.sqrt((deltaX * deltaX) + (deltaY + deltaY));
        const maxRadius = 5; // People shouldn't be straying too far, hopefully

        // Note: we track how far the user moved their mouse to help
        // combat against https://github.com/vector-im/riot-web/issues/7158

        if (distance < maxRadius) {
            // This is probably a real click, and not a drag
            dis.dispatch({ action: 'close_settings' });
        }

        // Always clear the mouseDown state to ensure we don't accidentally
        // use stale values due to the mouseDown checks.
        this.setState({mouseDown: null});
    },

    _setResizeContainerRef(div) {
        this.resizeContainer = div;
    },

    render: function() {
        const LeftPanel = sdk.getComponent('structures.LeftPanel');
        const RoomView = sdk.getComponent('structures.RoomView');
        const EmbeddedPage = sdk.getComponent('structures.EmbeddedPage');
        const GroupView = sdk.getComponent('structures.GroupView');
        const MyGroups = sdk.getComponent('structures.MyGroups');
        const MatrixToolbar = sdk.getComponent('globals.MatrixToolbar');
        const CookieBar = sdk.getComponent('globals.CookieBar');
        const NewVersionBar = sdk.getComponent('globals.NewVersionBar');
        const UpdateCheckBar = sdk.getComponent('globals.UpdateCheckBar');
        const PasswordNagBar = sdk.getComponent('globals.PasswordNagBar');
        const ServerLimitBar = sdk.getComponent('globals.ServerLimitBar');

        let pageElement;

        switch (this.props.page_type) {
            case PageTypes.RoomView:
                pageElement = <RoomView
                        ref='roomView'
                        autoJoin={this.props.autoJoin}
                        onRegistered={this.props.onRegistered}
                        thirdPartyInvite={this.props.thirdPartyInvite}
                        oobData={this.props.roomOobData}
                        viaServers={this.props.viaServers}
                        eventPixelOffset={this.props.initialEventPixelOffset}
                        key={this.props.currentRoomId || 'roomview'}
                        disabled={this.props.middleDisabled}
                        collapsedRhs={this.props.collapsedRhs}
                        ConferenceHandler={this.props.ConferenceHandler}
                    />;
                break;

            case PageTypes.MyGroups:
                pageElement = <MyGroups />;
                break;

            case PageTypes.RoomDirectory:
                // handled by MatrixChat for now
                break;

            case PageTypes.HomePage:
                {
                    const pageUrl = getHomePageUrl(this.props.config);
                    pageElement = <EmbeddedPage className="mx_HomePage"
                        url={pageUrl}
                        scrollbar={true}
                    />;
                }
                break;

            case PageTypes.UserView:
                pageElement = null; // deliberately null for now
                // TODO: fix/remove UserView
                // right_panel = <RightPanel disabled={this.props.rightDisabled} />;
                break;
            case PageTypes.GroupView:
                pageElement = <GroupView
                    groupId={this.props.currentGroupId}
                    isNew={this.props.currentGroupIsNew}
                    collapsedRhs={this.props.collapsedRhs}
                />;
                break;
        }

        const usageLimitEvent = this.state.serverNoticeEvents.find((e) => {
            return (
                e && e.getType() === 'm.room.message' &&
                e.getContent()['server_notice_type'] === 'm.server_notice.usage_limit_reached'
            );
        });

        let topBar;
        const isGuest = this.props.matrixClient.isGuest();
        if (this.state.syncErrorData && this.state.syncErrorData.error.errcode === 'M_RESOURCE_LIMIT_EXCEEDED') {
            topBar = <ServerLimitBar kind='hard'
                adminContact={this.state.syncErrorData.error.data.admin_contact}
                limitType={this.state.syncErrorData.error.data.limit_type}
            />;
        } else if (usageLimitEvent) {
            topBar = <ServerLimitBar kind='soft'
                adminContact={usageLimitEvent.getContent().admin_contact}
                limitType={usageLimitEvent.getContent().limit_type}
            />;
        } else if (this.props.showCookieBar &&
            this.props.config.piwik
        ) {
            const policyUrl = this.props.config.piwik.policyUrl || null;
            topBar = <CookieBar policyUrl={policyUrl} />;
        } else if (this.props.hasNewVersion) {
            topBar = <NewVersionBar version={this.props.version} newVersion={this.props.newVersion}
                                    releaseNotes={this.props.newVersionReleaseNotes}
            />;
        } else if (this.props.checkingForUpdate) {
            topBar = <UpdateCheckBar {...this.props.checkingForUpdate} />;
        } else if (this.state.userHasGeneratedPassword) {
            topBar = <PasswordNagBar />;
        } else if (
            !isGuest && Notifier.supportsDesktopNotifications() &&
            !Notifier.isEnabled() && !Notifier.isToolbarHidden()
        ) {
            topBar = <MatrixToolbar />;
        }

        let bodyClasses = 'mx_MatrixChat';
        if (topBar) {
            bodyClasses += ' mx_MatrixChat_toolbarShowing';
        }
        if (this.state.useCompactLayout) {
            bodyClasses += ' mx_MatrixChat_useCompactLayout';
        }

        return (
            <div className='mx_MatrixChat_wrapper' aria-hidden={this.props.hideToSRUsers} onMouseDown={this._onMouseDown} onMouseUp={this._onMouseUp}>
                { topBar }
                <DragDropContext onDragEnd={this._onDragEnd}>
                    <div ref={this._setResizeContainerRef} className={bodyClasses}>
                        <LeftPanel
                            toolbarShown={!!topBar}
                            collapsed={this.props.collapseLhs || false}
                            disabled={this.props.leftDisabled}
                        />
                        <ResizeHandle />
                        { pageElement }
                    </div>
                </DragDropContext>
            </div>
        );
    },
});

export default LoggedInView;
