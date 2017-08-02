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

'use strict';

var React = require('react');
var sdk = require('../../../index');
var MatrixClientPeg = require('../../../MatrixClientPeg');

import { _t, _tJsx } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'RoomPreviewBar',

    propTypes: {
        onJoinClick: React.PropTypes.func,
        onRejectClick: React.PropTypes.func,
        onForgetClick: React.PropTypes.func,

        // if inviterName is specified, the preview bar will shown an invite to the room.
        // You should also specify onRejectClick if specifiying inviterName
        inviterName: React.PropTypes.string,

        // If invited by 3rd party invite, the email address the invite was sent to
        invitedEmail: React.PropTypes.string,

        // A standard client/server API error object. If supplied, indicates that the
        // caller was unable to fetch details about the room for the given reason.
        error: React.PropTypes.object,

        canPreview: React.PropTypes.bool,
        spinner: React.PropTypes.bool,
        room: React.PropTypes.object,

        // The alias that was used to access this room, if appropriate
        // If given, this will be how the room is referred to (eg.
        // in error messages).
        roomAlias: React.PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            onJoinClick: function() {},
            canPreview: true,
        };
    },

    getInitialState: function() {
        return {
            busy: false
        };
    },

    componentWillMount: function() {
        // If this is an invite and we've been told what email
        // address was invited, fetch the user's list of 3pids
        // so we can check them against the one that was invited
        if (this.props.inviterName && this.props.invitedEmail) {
            this.setState({busy: true});
            MatrixClientPeg.get().lookupThreePid(
                'email', this.props.invitedEmail
            ).finally(() => {
                this.setState({busy: false});
            }).done((result) => {
                this.setState({invitedEmailMxid: result.mxid});
            }, (err) => {
                this.setState({threePidFetchError: err});
            });
        }
    },

    _roomNameElement: function(fallback) {
        fallback = fallback || _t('a room');
        const name = this.props.room ? this.props.room.name : (this.props.room_alias || "");
        return name ? name : fallback;
    },

    render: function() {
        var joinBlock, previewBlock;

        if (this.props.spinner || this.state.busy) {
            var Spinner = sdk.getComponent("elements.Spinner");
            return (<div className="mx_RoomPreviewBar">
                <Spinner />
            </div>);
        }

        const myMember = this.props.room ? this.props.room.currentState.members[
            MatrixClientPeg.get().credentials.userId
        ] : null;
        const kicked = (
            myMember &&
            myMember.membership == 'leave' &&
            myMember.events.member.getSender() != MatrixClientPeg.get().credentials.userId
        );
        const banned = myMember && myMember.membership == 'ban';

        if (this.props.inviterName) {
            var emailMatchBlock;
            if (this.props.invitedEmail) {
                if (this.state.threePidFetchError) {
                    emailMatchBlock = <div className="error">
                        {_t("Unable to ascertain that the address this invite was sent to matches one associated with your account.")}
                    </div>;
                } else if (this.state.invitedEmailMxid != MatrixClientPeg.get().credentials.userId) {
                    emailMatchBlock =
                        <div className="mx_RoomPreviewBar_warning">
                            <div className="mx_RoomPreviewBar_warningIcon">
                                <img src="img/warning.svg" width="24" height="23" title= "/!\\" alt="/!\\" />
                            </div>
                            <div className="mx_RoomPreviewBar_warningText">
                                {_t("This invitation was sent to an email address which is not associated with this account:")}
                                <b><span className="email">{this.props.invitedEmail}</span></b>
                                <br/>
                                {_t("You may wish to login with a different account, or add this email to this account.")}
                            </div>
                        </div>;
                }
            }
            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_invite_text">
                        { _t('You have been invited to join this room by %(inviterName)s', {inviterName: this.props.inviterName}) }
                    </div>
                    <div className="mx_RoomPreviewBar_join_text">
                        { _tJsx(
                            'Would you like to <acceptText>accept</acceptText> or <declineText>decline</declineText> this invitation?',
                            [/<acceptText>(.*?)<\/acceptText>/, /<declineText>(.*?)<\/declineText>/],
                            [
                                (sub) => <a onClick={ this.props.onJoinClick }>{sub}</a>,
                                (sub) => <a onClick={ this.props.onRejectClick }>{sub}</a>
                            ]
                        )}
                    </div>
                    {emailMatchBlock}
                </div>
            );

        } else if (kicked || banned) {
            const roomName = this._roomNameElement(_t('This room'));
            const kickerMember = this.props.room.currentState.getMember(
                myMember.events.member.getSender()
            );
            const kickerName = kickerMember ?
                kickerMember.name : myMember.events.member.getSender();
            let reason;
            if (myMember.events.member.getContent().reason) {
                reason = <div>{_t("Reason: %(reasonText)s", {reasonText: myMember.events.member.getContent().reason})}</div>
            }
            let rejoinBlock;
            if (!banned) {
                rejoinBlock = <div><a onClick={ this.props.onJoinClick }><b>{_t("Rejoin")}</b></a></div>;
            }

            let actionText;
            if (kicked) {
                actionText = _t("You have been kicked from %(roomName)s by %(userName)s.", {roomName: roomName, userName: kickerName});
            }
            else if (banned) {
                actionText = _t("You have been banned from %(roomName)s by %(userName)s.", {roomName: roomName, userName: kickerName});
            } // no other options possible due to the kicked || banned check above.

            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_join_text">
                        {actionText}
                        <br />
                        {reason}
                        {rejoinBlock}
                        <a onClick={ this.props.onForgetClick }><b>{_t("Forget room")}</b></a>
                    </div>
                </div>
            );
        } else if (this.props.error) {
            var name = this.props.roomAlias || _t("This room");
            var error;
            if (this.props.error.errcode == 'M_NOT_FOUND') {
                error = _t("%(roomName)s does not exist.", {roomName: name});
            } else {
                error = _t("%(roomName)s is not accessible at this time.", {roomName: name});
            }
            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_join_text">
                        { error }
                    </div>
                </div>
            );
        } else {
            const name = this._roomNameElement();
            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_join_text">
                        { _t('You are trying to access %(roomName)s.', {roomName: name}) }
                        <br/>
                        { _tJsx("<a>Click here</a> to join the discussion!",
                            /<a>(.*?)<\/a>/,
                            (sub) => <a onClick={ this.props.onJoinClick }><b>{sub}</b></a>
                        )}
                    </div>
                </div>
            );
        }

        if (this.props.canPreview) {
            previewBlock = (
                <div className="mx_RoomPreviewBar_preview_text">
                    { _t('This is a preview of this room. Room interactions have been disabled') }.
                </div>
            );
        }

        return (
            <div className="mx_RoomPreviewBar">
                <div className="mx_RoomPreviewBar_wrapper">
                    { joinBlock }
                    { previewBlock }
                </div>
            </div>
        );
    }
});
