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

var q = require("q");
var React = require('react');
var classNames = require('classnames');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var dis = require('matrix-react-sdk/lib/dispatcher');

module.exports = React.createClass({
    displayName: 'RoomTagContextMenu',

    propTypes: {
        room: React.PropTypes.object.isRequired,
        /* callback called when the menu is dismissed */
        onFinished: React.PropTypes.func,
    },

    getInitialState: function() {
//        var areNotifsMuted = false;
//        var cli = MatrixClientPeg.get();
//        if (!cli.isGuest()) {
//            var roomPushRule = cli.getRoomPushRule("global", this.props.room.roomId);
//            if (roomPushRule) {
//                if (0 <= roomPushRule.actions.indexOf("dont_notify")) {
//                    areNotifsMuted = true;
//                }
//            }
//        }
//
//        return {
//            areNotifsMuted: areNotifsMuted,
//        };
        return null;
    },

//    _save: function( isMuted ) {
//        var self = this;
//        const roomId = this.props.room.roomId;
//        var cli = MatrixClientPeg.get();
//
//        if (!cli.isGuest()) {
//            cli.setRoomMutePushRule(
//                "global", roomId, isMuted
//            ).then(function() {
//                self.setState({areNotifsMuted: isMuted});
//
//                // delay slightly so that the user can see their state change
//                // before closing the menu
//                q.delay(500).then(function() {
//                    // tell everyone that wants to know of the change in
//                    // notification state
//                    dis.dispatch({
//                        action: 'notification_change',
//                        roomId: self.props.room.roomId,
//                        isMuted: isMuted,
//                    });
//
//                    // Close the context menu
//                    if (self.props.onFinished) {
//                        self.props.onFinished();
//                    };
//                });
//            }).fail(function(error) {
//                // TODO: some form of error notification to the user
//                // to inform them that their state change failed.
//            });
//        }
//    },

    _onClickFavourite: function() {
        // Tag room as 'Favourite'
    },

    _onClickLowPriority: function() {
        // Tag room as 'Low Priority'
    },

    _onClickLeave: function() {
        // Leave room - tag room as 'Archive'?
    },

    render: function() {
        var cli = MatrixClientPeg.get();

        var favouriteClasses = classNames({
            'mx_RoomTagContextMenu_field': true,
            'mx_RoomTagContextMenu_fieldDisabled': true,
        });

        var lowPriorityClasses = classNames({
            'mx_RoomTagContextMenu_field': true,
            'mx_RoomTagContextMenu_fieldSet': true,
        });

        var leaveClasses = classNames({
            'mx_RoomTagContextMenu_field': true,
            'mx_RoomTagContextMenu_fieldDisabled': true,
        });

        return (
            <div>
                <div className={ favouriteClasses } onClick={this._onClickFavourite} >
                    <img className="mx_RoomTagContextMenu_icon" src="img/icon-context-fave.svg" width="13" height="13" />
                    Favourite
                </div>
                <div className={ lowPriorityClasses } onClick={this._onClickLowPriority} >
                    <img className="mx_RoomTagContextMenu_icon" src="img/icon-context-fave.svg" width="13" height="13" />
                    Low Priority
                </div>
                <div className={ leaveClasses } onClick={this._onClickLeave} >
                    <img className="mx_RoomTagContextMenu_icon" src="img/icon-context-fave.svg" width="13" height="13" />
                    Leave
                </div>
            </div>
        );
    }
});
