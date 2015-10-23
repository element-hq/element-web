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
var classNames = require("classnames");

var sdk = require('matrix-react-sdk')

var EventTileController = require('matrix-react-sdk/lib/controllers/molecules/EventTile')
var ContextualMenu = require('../../../../ContextualMenu');

var eventTileTypes = {
    'm.room.message': 'molecules.MessageTile',
    'm.room.member' : 'molecules.EventAsTextTile',
    'm.call.invite' : 'molecules.EventAsTextTile',
    'm.call.answer' : 'molecules.EventAsTextTile',
    'm.call.hangup' : 'molecules.EventAsTextTile',
    'm.room.topic'  : 'molecules.EventAsTextTile',
};

module.exports = React.createClass({
    displayName: 'EventTile',
    mixins: [EventTileController],

    statics: {
        supportsEventType: function(et) {
            return eventTileTypes[et] !== undefined;
        }
    },

    getInitialState: function() {
        return {menu: false};
    },

    onEditClicked: function(e) {
        var MessageContextMenu = sdk.getComponent('molecules.MessageContextMenu');
        var buttonRect = e.target.getBoundingClientRect()
        var x = buttonRect.right;
        var y = buttonRect.top + (e.target.height / 2);
        var self = this;
        ContextualMenu.createMenu(MessageContextMenu, {
            mxEvent: this.props.mxEvent,
            left: x,
            top: y,
            onFinished: function() {
                self.setState({menu: false});
            }
        });
        this.setState({menu: true});
    },

    render: function() {
        var MessageTimestamp = sdk.getComponent('atoms.MessageTimestamp');
        var SenderProfile = sdk.getComponent('molecules.SenderProfile');
        var MemberAvatar = sdk.getComponent('atoms.MemberAvatar');

        var UnknownMessageTile = sdk.getComponent('molecules.UnknownMessageTile');

        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;

        var EventTileType = sdk.getComponent(eventTileTypes[this.props.mxEvent.getType()]);
        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        if (!EventTileType) {
            return null;
        }

        var classes = classNames({
            mx_EventTile: true,
            mx_EventTile_sending: ['sending', 'queued'].indexOf(
                this.props.mxEvent.status
            ) !== -1,
            mx_EventTile_notSent: this.props.mxEvent.status == 'not_sent',
            mx_EventTile_highlight: this.shouldHighlight(),
            mx_EventTile_continuation: this.props.continuation,
            mx_EventTile_last: this.props.last,
            menu: this.state.menu
        });
        var timestamp = <MessageTimestamp ts={this.props.mxEvent.getTs()} />
        var editButton = (
            <input
                type="image" src="img/edit.png" alt="Edit"
                className="mx_EventTile_editButton" onClick={this.onEditClicked}
            />
        );

        var aux = null;
        if (msgtype === 'm.image') aux = "sent an image";
        else if (msgtype === 'm.video') aux = "sent a video";
        else if (msgtype === 'm.file') aux = "uploaded a file";

        var avatar, sender;
        if (!this.props.continuation) {
            if (this.props.mxEvent.sender) {
                avatar = (
                    <div className="mx_EventTile_avatar">
                        <MemberAvatar member={this.props.mxEvent.sender} width="24" height="24" />
                    </div>
                );
            }
            if (EventTileType.needsSenderProfile()) {
                sender = <SenderProfile mxEvent={this.props.mxEvent} aux={aux} />;
            }
        }
        return (
            <div className={classes}>
                { avatar }
                { sender }
                <div>
                    { timestamp }
                    { editButton }
                    <EventTileType mxEvent={this.props.mxEvent} />
                </div>
            </div>
        );
    },
});
