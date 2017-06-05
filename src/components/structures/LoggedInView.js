/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

import UserSettingsStore from '../../UserSettingsStore';
import KeyCode from '../../KeyCode';
import Notifier from '../../Notifier';
import PageTypes from '../../PageTypes';
import CallMediaHandler from '../../CallMediaHandler';
import sdk from '../../index';
import dis from '../../dispatcher';
import sessionStore from '../../stores/SessionStore';
import MatrixClientPeg from '../../MatrixClientPeg';

/**
 * This is what our MatrixChat shows when we are logged in. The precise view is
 * determined by the page_type property.
 *
 * Currently it's very tightly coupled with MatrixChat. We should try to do
 * something about that.
 *
 * Components mounted below us can access the matrix client via the react context.
 */
export default React.createClass({
    displayName: 'LoggedInView',

    propTypes: {
        matrixClient: React.PropTypes.instanceOf(Matrix.MatrixClient).isRequired,
        page_type: React.PropTypes.string.isRequired,
        onRoomCreated: React.PropTypes.func,
        onUserSettingsClose: React.PropTypes.func,

        // Called with the credentials of a registered user (if they were a ROU that
        // transitioned to PWLU)
        onRegistered: React.PropTypes.func,

        teamToken: React.PropTypes.string,

        // and lots and lots of other stuff.
    },

    childContextTypes: {
        matrixClient: React.PropTypes.instanceOf(Matrix.MatrixClient),
        authCache: React.PropTypes.object,
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
            useCompactLayout: UserSettingsStore.getSyncedSetting('useCompactLayout'),
        };
    },

    componentWillMount: function() {
        // stash the MatrixClient in case we log out before we are unmounted
        this._matrixClient = this.props.matrixClient;

        // _scrollStateMap is a map from room id to the scroll state returned by
        // RoomView.getScrollState()
        this._scrollStateMap = {};

        CallMediaHandler.loadDevices();

        document.addEventListener('keydown', this._onKeyDown);

        this._sessionStore = sessionStore;
        this._sessionStoreToken = this._sessionStore.addListener(
            this._setStateFromSessionStore,
        );
        this._setStateFromSessionStore();

        this._matrixClient.on("accountData", this.onAccountData);
    },

    componentWillUnmount: function() {
        document.removeEventListener('keydown', this._onKeyDown);
        this._matrixClient.removeListener("accountData", this.onAccountData);
        if (this._sessionStoreToken) {
            this._sessionStoreToken.remove();
        }
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

    getScrollStateForRoom: function(roomId) {
        return this._scrollStateMap[roomId];
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

    onAccountData: function(event) {
        if (event.getType() === "im.vector.web.settings") {
            this.setState({
                useCompactLayout: event.getContent().useCompactLayout,
            });
        }
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

        var handled = false;

        switch (ev.keyCode) {
            case KeyCode.UP:
            case KeyCode.DOWN:
                if (ev.altKey && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
                    var action = ev.keyCode == KeyCode.UP ?
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
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    },

    /** dispatch a page-up/page-down/etc to the appropriate component */
    _onScrollKeyPressed: function(ev) {
        if (this.refs.roomView) {
            this.refs.roomView.handleScrollKey(ev);
        }
        else if (this.refs.roomDirectory) {
            this.refs.roomDirectory.handleScrollKey(ev);
        }
    },

    render: function() {
        const LeftPanel = sdk.getComponent('structures.LeftPanel');
        const RightPanel = sdk.getComponent('structures.RightPanel');
        const RoomView = sdk.getComponent('structures.RoomView');
        const UserSettings = sdk.getComponent('structures.UserSettings');
        const CreateRoom = sdk.getComponent('structures.CreateRoom');
        const RoomDirectory = sdk.getComponent('structures.RoomDirectory');
        const HomePage = sdk.getComponent('structures.HomePage');
        const MatrixToolbar = sdk.getComponent('globals.MatrixToolbar');
        const NewVersionBar = sdk.getComponent('globals.NewVersionBar');
        const PasswordNagBar = sdk.getComponent('globals.PasswordNagBar');

        let page_element;
        let right_panel = '';

        switch (this.props.page_type) {
            case PageTypes.RoomView:
                page_element = <RoomView
                        ref='roomView'
                        autoJoin={this.props.autoJoin}
                        onRegistered={this.props.onRegistered}
                        eventId={this.props.initialEventId}
                        thirdPartyInvite={this.props.thirdPartyInvite}
                        oobData={this.props.roomOobData}
                        highlightedEventId={this.props.highlightedEventId}
                        eventPixelOffset={this.props.initialEventPixelOffset}
                        key={this.props.currentRoomId || 'roomview'}
                        opacity={this.props.middleOpacity}
                        collapsedRhs={this.props.collapse_rhs}
                        ConferenceHandler={this.props.ConferenceHandler}
                        scrollStateMap={this._scrollStateMap}
                    />;
                if (!this.props.collapse_rhs) right_panel = <RightPanel roomId={this.props.currentRoomId} opacity={this.props.rightOpacity} />;
                break;

            case PageTypes.UserSettings:
                page_element = <UserSettings
                    onClose={this.props.onUserSettingsClose}
                    brand={this.props.config.brand}
                    collapsedRhs={this.props.collapse_rhs}
                    enableLabs={this.props.config.enableLabs}
                    referralBaseUrl={this.props.config.referralBaseUrl}
                    teamToken={this.props.teamToken}
                />;
                if (!this.props.collapse_rhs) right_panel = <RightPanel opacity={this.props.rightOpacity}/>;
                break;

            case PageTypes.CreateRoom:
                page_element = <CreateRoom
                    onRoomCreated={this.props.onRoomCreated}
                    collapsedRhs={this.props.collapse_rhs}
                />;
                if (!this.props.collapse_rhs) right_panel = <RightPanel opacity={this.props.rightOpacity}/>;
                break;

            case PageTypes.RoomDirectory:
                page_element = <RoomDirectory
                    ref="roomDirectory"
                    config={this.props.config.roomDirectory}
                />;
                break;

            case PageTypes.HomePage:
                // If team server config is present, pass the teamServerURL. props.teamToken
                // must also be set for the team page to be displayed, otherwise the
                // welcomePageUrl is used (which might be undefined).
                const teamServerUrl = this.props.config.teamServerConfig ?
                    this.props.config.teamServerConfig.teamServerURL : null;

                page_element = <HomePage
                    collapsedRhs={this.props.collapse_rhs}
                    teamServerUrl={teamServerUrl}
                    teamToken={this.props.teamToken}
                    homePageUrl={this.props.config.welcomePageUrl}
                />;
                break;

            case PageTypes.UserView:
                page_element = null; // deliberately null for now
                right_panel = <RightPanel userId={this.props.viewUserId} opacity={this.props.rightOpacity} />;
                break;
        }

        const isGuest = this.props.matrixClient.isGuest();
        var topBar;
        if (this.props.hasNewVersion) {
            topBar = <NewVersionBar version={this.props.version} newVersion={this.props.newVersion}
                releaseNotes={this.props.newVersionReleaseNotes}
            />;
        } else if (this.state.userHasGeneratedPassword) {
            topBar = <PasswordNagBar />;
        } else if (!isGuest && Notifier.supportsDesktopNotifications() && !Notifier.isEnabled() && !Notifier.isToolbarHidden()) {
            topBar = <MatrixToolbar />;
        }

        var bodyClasses = 'mx_MatrixChat';
        if (topBar) {
            bodyClasses += ' mx_MatrixChat_toolbarShowing';
        }
        if (this.state.useCompactLayout) {
            bodyClasses += ' mx_MatrixChat_useCompactLayout';
        }

        return (
            <div className='mx_MatrixChat_wrapper'>
                {topBar}
                <div className={bodyClasses}>
                    <LeftPanel
                        selectedRoom={this.props.currentRoomId}
                        collapsed={this.props.collapse_lhs || false}
                        opacity={this.props.leftOpacity}
                    />
                    <main className='mx_MatrixChat_middlePanel'>
                        {page_element}
                    </main>
                    {right_panel}
                </div>
            </div>
        );
    },
});
