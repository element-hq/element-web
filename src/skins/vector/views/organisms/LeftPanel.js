/*
Copyright 2015 OpenMarket Ltd

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

var React = require('react');
var DragDropContext = require('react-dnd').DragDropContext;
var HTML5Backend = require('react-dnd-html5-backend');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');

var CallHandler = require("matrix-react-sdk/lib/CallHandler");

var LeftPanel = React.createClass({
    displayName: 'LeftPanel',

    getInitialState: function() {
        return {
            showCallElement: null,
        };
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

    _recheckCallElement: function(selectedRoomId) {
        // if we aren't viewing a room with an ongoing call, but there is an
        // active call, show the call element - we need to do this to make
        // audio/video not crap out
        var activeCall = CallHandler.getAnyActiveCall();
        var callForRoom = CallHandler.getCallForRoom(selectedRoomId);
        var showCall = (activeCall && !callForRoom);
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
                room_id: call.roomId,
            });
        }
    },

    render: function() {
        var RoomList = sdk.getComponent('organisms.RoomList');
        var BottomLeftMenu = sdk.getComponent('molecules.BottomLeftMenu');
        var IncomingCallBox = sdk.getComponent('molecules.voip.IncomingCallBox');

        var collapseButton;
        var classes = "mx_LeftPanel";
        if (this.props.collapsed) {
            classes += " collapsed";
        }
        else {
            // Hide the collapse button until we work out how to display it in the new skin
            // collapseButton = <img className="mx_LeftPanel_hideButton" onClick={ this.onHideClick } src="img/hide.png" width="12" height="20" alt="<"/>   
        }

        var callPreview;
        if (this.state.showCallElement) {
            var CallView = sdk.getComponent('molecules.voip.CallView');
            callPreview = <CallView className="mx_LeftPanel_callView" onClick={this.onCallViewClick} />
        }

        return (
            <aside className={classes}>
                { collapseButton }
                <IncomingCallBox />
                { callPreview }
                <RoomList selectedRoom={this.props.selectedRoom} collapsed={this.props.collapsed}/>
                <BottomLeftMenu collapsed={this.props.collapsed}/>
            </aside>
        );
    }
});

module.exports = DragDropContext(HTML5Backend)(LeftPanel);
