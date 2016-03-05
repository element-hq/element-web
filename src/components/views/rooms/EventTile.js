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

var React = require('react');
var ReactDom = require('react-dom');
var classNames = require("classnames");

var sdk = require('../../../index');
var MatrixClientPeg = require('../../../MatrixClientPeg')
var TextForEvent = require('../../../TextForEvent');

var ContextualMenu = require('../../../ContextualMenu');
var Velociraptor = require('../../../Velociraptor');
require('../../../VelocityBounce');

var bounce = false;
try {
    if (global.localStorage) {
        bounce = global.localStorage.getItem('avatar_bounce') == 'true';
    }
} catch (e) {
}

var eventTileTypes = {
    'm.room.message': 'messages.MessageEvent',
    'm.room.member' : 'messages.TextualEvent',
    'm.call.invite' : 'messages.TextualEvent',
    'm.call.answer' : 'messages.TextualEvent',
    'm.call.hangup' : 'messages.TextualEvent',
    'm.room.name'   : 'messages.TextualEvent',
    'm.room.topic'  : 'messages.TextualEvent',
    'm.room.third_party_invite': 'messages.TextualEvent'
};

var MAX_READ_AVATARS = 5;

// Our component structure for EventTiles on the timeline is:
//
// .-EventTile------------------------------------------------.
// | MemberAvatar (SenderProfile)                   TimeStamp |
// |    .-{Message,Textual}Event---------------. Read Avatars |
// |    |   .-MFooBody-------------------.     |              |
// |    |   |  (only if MessageEvent)    |     |              |
// |    |   '----------------------------'     |              |
// |    '--------------------------------------'              |
// '----------------------------------------------------------'

module.exports = React.createClass({
    displayName: 'Event',

    statics: {
        haveTileForEvent: function(e) {
            if (e.isRedacted()) return false;
            if (eventTileTypes[e.getType()] == undefined) return false;
            if (eventTileTypes[e.getType()] == 'messages.TextualEvent') {
                return TextForEvent.textForEvent(e) !== '';
            } else {
                return true;
            }
        }
    },

    propTypes: {
        /* the MatrixEvent to show */
        mxEvent: React.PropTypes.object.isRequired,

        /* true if this is a continuation of the previous event (which has the
         * effect of not showing another avatar/displayname
         */
        continuation: React.PropTypes.bool,

        /* true if this is the last event in the timeline (which has the effect
         * of always showing the timestamp)
         */
        last: React.PropTypes.bool,

        /* true if this is search context (which has the effect of greying out
         * the text
         */
        contextual: React.PropTypes.bool,

        /* a list of words to highlight, ordered by longest first */
        highlights: React.PropTypes.array,

        /* link URL for the highlights */
        highlightLink: React.PropTypes.string,

        /* is this the focused event */
        isSelectedEvent: React.PropTypes.bool,

        /* callback called when images in events are loaded */
        onImageLoad: React.PropTypes.func,
    },

    getInitialState: function() {
        return {menu: false, allReadAvatars: false};
    },

    shouldHighlight: function() {
        var actions = MatrixClientPeg.get().getPushActionsForEvent(this.props.mxEvent);
        if (!actions || !actions.tweaks) { return false; }

        // don't show self-highlights from another of our clients
        if (this.props.mxEvent.sender &&
            this.props.mxEvent.sender.userId === MatrixClientPeg.get().credentials.userId)
        {
            return false;
        }
        
        return actions.tweaks.highlight;
    },

    onEditClicked: function(e) {
        var MessageContextMenu = sdk.getComponent('rooms.MessageContextMenu');
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

    toggleAllReadAvatars: function() {
        this.setState({
            allReadAvatars: !this.state.allReadAvatars
        });
    },

    getReadAvatars: function() {
        var avatars = [];

        var room = MatrixClientPeg.get().getRoom(this.props.mxEvent.getRoomId());

        if (!room) return [];

        var myUserId = MatrixClientPeg.get().credentials.userId;

        // get list of read receipts, sorted most recent first
        var receipts = room.getReceiptsForEvent(this.props.mxEvent).filter(function(r) {
            return r.type === "m.read" && r.userId != myUserId;
        }).sort(function(r1, r2) {
            return r2.data.ts - r1.data.ts;
        });

        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

        var left = 0;

        var reorderTransitionOpts = {
            duration: 100,
            easing: 'easeOut'
        };

        for (var i = 0; i < receipts.length; ++i) {
            var member = room.getMember(receipts[i].userId);
            if (!member) {
                continue;
            }

            // Using react refs here would mean both getting Velociraptor to expose
            // them and making them scoped to the whole RoomView. Not impossible, but
            // getElementById seems simpler at least for a first cut.
            var oldAvatarDomNode = document.getElementById('mx_readAvatar'+member.userId);
            var startStyles = [];
            var enterTransitionOpts = [];
            var oldNodeTop = -15; // For avatars that weren't on screen, act as if they were just off the top
            if (oldAvatarDomNode) {
                oldNodeTop = oldAvatarDomNode.getBoundingClientRect().top;
            }

            if (this.readAvatarNode) {
                var topOffset = oldNodeTop - this.readAvatarNode.getBoundingClientRect().top;

                if (oldAvatarDomNode && oldAvatarDomNode.style.left !== '0px') {
                    var leftOffset = oldAvatarDomNode.style.left;
                    // start at the old height and in the old h pos
                    startStyles.push({ top: topOffset, left: leftOffset });
                    enterTransitionOpts.push(reorderTransitionOpts);
                }

                // then shift to the rightmost column,
                // and then it will drop down to its resting position
                startStyles.push({ top: topOffset, left: '0px' });
                enterTransitionOpts.push({
                    duration: bounce ? Math.min(Math.log(Math.abs(topOffset)) * 200, 3000) : 300,
                    easing: bounce ? 'easeOutBounce' : 'easeOutCubic',
                });
            }

            var style = {
                left: left+'px',
                top: '0px',
                visibility: ((i < MAX_READ_AVATARS) || this.state.allReadAvatars) ? 'visible' : 'hidden'
            };

            //console.log("i = " + i + ", MAX_READ_AVATARS = " + MAX_READ_AVATARS + ", allReadAvatars = " + this.state.allReadAvatars + " visibility = " + style.visibility);

            // add to the start so the most recent is on the end (ie. ends up rightmost)
            avatars.unshift(
                <MemberAvatar key={member.userId} member={member}
                    width={14} height={14} resizeMethod="crop"
                    style={style}
                    startStyle={startStyles}
                    enterTransitionOpts={enterTransitionOpts}
                    id={'mx_readAvatar'+member.userId}
                    onClick={this.toggleAllReadAvatars}
                />
            );
            // TODO: we keep the extra read avatars in the dom to make animation simpler
            // we could optimise this to reduce the dom size.
            if (i < MAX_READ_AVATARS - 1 || this.state.allReadAvatars) { // XXX: where does this -1 come from? is it to make the max'th avatar animate properly?
                left -= 15;
            }
        }
        var editButton;
        if (!this.state.allReadAvatars) {
            var remainder = receipts.length - MAX_READ_AVATARS;
            var remText;
            if (i >= MAX_READ_AVATARS - 1) left -= 15;
            if (remainder > 0) {
                remText = <span className="mx_EventTile_readAvatarRemainder"
                    onClick={this.toggleAllReadAvatars}
                    style={{ left: left }}>{ remainder }+
                </span>;
                left -= 15;
            }
            editButton = (
                <input style={{ left: left }}
                    type="image" src="img/edit.png" alt="Options" title="Options" width="14" height="14"
                    className="mx_EventTile_editButton" onClick={this.onEditClicked} />
            );
        }

        return <span className="mx_EventTile_readAvatars" ref={this.collectReadAvatarNode}>
            { editButton }
            { remText }
            <Velociraptor transition={ reorderTransitionOpts }>
                { avatars }
            </Velociraptor>
        </span>;
    },

    collectReadAvatarNode: function(node) {
        this.readAvatarNode = ReactDom.findDOMNode(node);
    },

    render: function() {
        var MessageTimestamp = sdk.getComponent('messages.MessageTimestamp');
        var SenderProfile = sdk.getComponent('messages.SenderProfile');
        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

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
            mx_EventTile_selected: this.props.isSelectedEvent,
            mx_EventTile_continuation: this.props.continuation,
            mx_EventTile_last: this.props.last,
            mx_EventTile_contextual: this.props.contextual,
            menu: this.state.menu,
        });
        var timestamp = <MessageTimestamp ts={this.props.mxEvent.getTs()} />

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
                    { timestamp }
                    { readAvatars }
                </div>
                { avatar }
                { sender }
                <div className="mx_EventTile_line">
                    <EventTileType mxEvent={this.props.mxEvent} highlights={this.props.highlights}
                          highlightLink={this.props.highlightLink}
                          onImageLoad={this.props.onImageLoad} />
                </div>
            </div>
        );
    },
});
