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

var React = require('react');
var sdk = require('../../index');
var dis = require("../../dispatcher");
var WhoIsTyping = require("../../WhoIsTyping");
var MatrixClientPeg = require("../../MatrixClientPeg");
const MemberAvatar = require("../views/avatars/MemberAvatar");

const HIDE_DEBOUNCE_MS = 10000;
const STATUS_BAR_HIDDEN = 0;
const STATUS_BAR_EXPANDED = 1;
const STATUS_BAR_EXPANDED_LARGE = 2;

module.exports = React.createClass({
    displayName: 'RoomStatusBar',

    propTypes: {
        // the room this statusbar is representing.
        room: React.PropTypes.object.isRequired,

        // a TabComplete object
        tabComplete: React.PropTypes.object.isRequired,

        // the number of messages which have arrived since we've been scrolled up
        numUnreadMessages: React.PropTypes.number,

        // string to display when there are messages in the room which had errors on send
        unsentMessageError: React.PropTypes.string,

        // this is true if we are fully scrolled-down, and are looking at
        // the end of the live timeline.
        atEndOfLiveTimeline: React.PropTypes.bool,

        // true if there is an active call in this room (means we show
        // the 'Active Call' text in the status bar if there is nothing
        // more interesting)
        hasActiveCall: React.PropTypes.bool,

        // Number of names to display in typing indication. E.g. set to 3, will
        // result in "X, Y, Z and 100 others are typing."
        whoIsTypingLimit: React.PropTypes.number,

        // callback for when the user clicks on the 'resend all' button in the
        // 'unsent messages' bar
        onResendAllClick: React.PropTypes.func,

        // callback for when the user clicks on the 'cancel all' button in the
        // 'unsent messages' bar
        onCancelAllClick: React.PropTypes.func,

        // callback for when the user clicks on the 'scroll to bottom' button
        onScrollToBottomClick: React.PropTypes.func,

        // callback for when we do something that changes the size of the
        // status bar. This is used to trigger a re-layout in the parent
        // component.
        onResize: React.PropTypes.func,

        // callback for when the status bar can be hidden from view, as it is
        // not displaying anything
        onHidden: React.PropTypes.func,

        // callback for when the status bar is displaying something and should
        // be visible
        onVisible: React.PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            whoIsTypingLimit: 3,
        };
    },

    getInitialState: function() {
        return {
            syncState: MatrixClientPeg.get().getSyncState(),
            usersTyping: WhoIsTyping.usersTypingApartFromMe(this.props.room),
        };
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("sync", this.onSyncStateChange);
        MatrixClientPeg.get().on("RoomMember.typing", this.onRoomMemberTyping);
    },

    componentDidUpdate: function(prevProps, prevState) {
        if(this.props.onResize && this._checkForResize(prevProps, prevState)) {
            this.props.onResize();
        }

        const size = this._getSize(this.props, this.state);
        if (size > 0) {
            this.props.onVisible();
        } else {
            if (this.hideDebouncer) {
                clearTimeout(this.hideDebouncer);
            }
            this.hideDebouncer = setTimeout(() => {
                // temporarily stop hiding the statusbar as per
                // https://github.com/vector-im/riot-web/issues/1991#issuecomment-276953915
                // this.props.onHidden();
            }, HIDE_DEBOUNCE_MS);
        }
    },

    componentWillUnmount: function() {
        // we may have entirely lost our client as we're logging out before clicking login on the guest bar...
        var client = MatrixClientPeg.get();
        if (client) {
            client.removeListener("sync", this.onSyncStateChange);
            client.removeListener("RoomMember.typing", this.onRoomMemberTyping);
        }
    },

    onSyncStateChange: function(state, prevState) {
        if (state === "SYNCING" && prevState === "SYNCING") {
            return;
        }
        this.setState({
            syncState: state
        });
    },

    onRoomMemberTyping: function(ev, member) {
        this.setState({
            usersTyping: WhoIsTyping.usersTypingApartFromMe(this.props.room),
        });
    },

    // We don't need the actual height - just whether it is likely to have
    // changed - so we use '0' to indicate normal size, and other values to
    // indicate other sizes.
    _getSize: function(props, state) {
        if (state.syncState === "ERROR" ||
            (state.usersTyping.length > 0) ||
            props.numUnreadMessages ||
            !props.atEndOfLiveTimeline ||
            props.hasActiveCall) {
            return STATUS_BAR_EXPANDED;
        } else if (props.tabCompleteEntries) {
            return STATUS_BAR_HIDDEN;
        } else if (props.unsentMessageError) {
            return STATUS_BAR_EXPANDED_LARGE;
        }
        return STATUS_BAR_HIDDEN;
    },

    // determine if we need to call onResize
    _checkForResize: function(prevProps, prevState) {
        // figure out the old height and the new height of the status bar.
        return this._getSize(prevProps, prevState)
            !== this._getSize(this.props, this.state);
    },

    // return suitable content for the image on the left of the status bar.
    //
    // if wantPlaceholder is true, we include a "..." placeholder if
    // there is nothing better to put in.
    _getIndicator: function(wantPlaceholder) {
        if (this.props.numUnreadMessages) {
            return (
                <div className="mx_RoomStatusBar_scrollDownIndicator"
                        onClick={ this.props.onScrollToBottomClick }>
                    <img src="img/newmessages.svg" width="24" height="24"
                        alt=""/>
                </div>
            );
        }

        if (!this.props.atEndOfLiveTimeline) {
            return (
                <div className="mx_RoomStatusBar_scrollDownIndicator"
                        onClick={ this.props.onScrollToBottomClick }>
                    <img src="img/scrolldown.svg" width="24" height="24"
                        alt="Scroll to bottom of page"
                        title="Scroll to bottom of page"/>
                </div>
            );
        }

        if (this.props.hasActiveCall) {
            return (
                <img src="img/sound-indicator.svg" width="23" height="20"/>
            );
        }

        if (this.state.syncState === "ERROR") {
            return null;
        }

        if (wantPlaceholder) {
            return (
                <div className="mx_RoomStatusBar_typingIndicatorAvatars">
                    {this._renderTypingIndicatorAvatars(this.props.whoIsTypingLimit)}
                </div>
            );
        }

        return null;
    },

    _renderTypingIndicatorAvatars: function(limit) {
        let users = this.state.usersTyping;

        let othersCount = 0;
        if (users.length > limit) {
            othersCount = users.length - limit + 1;
            users = users.slice(0, limit - 1);
        }

        let avatars = users.map((u, index) => {
            let showInitial = othersCount === 0 && index === users.length - 1;
            return (
                <MemberAvatar
                    key={u.userId}
                    member={u}
                    width={24}
                    height={24}
                    resizeMethod="crop"
                    defaultToInitialLetter={showInitial}
                />
            );
        });

        if (othersCount > 0) {
            avatars.push(
                <span className="mx_RoomStatusBar_typingIndicatorRemaining" key="others">
                    +{othersCount}
                </span>
            );
        }

        return avatars;
    },

    // return suitable content for the main (text) part of the status bar.
    _getContent: function() {
        var TabCompleteBar = sdk.getComponent('rooms.TabCompleteBar');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        const EmojiText = sdk.getComponent('elements.EmojiText');

        // no conn bar trumps unread count since you can't get unread messages
        // without a connection! (technically may already have some but meh)
        // It also trumps the "some not sent" msg since you can't resend without
        // a connection!
        if (this.state.syncState === "ERROR") {
            return (
                <div className="mx_RoomStatusBar_connectionLostBar">
                    <img src="img/warning.svg" width="24" height="23" title="/!\ " alt="/!\ "/>
                    <div className="mx_RoomStatusBar_connectionLostBar_title">
                        Connectivity to the server has been lost.
                    </div>
                    <div className="mx_RoomStatusBar_connectionLostBar_desc">
                        Sent messages will be stored until your connection has returned.
                    </div>
                </div>
            );
        }

        if (this.props.tabComplete.isTabCompleting()) {
            return (
                <div className="mx_RoomStatusBar_tabCompleteBar">
                    <div className="mx_RoomStatusBar_tabCompleteWrapper">
                        <TabCompleteBar tabComplete={this.props.tabComplete} />
                        <div className="mx_RoomStatusBar_tabCompleteEol" title="->|">
                            <TintableSvg src="img/eol.svg" width="22" height="16"/>
                            Auto-complete
                        </div>
                    </div>
                </div>
            );
        }

        if (this.props.unsentMessageError) {
            return (
                <div className="mx_RoomStatusBar_connectionLostBar">
                    <img src="img/warning.svg" width="24" height="23" title="/!\ " alt="/!\ "/>
                    <div className="mx_RoomStatusBar_connectionLostBar_title">
                        { this.props.unsentMessageError }
                    </div>
                    <div className="mx_RoomStatusBar_connectionLostBar_desc">
                        <a className="mx_RoomStatusBar_resend_link"
                          onClick={ this.props.onResendAllClick }>
                            Resend all
                        </a> or <a
                          className="mx_RoomStatusBar_resend_link"
                          onClick={ this.props.onCancelAllClick }>
                            cancel all
                        </a> now. You can also select individual messages to
                        resend or cancel.
                    </div>
                </div>
            );
        }

        // unread count trumps who is typing since the unread count is only
        // set when you've scrolled up
        if (this.props.numUnreadMessages) {
            var unreadMsgs = this.props.numUnreadMessages + " new message" +
                (this.props.numUnreadMessages > 1 ? "s" : "");

            return (
                <div className="mx_RoomStatusBar_unreadMessagesBar"
                        onClick={ this.props.onScrollToBottomClick }>
                    {unreadMsgs}
                </div>
            );
        }

        const typingString = WhoIsTyping.whoIsTypingString(
            this.state.usersTyping,
            this.props.whoIsTypingLimit
        );
        if (typingString) {
            return (
                <div className="mx_RoomStatusBar_typingBar">
                    <EmojiText>{typingString}</EmojiText>
                </div>
            );
        }

        if (this.props.hasActiveCall) {
            return (
                <div className="mx_RoomStatusBar_callBar">
                    <b>Active call</b>
                </div>
            );
        }

        return null;
    },


    render: function() {
        var content = this._getContent();
        var indicator = this._getIndicator(this.state.usersTyping.length > 0);

        return (
            <div className="mx_RoomStatusBar">
                <div className="mx_RoomStatusBar_indicator">
                    {indicator}
                </div>
                {content}
            </div>
        );
    },
});
