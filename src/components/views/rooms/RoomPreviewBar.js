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

const React = require('react');
import PropTypes from 'prop-types';
const sdk = require('../../../index');
const MatrixClientPeg = require('../../../MatrixClientPeg');

import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'RoomPreviewBar',

    propTypes: {
        onJoinClick: PropTypes.func,
        onRejectClick: PropTypes.func,
        onForgetClick: PropTypes.func,

        // if inviterName is specified, the preview bar will shown an invite to the room.
        // You should also specify onRejectClick if specifiying inviterName
        inviterName: PropTypes.string,

        // If invited by 3rd party invite, the email address the invite was sent to
        invitedEmail: PropTypes.string,

        // A standard client/server API error object. If supplied, indicates that the
        // caller was unable to fetch details about the room for the given reason.
        error: PropTypes.object,

        canPreview: PropTypes.bool,
        room: PropTypes.object,

        // When a spinner is present, a spinnerState can be specified to indicate the
        // purpose of the spinner.
        spinner: PropTypes.bool,
        spinnerState: PropTypes.oneOf(["joining"]),

        // The alias that was used to access this room, if appropriate
        // If given, this will be how the room is referred to (eg.
        // in error messages).
        roomAlias: PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            onJoinClick: function() {},
            canPreview: true,
        };
    },

    getInitialState: function() {
        return {
            busy: false,
        };
    },

    componentWillMount: function() {
        // If this is an invite and we've been told what email
        // address was invited, fetch the user's list of 3pids
        // so we can check them against the one that was invited
        if (this.props.inviterName && this.props.invitedEmail) {
            this.setState({busy: true});
            MatrixClientPeg.get().lookupThreePid(
                'email', this.props.invitedEmail,
            ).finally(() => {
                this.setState({busy: false});
            }).done((result) => {
                this.setState({invitedEmailMxid: result.mxid});
            }, (err) => {
                this.setState({threePidFetchError: err});
            });
        }
    },

    _roomNameElement: function() {
        return this.props.room ? this.props.room.name : (this.props.room_alias || "");
    },

    render: function() {
        let joinBlock; let previewBlock;

        if (this.props.spinner || this.state.busy) {
            const Spinner = sdk.getComponent("elements.Spinner");
            let spinnerIntro = "";
            if (this.props.spinnerState === "joining") {
                spinnerIntro = _t("Joining room...");
            }
            return (<div className="mx_RoomPreviewBar">
                <p className="mx_RoomPreviewBar_spinnerIntro">{ spinnerIntro }</p>
                <Spinner />
            </div>);
        }

        const myMember = this.props.room ?
            this.props.room.getMember(MatrixClientPeg.get().getUserId()) :
            null;
        const kicked = myMember && myMember.isKicked();
        const banned = myMember && myMember && myMember.membership == 'ban';

        if (this.props.inviterName) {
            let emailMatchBlock;
            if (this.props.invitedEmail) {
                if (this.state.threePidFetchError) {
                    emailMatchBlock = <div className="error">
                        { _t("Unable to ascertain that the address this invite was sent to matches one associated with your account.") }
                    </div>;
                } else if (this.state.invitedEmailMxid != MatrixClientPeg.get().credentials.userId) {
                    emailMatchBlock =
                        <div className="mx_RoomPreviewBar_warning">
                            <div className="mx_RoomPreviewBar_warningIcon">
                                <img src="img/warning.svg" width="24" height="23" title= "/!\\" alt="/!\\" />
                            </div>
                            <div className="mx_RoomPreviewBar_warningText">
                                { _t("This invitation was sent to an email address which is not associated with this account:") }
                                <b><span className="email">{ this.props.invitedEmail }</span></b>
                                <br />
                                { _t("You may wish to login with a different account, or add this email to this account.") }
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
                        { _t(
                            'Would you like to <acceptText>accept</acceptText> or <declineText>decline</declineText> this invitation?',
                            {},
                            {
                                'acceptText': (sub) => <a onClick={this.props.onJoinClick}>{ sub }</a>,
                                'declineText': (sub) => <a onClick={this.props.onRejectClick}>{ sub }</a>,
                            },
                        ) }
                    </div>
                    { emailMatchBlock }
                </div>
            );
        } else if (kicked || banned) {
            const roomName = this._roomNameElement();
            const kickerMember = this.props.room.currentState.getMember(
                myMember.events.member.getSender(),
            );
            const kickerName = kickerMember ?
                kickerMember.name : myMember.events.member.getSender();
            let reason;
            if (myMember.events.member.getContent().reason) {
                reason = <div>{ _t("Reason: %(reasonText)s", {reasonText: myMember.events.member.getContent().reason}) }</div>;
            }
            let rejoinBlock;
            if (!banned) {
                rejoinBlock = <div><a onClick={this.props.onJoinClick}><b>{ _t("Rejoin") }</b></a></div>;
            }

            let actionText;
            if (kicked) {
                if (roomName) {
                    actionText = _t("You have been kicked from %(roomName)s by %(userName)s.", {roomName: roomName, userName: kickerName});
                } else {
                    actionText = _t("You have been kicked from this room by %(userName)s.", {userName: kickerName});
                }
            } else if (banned) {
                if (roomName) {
                    actionText = _t("You have been banned from %(roomName)s by %(userName)s.", {roomName: roomName, userName: kickerName});
                } else {
                    actionText = _t("You have been banned from this room by %(userName)s.", {userName: kickerName});
                }
            } // no other options possible due to the kicked || banned check above.

            joinBlock = (
                <div>
                    <div className="mx_RoomPreviewBar_join_text">
                        { actionText }
                        <br />
                        { reason }
                        { rejoinBlock }
                        <a onClick={this.props.onForgetClick}><b>{ _t("Forget room") }</b></a>
                    </div>
                </div>
            );
        } else if (this.props.error) {
            const name = this.props.roomAlias || _t("This room");
            let error;
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
                        { name ? _t('You are trying to access %(roomName)s.', {roomName: name}) : _t('You are trying to access a room.') }
                        <br />
                        { _t("<a>Click here</a> to join the discussion!",
                            {},
                            { 'a': (sub) => <a onClick={this.props.onJoinClick}><b>{ sub }</b></a> },
                        ) }
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
    },
});
