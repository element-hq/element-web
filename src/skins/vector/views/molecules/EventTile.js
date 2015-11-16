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
var ReactDom = require('react-dom');
var classNames = require("classnames");

var sdk = require('matrix-react-sdk')
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg')

var EventTileController = require('matrix-react-sdk/lib/controllers/molecules/EventTile')
var ContextualMenu = require('../../../../ContextualMenu');

var TextForEvent = require('matrix-react-sdk/lib/TextForEvent');

var Velociraptor = require('../../../../Velociraptor');
require('../../../../VelocityBounce');

var eventTileTypes = {
    'm.room.message': 'molecules.MessageTile',
    'm.room.member' : 'molecules.EventAsTextTile',
    'm.call.invite' : 'molecules.EventAsTextTile',
    'm.call.answer' : 'molecules.EventAsTextTile',
    'm.call.hangup' : 'molecules.EventAsTextTile',
    'm.room.name'   : 'molecules.EventAsTextTile',
    'm.room.topic'  : 'molecules.EventAsTextTile',
};

var MAX_READ_AVATARS = 5;

module.exports = React.createClass({
    displayName: 'EventTile',
    mixins: [EventTileController],

    statics: {
        haveTileForEvent: function(e) {
            if (eventTileTypes[e.getType()] == undefined) return false;
            if (eventTileTypes[e.getType()] == 'molecules.EventAsTextTile') {
                return TextForEvent.textForEvent(e) !== '';
            } else {
                return true;
            }
        }
    },

    getInitialState: function() {
        return {menu: false};
    },

    componentDidUpdate: function() {
        this.readAvatarRect = ReactDom.findDOMNode(this.readAvatarNode).getBoundingClientRect();
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

    getReadAvatars: function() {
        var avatars = [];

        var room = MatrixClientPeg.get().getRoom(this.props.mxEvent.getRoomId());

        if (!room) return [];

        // get list of read receipts, sorted most recent first
        var receipts = room.getReceiptsForEvent(this.props.mxEvent).filter(function(r) {
            return r.type === "m.read";
        }).sort(function(r1, r2) {
            return r2.data.ts - r1.data.ts;
        });

        var MemberAvatar = sdk.getComponent('atoms.MemberAvatar');

        var left = 0;

        var reorderTransitionOpts = {
            duration: 100,
            easing: 'easeOut'
        };

        for (var i = 0; i < receipts.length; ++i) {
            var member = room.getMember(receipts[i].userId);

            // Using react refs here would mean both getting Velociraptor to expose
            // them and making them scoped to the whole RoomView. Not impossible, but
            // getElementById seems simpler at least for a first cut.
            var oldAvatarDomNode = document.getElementById('mx_readAvatar'+member.userId);
            var startStyles = [];
            var enterTransitionOpts = [];
            if (oldAvatarDomNode && this.readAvatarRect) {
                var oldRect = oldAvatarDomNode.getBoundingClientRect();
                var topOffset = oldRect.top - this.readAvatarRect.top;

                if (oldAvatarDomNode.style.left !== '0px') {
                    var leftOffset = oldAvatarDomNode.style.left;
                    // start at the old height and in the old h pos
                    startStyles.push({ top: topOffset, left: leftOffset });
                    enterTransitionOpts.push(reorderTransitionOpts);
                }

                // then shift to the rightmost column,
                // and then it will drop down to its resting position
                startStyles.push({ top: topOffset, left: '0px' });
                enterTransitionOpts.push({
                    // Sort of make it take a bit longer to fall in a way
                    // that would make my A level physics teacher cry.
                    duration: Math.min(Math.log(Math.abs(topOffset)) * 200, 3000),
                    easing: 'easeOutBounce'
                });
            }

            // add to the start so the most recent is on the end (ie. ends up rightmost)
            avatars.unshift(
                <MemberAvatar key={member.userId} member={member}
                    width={14} height={14} resizeMethod="crop"
                    style={ { left: left+'px', top: '0px' } }
                    startStyle={startStyles}
                    enterTransitionOpts={enterTransitionOpts}
                    id={'mx_readAvatar'+member.userId}
                />
            );
            left -= 15;
            if (i + 1 >= MAX_READ_AVATARS) {
                break;
            }
        }
        var remainder = receipts.length - MAX_READ_AVATARS;
        var remText;
        if (remainder > 0) {
            remText = <span className="mx_EventTile_readAvatarRemainder" style={ {left: left} }>+{ remainder }</span>;
        }

        return <span className="mx_EventTile_readAvatars" ref={this.collectReadAvatarNode}>
            {remText}
            <Velociraptor transition={reorderTransitionOpts}>
                {avatars}
            </Velociraptor>
        </span>;
    },

    collectReadAvatarNode: function(node) {
        this.readAvatarNode = node;
    },

    render: function() {
        var MessageTimestamp = sdk.getComponent('atoms.MessageTimestamp');
        var SenderProfile = sdk.getComponent('molecules.SenderProfile');
        var MemberAvatar = sdk.getComponent('atoms.MemberAvatar');

        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;

        var EventTileType = sdk.getComponent(eventTileTypes[this.props.mxEvent.getType()]);
        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        if (!EventTileType) {
            throw new Error("Event type not supported");
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
            mx_EventTile_contextual: this.props.contextual,
            menu: this.state.menu,
        });
        var timestamp = <MessageTimestamp ts={this.props.mxEvent.getTs()} />
        var editButton = (
            <input
                type="image" src="img/edit.png" alt="Edit" width="14" height="14"
                className="mx_EventTile_editButton" onClick={this.onEditClicked}
            />
        );

        var aux = null;
        if (msgtype === 'm.image') aux = "sent an image";
        else if (msgtype === 'm.video') aux = "sent a video";
        else if (msgtype === 'm.file') aux = "uploaded a file";

        var readAvatars = this.getReadAvatars();

        var avatar, sender;
        if (!this.props.continuation) {
            if (this.props.mxEvent.sender) {
                avatar = (
                    <div className="mx_EventTile_avatar">
                        <MemberAvatar member={this.props.mxEvent.sender} width={24} height={24} />
                    </div>
                );
            }
            if (EventTileType.needsSenderProfile()) {
                sender = <SenderProfile mxEvent={this.props.mxEvent} aux={aux} />;
            }
        }
        return (
            <div className={classes}>
                <div className="mx_EventTile_msgOption">
                    { editButton }
                    { timestamp }
                    { readAvatars }
                </div>
                { avatar }
                { sender }
                <div className="mx_EventTile_line">
                    <EventTileType mxEvent={this.props.mxEvent} searchTerm={this.props.searchTerm} />
                </div>
            </div>
        );
    },
});
