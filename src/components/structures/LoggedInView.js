/*
Copyright 2015, 2016 OpenMarket Ltd

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

import KeyCode from '../../KeyCode';
import Notifier from '../../Notifier';
import PageTypes from '../../PageTypes';
import sdk from '../../index';

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
        onRoomIdResolved: React.PropTypes.func,
        onRoomCreated: React.PropTypes.func,
        onUserSettingsClose: React.PropTypes.func,

        // and lots and lots of other stuff.
    },

    childContextTypes: {
        matrixClient: React.PropTypes.instanceOf(Matrix.MatrixClient),
    },

    getChildContext: function() {
        return {
            matrixClient: this._matrixClient,
        };
    },

    componentWillMount: function() {
        // stash the MatrixClient in case we log out before we are unmounted
        this._matrixClient = this.props.matrixClient;

        // _scrollStateMap is a map from room id to the scroll state returned by
        // RoomView.getScrollState()
        this._scrollStateMap = {};

        document.addEventListener('keydown', this._onKeyDown);
    },

    componentWillUnmount: function() {
        document.removeEventListener('keydown', this._onKeyDown);
    },

    getScrollStateForRoom: function(roomId) {
        return this._scrollStateMap[roomId];
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
                if (ev.altKey) {
                    var action = ev.keyCode == KeyCode.UP ?
                        'view_prev_room' : 'view_next_room';
                    dis.dispatch({action: action});
                    handled = true;
                }
                break;

            case KeyCode.PAGE_UP:
            case KeyCode.PAGE_DOWN:
                this._onScrollKeyPressed(ev);
                handled = true;
                break;

            case KeyCode.HOME:
            case KeyCode.END:
                if (ev.ctrlKey) {
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
    },

    render: function() {
        var LeftPanel = sdk.getComponent('structures.LeftPanel');
        var RightPanel = sdk.getComponent('structures.RightPanel');
        var RoomView = sdk.getComponent('structures.RoomView');
        var UserSettings = sdk.getComponent('structures.UserSettings');
        var CreateRoom = sdk.getComponent('structures.CreateRoom');
        var RoomDirectory = sdk.getComponent('structures.RoomDirectory');
        var MatrixToolbar = sdk.getComponent('globals.MatrixToolbar');
        var GuestWarningBar = sdk.getComponent('globals.GuestWarningBar');
        var NewVersionBar = sdk.getComponent('globals.NewVersionBar');

        var page_element;
        var right_panel = '';

        switch (this.props.page_type) {
            case PageTypes.RoomView:
                page_element = <RoomView
                        ref='roomView'
                        roomAddress={this.props.currentRoomAlias || this.props.currentRoomId}
                        autoJoin={this.props.autoJoin}
                        onRoomIdResolved={this.props.onRoomIdResolved}
                        eventId={this.props.initialEventId}
                        thirdPartyInvite={this.props.thirdPartyInvite}
                        oobData={this.props.roomOobData}
                        highlightedEventId={this.props.highlightedEventId}
                        eventPixelOffset={this.props.initialEventPixelOffset}
                        key={this.props.currentRoomAlias || this.props.currentRoomId}
                        opacity={this.props.middleOpacity}
                        collapsedRhs={this.props.collapse_rhs}
                        ConferenceHandler={this.props.ConferenceHandler}
                        scrollStateMap={this._scrollStateMap}
                    />;
                if (!this.props.collapse_rhs) right_panel = <RightPanel roomId={this.props.currentRoomId} opacity={this.props.sideOpacity} />;
                break;

            case PageTypes.UserSettings:
                page_element = <UserSettings
                    onClose={this.props.onUserSettingsClose}
                    brand={this.props.config.brand}
                    collapsedRhs={this.props.collapse_rhs}
                    enableLabs={this.props.config.enableLabs}
                />;
                if (!this.props.collapse_rhs) right_panel = <RightPanel opacity={this.props.sideOpacity}/>;
                break;

            case PageTypes.CreateRoom:
                page_element = <CreateRoom
                    onRoomCreated={this.props.onRoomCreated}
                    collapsedRhs={this.props.collapse_rhs}
                />;
                if (!this.props.collapse_rhs) right_panel = <RightPanel opacity={this.props.sideOpacity}/>;
                break;

            case PageTypes.RoomDirectory:
                page_element = <RoomDirectory
                    collapsedRhs={this.props.collapse_rhs}
                    config={this.props.config.roomDirectory}
                />;
                if (!this.props.collapse_rhs) right_panel = <RightPanel opacity={this.props.sideOpacity}/>;
                break;
            case PageTypes.UserView:
                page_element = null; // deliberately null for now
                right_panel = <RightPanel userId={this.props.viewUserId} opacity={this.props.sideOpacity} />;
                break;
        }

        var topBar;
        if (this.props.hasNewVersion) {
            topBar = <NewVersionBar version={this.props.version} newVersion={this.props.newVersion}
                releaseNotes={this.props.newVersionReleaseNotes}
            />;
        }
        else if (this.props.matrixClient.isGuest()) {
            topBar = <GuestWarningBar />;
        }
        else if (Notifier.supportsDesktopNotifications() && !Notifier.isEnabled() && !Notifier.isToolbarHidden()) {
            topBar = <MatrixToolbar />;
        }

        var bodyClasses = 'mx_MatrixChat';
        if (topBar) {
            bodyClasses += ' mx_MatrixChat_toolbarShowing';
        }

        return (
            <div className='mx_MatrixChat_wrapper'>
                {topBar}
                <div className={bodyClasses}>
                    <LeftPanel selectedRoom={this.props.currentRoomId} collapsed={this.props.collapse_lhs || false} opacity={this.props.sideOpacity}/>
                    <main className='mx_MatrixChat_middlePanel'>
                        {page_element}
                    </main>
                    {right_panel}
                </div>
            </div>
        );
    },
});
