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
import classNames from 'classnames';

import { _t } from '../../../languageHandler';

const MessageCase = Object.freeze({
    NotLoggedIn: "NotLoggedIn",
    Joining: "Joining",
    Busy: "Busy",
    Kicked: "Kicked",
    Banned: "Banned",
    OtherThreePIDError: "OtherThreePIDError",
    InvitedEmailMismatch: "InvitedEmailMismatch",
    Invite: "Invite",
    ViewingRoom: "ViewingRoom",
    RoomNotFound: "RoomNotFound",
    OtherError: "OtherError",
});

module.exports = React.createClass({
    displayName: 'RoomPreviewBar',

    propTypes: {
        onJoinClick: PropTypes.func,
        onRejectClick: PropTypes.func,
        onForgetClick: PropTypes.func,
        onSignInClick: PropTypes.func,
        onSignUpClick: PropTypes.func,

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
        // address was invited, fetch the user's list of Threepids
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

    _getMessageCase() {
        if (this.props.spinner || this.state.busy) {
            if (this.props.spinnerState === "joining") {
                return MessageCase.Joining;
            } else {
                return MessageCase.Busy;
            }
        }
        const myMember = this.props.room ?
            this.props.room.getMember(MatrixClientPeg.get().getUserId()) :
            null;

        if (this.props.inviterName) {
            if (this.props.invitedEmail) {
                if (this.state.threePidFetchError) {
                    return MessageCase.OtherThreePIDError;
                } else if (this.state.invitedEmailMxid != MatrixClientPeg.get().credentials.userId) {
                    return MessageCase.InvitedEmailMismatch;
                }
            }
            return MessageCase.Invite;
        } else if (myMember && myMember.isKicked()) {
            return MessageCase.Kicked;
        } else if (myMember && myMember && myMember.membership == 'ban') {
            return MessageCase.Banned;
        } else if (this.props.error) {
            if (this.props.error.errcode == 'M_NOT_FOUND') {
                return MessageCase.RoomNotFound;
            } else {
                return MessageCase.OtherError;
            }
        } else {
            return MessageCase.ViewingRoom;
        }
    },

    _getKickOrBanInfo() {
        const myMember = this.props.room ?
            this.props.room.getMember(MatrixClientPeg.get().getUserId()) :
            null;
        if (!myMember) {
            return {};
        }
        const kickerMember = this.props.room.currentState.getMember(
            myMember.events.member.getSender(),
        );
        const memberName = kickerMember ?
            kickerMember.name : myMember.events.member.getSender();
        const reason = myMember.events.member.getContent().reason;
        return {memberName, reason};
    },

    _joinRule: function() {
        const room = this.props.room;
        if (room) {
            const joinRules = room.currentState.getStateEvents('m.room.join_rules', '');
            if (joinRules) {
                return joinRules.getContent().join_rule;
            }
        }
    },

    _roomName: function() {
        return this.props.room ? this.props.room.name : (this.props.room_alias || _t("This room"));
    },

    render: function() {
        let showSpinner = false;
        let darkStyle = false;
        let title;
        let subTitle;
        let primaryActionHandler;
        let primaryActionLabel;
        let secondaryActionHandler;
        let secondaryActionLabel;

        switch (this._getMessageCase()) {
            case MessageCase.Joining: {
                title = _t("Joining room...");
                showSpinner = true;
                break;
            }
            case MessageCase.Busy: {
                title = _t("In progress ...");
                showSpinner = true;
                break;
            }
            case MessageCase.NotLoggedIn: {
                darkStyle = true;
                title = _t("Join the conversation with an account");
                primaryActionLabel = _t("Sign Up");
                primaryActionHandler = this.props.onSignUpClick;
                secondaryActionLabel = _t("Sign In");
                secondaryActionHandler = this.props.onSignInClick;
                break;
            }
            case MessageCase.Kicked: {
                const {memberName, reason} = this._getKickOrBanInfo();
                title = _t("You were kicked from this room by %(memberName)s", {memberName});
                subTitle = _t("Reason: %(reason)s", {reason});
                primaryActionLabel = _t("Re-join");
                primaryActionHandler = this.props.onJoinClick;
                secondaryActionLabel = _t("Forget this room");
                secondaryActionHandler = this.props.onForgetClick;
                break;
            }
            case MessageCase.Banned: {
                const {memberName, reason} = this._getKickOrBanInfo();
                title = _t("You were banned from this room by %(memberName)s", {memberName});
                subTitle = _t("Reason: %(reason)s", {reason});
                primaryActionLabel = _t("Forget this room");
                primaryActionHandler = this.props.onForgetClick;
                break;
            }
            case MessageCase.OtherThreePIDError: {
                title = _t("Something went wrong with your invite to this room");
                const joinRule = this._joinRule();
                const errCodeMessage = _t("%(errcode)s was returned while trying to valide your invite. You could try to pass this information on to a room admin.", {errcode: this.state.threePidFetchError.errcode});
                switch (joinRule) {
                    case "invite":
                        subTitle = [
                            <p key="subTitle1">{_t("Sadly, you can only join it with a working invite.")}</p>,
                            <p key="subTitle2">{ errCodeMessage }</p>,
                        ];
                        break;
                    case "public":
                        subTitle = _t("Luckily, you can still join it because this is a public room.");
                        primaryActionLabel = _t("Join the discussion");
                        primaryActionHandler = this.props.onJoinClick;
                        break;
                    default:
                        subTitle = errCodeMessage;
                        primaryActionLabel = _t("Try to join anyway");
                        primaryActionHandler = this.props.onJoinClick;
                        break;
                }
                break;
            }
            case MessageCase.InvitedEmailMismatch: {
                title = _t("The room invite wasn't sent to your account");
                const joinRule = this._joinRule();
                switch (joinRule) {
                    case "public":
                        subTitle = _t("Luckily, you can still join it because this is a public room.");
                        primaryActionLabel = _t("Join the discussion");
                        primaryActionHandler = this.props.onJoinClick;
                        break;
                    default:
                        subTitle = _t("Sign in with a different account, ask for another invite, or add the e-mail address %(email)s to this account.", {email: this.props.invitedEmail});
                        if (joinRule !== "invite") {
                            primaryActionLabel = _t("Try to join anyway");
                            primaryActionHandler = this.props.onJoinClick;
                        }
                        break;
                }
                break;
            }
            case MessageCase.Invite: {
                if (this.props.canPreview) {
                    title = _t("%(memberName)s invited you to this room", {memberName: this.props.inviterName});
                } else {
                    title = _t("Do you want to join this room?");
                    subTitle = _t("%(memberName)s invited you", {memberName: this.props.inviterName});
                }
                primaryActionLabel = _t("Accept");
                primaryActionHandler = this.props.onJoinClick;
                secondaryActionLabel = _t("Reject");
                secondaryActionHandler = this.props.onRejectClick;
                break;
            }
            case MessageCase.ViewingRoom: {
                if (this.props.canPreview) {
                    title = _t("You're previewing this room. Want to join it?");
                } else {
                    title = _t("This room can't be previewed. Do you want to join it?");
                }
                primaryActionLabel = _t("Join the discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.RoomNotFound: {
                title = _t("%(roomName)s does not exist.", {roomName: this._roomName()});
                subTitle = _t("This room doesn't exist. Are you sure you're at the right place?");
                break;
            }
            case MessageCase.OtherError: {
                title = _t("%(roomName)s is not accessible at this time.", {roomName: this._roomName()});
                subTitle = ([
                    <p key="subTitle1">{ _t("Try again later, or ask a room admin to check if you have access.") }</p>,
                    <p key="subTitle2">{ _t("%(errcode)s was returned when trying to access the room.", {errcode: this.props.error.errcode}) }</p>,
                    <p key="subTitle3">{ _t("If you think you're seeing this message in error, please <issueLink>submit a bug report</issueLink>.", {}, {
                        issueLink: label => <a href="https://github.com/vector-im/riot-web/issues/new/choose"
                                                  target="_blank" rel="noopener">{ label }</a>,
                    }) }</p>,
                ]);
                break;
            }
        }

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        let subTitleElements;
        if (subTitle) {
            if (Array.isArray(subTitle)) {
                subTitleElements = subTitle;
            } else {
                subTitleElements = [<p key="subTitle1">{ subTitle }</p>];
            }
        }

        const classes = classNames("mx_RoomPreviewBar", "dark-panel", {
            "mx_RoomPreviewBar_panel": this.props.canPreview,
            "mx_RoomPreviewBar_dialog": !this.props.canPreview,
        });

        return (
            <div className={classes}>
                <div className="mx_RoomPreviewBar_message">
                    <h3>{ title }</h3>
                    { subTitleElements }
                </div>
                <div className="mx_RoomPreviewBar_actions">
                    { secondaryActionHandler ? <AccessibleButton kind="secondary" onClick={secondaryActionHandler}>{ secondaryActionLabel }</AccessibleButton> : undefined }
                    { primaryActionHandler ? <AccessibleButton kind="primary" onClick={primaryActionHandler}>{ primaryActionLabel }</AccessibleButton> : undefined }
                </div>
            </div>
        );


    },
});
