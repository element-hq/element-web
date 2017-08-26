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

'use strict';

import React from 'react';
import { DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import KeyCode from 'matrix-react-sdk/lib/KeyCode';
import sdk from 'matrix-react-sdk';
import dis from 'matrix-react-sdk/lib/dispatcher';
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';
import CallHandler from 'matrix-react-sdk/lib/CallHandler';
import AccessibleButton from 'matrix-react-sdk/lib/components/views/elements/AccessibleButton';
import VectorConferenceHandler from '../../VectorConferenceHandler';

var LeftPanel = React.createClass({
    displayName: 'LeftPanel',

    propTypes: {
        collapsed: React.PropTypes.bool.isRequired,
    },

    getInitialState: function() {
        return {
            showCallElement: null,
            searchFilter: '',
        };
    },

    componentWillMount: function() {
        this.focusedElement = null;
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillReceiveProps: function(newProps) {
        this._recheckCallElement(newProps.selectedRoom);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        switch (payload.action) {
            // listen for call state changes to prod the render method, which
            // may hide the global CallView if the call it is tracking is dead
            case 'call_state':
                this._recheckCallElement(this.props.selectedRoom);
                break;
        }
    },

    _onFocus: function(ev) {
        this.focusedElement = ev.target;
    },

    _onBlur: function(ev) {
        this.focusedElement = null;
    },

    _onKeyDown: function(ev) {
        if (!this.focusedElement) return;
        let handled = false;

        switch (ev.keyCode) {
            case KeyCode.UP:
                this._onMoveFocus(true);
                handled = true;
                break;
            case KeyCode.DOWN:
                this._onMoveFocus(false);
                handled = true;
                break;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    },

    _onMoveFocus: function(up) {
        var element = this.focusedElement;

        // unclear why this isn't needed
        // var descending = (up == this.focusDirection) ? this.focusDescending : !this.focusDescending;
        // this.focusDirection = up;

        var descending = false; // are we currently descending or ascending through the DOM tree?
        var classes;

        do {
            var child = up ? element.lastElementChild : element.firstElementChild;
            var sibling = up ? element.previousElementSibling : element.nextElementSibling;

            if (descending) {
                if (child) {
                    element = child;
                }
                else if (sibling) {
                    element = sibling;
                }
                else {
                    descending = false;
                    element = element.parentElement;
                }
            }
            else {
                if (sibling) {
                    element = sibling;
                    descending = true;
                }
                else {
                    element = element.parentElement;
                }
            }

            if (element) {
                classes = element.classList;
                if (classes.contains("mx_LeftPanel")) { // we hit the top
                    element = up ? element.lastElementChild : element.firstElementChild;
                    descending = true;
                }
            }

        } while(element && !(
            classes.contains("mx_RoomTile") ||
            classes.contains("mx_SearchBox_search") ||
            classes.contains("mx_RoomSubList_ellipsis")));

        if (element) {
            element.focus();
            this.focusedElement = element;
            this.focusedDescending = descending;
        }
    },

    _recheckCallElement: function(selectedRoomId) {
        // if we aren't viewing a room with an ongoing call, but there is an
        // active call, show the call element - we need to do this to make
        // audio/video not crap out
        var activeCall = CallHandler.getAnyActiveCall();
        var callForRoom = CallHandler.getCallForRoom(selectedRoomId);
        var showCall = (activeCall && activeCall.call_state === 'connected' && !callForRoom);
        this.setState({
            showCallElement: showCall
        });
    },

    onHideClick: function() {
        dis.dispatch({
            action: 'hide_left_panel',
        });
    },

    onCallViewClick: function() {
        var call = CallHandler.getAnyActiveCall();
        if (call) {
            dis.dispatch({
                action: 'view_room',
                room_id: call.groupRoomId || call.roomId,
            });
        }
    },

    onSearch: function(term) {
        this.setState({ searchFilter: term });
    },

    render: function() {
        var RoomList = sdk.getComponent('rooms.RoomList');
        var BottomLeftMenu = sdk.getComponent('structures.BottomLeftMenu');

        var topBox;
        if (MatrixClientPeg.get().isGuest()) {
            var LoginBox = sdk.getComponent('structures.LoginBox');
            topBox = <LoginBox collapsed={ this.props.collapsed }/>;
        }
        else {
            var SearchBox = sdk.getComponent('structures.SearchBox');
            topBox = <SearchBox collapsed={ this.props.collapsed } onSearch={ this.onSearch } />;
        }

        var classes = "mx_LeftPanel mx_fadable";
        if (this.props.collapsed) {
            classes += " collapsed";
        }

        var callPreview;
        if (this.state.showCallElement && !this.props.collapsed) {
            var CallView = sdk.getComponent('voip.CallView');
            callPreview = (
                <CallView
                    className="mx_LeftPanel_callView" showVoice={true} onClick={this.onCallViewClick}
                    ConferenceHandler={VectorConferenceHandler} />
            );
        }

        return (
            <aside className={classes} style={{ opacity: this.props.opacity }}
                   onKeyDown={ this._onKeyDown } onFocus={ this._onFocus } onBlur={ this._onBlur }>
                { topBox }
                { callPreview }
                <RoomList
                    selectedRoom={this.props.selectedRoom}
                    collapsed={this.props.collapsed}
                    searchFilter={this.state.searchFilter}
                    ConferenceHandler={VectorConferenceHandler} />
                <BottomLeftMenu collapsed={this.props.collapsed}/>
            </aside>
        );
    }
});

module.exports = DragDropContext(HTML5Backend)(LeftPanel);
