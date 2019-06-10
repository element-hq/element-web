/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import PropTypes from 'prop-types';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import dis from '../../../dispatcher';
import classNames from 'classnames';
import { _t } from '../../../languageHandler';

const MessageCase = Object.freeze({
    NotLoggedIn: "NotLoggedIn",
    Joining: "Joining",
    Loading: "Loading",
    Rejecting: "Rejecting",
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
        // if inviterName is specified, the preview bar will shown an invite to the room.
        // You should also specify onRejectClick if specifiying inviterName
        inviterName: PropTypes.string,

        // If invited by 3rd party invite, the email address the invite was sent to
        invitedEmail: PropTypes.string,

        // For third party invites, information passed about the room out-of-band
        oobData: PropTypes.object,

        // For third party invites, a URL for a 3pid invite signing service
        signUrl: PropTypes.string,

        // A standard client/server API error object. If supplied, indicates that the
        // caller was unable to fetch details about the room for the given reason.
        error: PropTypes.object,

        canPreview: PropTypes.bool,
        room: PropTypes.object,

        // When a spinner is present, a spinnerState can be specified to indicate the
        // purpose of the spinner.
        spinner: PropTypes.bool,
        spinnerState: PropTypes.oneOf(["joining"]),
        loading: PropTypes.bool,
        joining: PropTypes.bool,
        rejecting: PropTypes.bool,
        // The alias that was used to access this room, if appropriate
        // If given, this will be how the room is referred to (eg.
        // in error messages).
        roomAlias: PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            onJoinClick: function() {},
        };
    },

    getInitialState: function() {
        return {
            busy: false,
        };
    },

    componentWillMount: function() {
        this._checkInvitedEmail();
    },

    componentDidUpdate: function(prevProps, prevState) {
        if (this.props.invitedEmail !== prevProps.invitedEmail || this.props.inviterName !== prevProps.inviterName) {
            this._checkInvitedEmail();
        }
    },

    _checkInvitedEmail: function() {
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
        const isGuest = MatrixClientPeg.get().isGuest();

        if (isGuest) {
            return MessageCase.NotLoggedIn;
        }

        const myMember = this._getMyMember();

        if (myMember) {
            if (myMember.isKicked()) {
                return MessageCase.Kicked;
            } else if (myMember.membership === "ban") {
                return MessageCase.Banned;
            }
        }

        if (this.props.joining) {
            return MessageCase.Joining;
        } else if (this.props.rejecting) {
            return MessageCase.Rejecting;
        } else if (this.props.loading || this.state.busy) {
            return MessageCase.Loading;
        }

        if (this.props.inviterName) {
            if (this.props.invitedEmail) {
                if (this.state.threePidFetchError) {
                    return MessageCase.OtherThreePIDError;
                } else if (this.state.invitedEmailMxid != MatrixClientPeg.get().getUserId()) {
                    return MessageCase.InvitedEmailMismatch;
                }
            }
            return MessageCase.Invite;
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
        const myMember = this._getMyMember();
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

    _roomName: function(atStart = false) {
        const name = this.props.room ? this.props.room.name : this.props.roomAlias;
        if (name) {
            return name;
        } else if (atStart) {
            return _t("This room");
        } else {
            return _t("this room");
        }
    },

    _getMyMember() {
        return (
            this.props.room &&
            this.props.room.getMember(MatrixClientPeg.get().getUserId())
        );
    },

    _getInviteMember: function() {
        const {room} = this.props;
        if (!room) {
            return;
        }
        const myUserId = MatrixClientPeg.get().getUserId();
        const inviteEvent = room.currentState.getMember(myUserId);
        if (!inviteEvent) {
            return;
        }
        const inviterUserId = inviteEvent.events.member.getSender();
        return room.currentState.getMember(inviterUserId);
    },

    _isDMInvite() {
        const myMember = this._getMyMember();
        if (!myMember) {
            return false;
        }
        const memberEvent = myMember.events.member;
        const memberContent = memberEvent.getContent();
        return memberContent.membership === "invite" && memberContent.is_direct;
    },

    _makeScreenAfterLogin() {
        return {
            screen: 'room',
            params: {
                email: this.props.invitedEmail,
                signurl: this.props.signUrl,
                room_name: this.props.oobData.room_name,
                room_avatar_url: this.props.oobData.avatarUrl,
                inviter_name: this.props.oobData.inviterName,
            }
        };
    },

    onLoginClick: function() {
        dis.dispatch({ action: 'start_login', screenAfterLogin: this._makeScreenAfterLogin() });
    },

    onRegisterClick: function() {
        dis.dispatch({ action: 'start_registration', screenAfterLogin: this._makeScreenAfterLogin() });
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

        const messageCase = this._getMessageCase();
        switch (messageCase) {
            case MessageCase.Joining: {
                title = _t("Joining room …");
                showSpinner = true;
                break;
            }
            case MessageCase.Loading: {
                title = _t("Loading …");
                showSpinner = true;
                break;
            }
            case MessageCase.Rejecting: {
                title = _t("Rejecting invite …");
                showSpinner = true;
                break;
            }
            case MessageCase.NotLoggedIn: {
                darkStyle = true;
                title = _t("Join the conversation with an account");
                primaryActionLabel = _t("Sign Up");
                primaryActionHandler = this.onRegisterClick;
                secondaryActionLabel = _t("Sign In");
                secondaryActionHandler = this.onLoginClick;
                break;
            }
            case MessageCase.Kicked: {
                const {memberName, reason} = this._getKickOrBanInfo();
                title = _t("You were kicked from %(roomName)s by %(memberName)s",
                    {memberName, roomName: this._roomName()});
                subTitle = _t("Reason: %(reason)s", {reason});

                if (this._joinRule() === "invite") {
                    primaryActionLabel = _t("Forget this room");
                    primaryActionHandler = this.props.onForgetClick;
                } else {
                    primaryActionLabel = _t("Re-join");
                    primaryActionHandler = this.props.onJoinClick;
                    secondaryActionLabel = _t("Forget this room");
                    secondaryActionHandler = this.props.onForgetClick;
                }
                break;
            }
            case MessageCase.Banned: {
                const {memberName, reason} = this._getKickOrBanInfo();
                title = _t("You were banned from %(roomName)s by %(memberName)s",
                    {memberName, roomName: this._roomName()});
                subTitle = _t("Reason: %(reason)s", {reason});
                primaryActionLabel = _t("Forget this room");
                primaryActionHandler = this.props.onForgetClick;
                break;
            }
            case MessageCase.OtherThreePIDError: {
                title = _t("Something went wrong with your invite to %(roomName)s",
                    {roomName: this._roomName()});
                const joinRule = this._joinRule();
                const errCodeMessage = _t("%(errcode)s was returned while trying to valide your invite. You could try to pass this information on to a room admin.",
                    {errcode: this.state.threePidFetchError.errcode},
                );
                switch (joinRule) {
                    case "invite":
                        subTitle = [
                            _t("You can only join it with a working invite."),
                            errCodeMessage,
                        ];
                        break;
                    case "public":
                        subTitle = _t("You can still join it because this is a public room.");
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
                title = _t("This invite to %(roomName)s wasn't sent to your account",
                    {roomName: this._roomName()});
                const joinRule = this._joinRule();
                if (joinRule === "public") {
                    subTitle = _t("You can still join it because this is a public room.");
                    primaryActionLabel = _t("Join the discussion");
                    primaryActionHandler = this.props.onJoinClick;
                } else {
                    subTitle = _t(
                        "Sign in with a different account, ask for another invite, or " +
                        "add the e-mail address %(email)s to this account.",
                        {email: this.props.invitedEmail},
                    );
                    if (joinRule !== "invite") {
                        primaryActionLabel = _t("Try to join anyway");
                        primaryActionHandler = this.props.onJoinClick;
                    }
                }
                break;
            }
            case MessageCase.Invite: {
                const RoomAvatar = sdk.getComponent("views.avatars.RoomAvatar");
                const avatar = <RoomAvatar room={this.props.room} oobData={this.props.oobData} />;

                const inviteMember = this._getInviteMember();
                let inviterElement;
                if (inviteMember) {
                    inviterElement = <span>
                        <span className="mx_RoomPreviewBar_inviter">
                            {inviteMember.rawDisplayName}
                        </span> ({inviteMember.userId})
                    </span>;
                } else {
                    inviterElement = (<span className="mx_RoomPreviewBar_inviter">{this.props.inviterName}</span>);
                }

                const isDM = this._isDMInvite();
                if (isDM) {
                    title = _t("Do you want to chat with %(user)s?",
                        { user: inviteMember.name });
                } else {
                    title = _t("Do you want to join %(roomName)s?",
                        { roomName: this._roomName() });
                }
                subTitle = [
                    avatar,
                    _t("<userName/> invited you", {}, {userName: () => inviterElement}),
                ];

                primaryActionLabel = _t("Accept");
                primaryActionHandler = this.props.onJoinClick;
                secondaryActionLabel = _t("Reject");
                secondaryActionHandler = this.props.onRejectClick;
                break;
            }
            case MessageCase.ViewingRoom: {
                if (this.props.canPreview) {
                    title = _t("You're previewing %(roomName)s. Want to join it?",
                        {roomName: this._roomName()});
                } else {
                    title = _t("%(roomName)s can't be previewed. Do you want to join it?",
                        {roomName: this._roomName(true)});
                }
                primaryActionLabel = _t("Join the discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.RoomNotFound: {
                title = _t("%(roomName)s does not exist.", {roomName: this._roomName(true)});
                subTitle = _t("This room doesn't exist. Are you sure you're at the right place?");
                break;
            }
            case MessageCase.OtherError: {
                title = _t("%(roomName)s is not accessible at this time.", {roomName: this._roomName(true)});
                subTitle = [
                    _t("Try again later, or ask a room admin to check if you have access."),
                    _t(
                        "%(errcode)s was returned while trying to access the room. " +
                        "If you think you're seeing this message in error, please " +
                        "<issueLink>submit a bug report</issueLink>.",
                        { errcode: this.props.error.errcode },
                        { issueLink: label => <a href="https://github.com/vector-im/riot-web/issues/new/choose"
                            target="_blank" rel="noopener">{ label }</a> },
                    ),
                ];
                break;
            }
        }

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const Spinner = sdk.getComponent('elements.Spinner');

        let subTitleElements;
        if (subTitle) {
            if (!Array.isArray(subTitle)) {
                subTitle = [subTitle];
            }
            subTitleElements = subTitle.map((t, i) => <p key={`subTitle${i}`}>{t}</p>);
        }

        let titleElement;
        if (showSpinner) {
            titleElement = <h3 className="mx_RoomPreviewBar_spinnerTitle"><Spinner />{ title }</h3>;
        } else {
            titleElement = <h3>{ title }</h3>;
        }

        let primaryButton;
        if (primaryActionHandler) {
            primaryButton = (
                <AccessibleButton kind="primary" onClick={primaryActionHandler}>
                    { primaryActionLabel }
                </AccessibleButton>
            );
        }

        let secondaryButton;
        if (secondaryActionHandler) {
            secondaryButton = (
                <AccessibleButton kind="secondary" onClick={secondaryActionHandler}>
                    { secondaryActionLabel }
                </AccessibleButton>
            );
        }

        const classes = classNames("mx_RoomPreviewBar", "dark-panel", `mx_RoomPreviewBar_${messageCase}`, {
            "mx_RoomPreviewBar_panel": this.props.canPreview,
            "mx_RoomPreviewBar_dialog": !this.props.canPreview,
            "mx_RoomPreviewBar_dark": darkStyle,
        });

        return (
            <div className={classes}>
                <div className="mx_RoomPreviewBar_message">
                    { titleElement }
                    { subTitleElements }
                </div>
                <div className="mx_RoomPreviewBar_actions">
                    { secondaryButton }
                    { primaryButton }
                </div>
            </div>
        );
    },
});
