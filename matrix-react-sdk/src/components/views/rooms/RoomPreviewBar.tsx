/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixError } from "matrix-js-sdk/src/http-api";
import { EventType, RoomType } from "matrix-js-sdk/src/@types/event";
import { IJoinRuleEventContent, JoinRule } from "matrix-js-sdk/src/@types/partials";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import classNames from "classnames";
import { RoomPreviewOpts, RoomViewLifecycle } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import IdentityAuthClient from "../../../IdentityAuthClient";
import InviteReason from "../elements/InviteReason";
import { IOOBData } from "../../../stores/ThreepidInviteStore";
import Spinner from "../elements/Spinner";
import AccessibleButton from "../elements/AccessibleButton";
import RoomAvatar from "../avatars/RoomAvatar";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { ModuleRunner } from "../../../modules/ModuleRunner";

const MemberEventHtmlReasonField = "io.element.html_reason";

enum MessageCase {
    NotLoggedIn = "NotLoggedIn",
    Joining = "Joining",
    Loading = "Loading",
    Rejecting = "Rejecting",
    Kicked = "Kicked",
    Banned = "Banned",
    OtherThreePIDError = "OtherThreePIDError",
    InvitedEmailNotFoundInAccount = "InvitedEmailNotFoundInAccount",
    InvitedEmailNoIdentityServer = "InvitedEmailNoIdentityServer",
    InvitedEmailMismatch = "InvitedEmailMismatch",
    Invite = "Invite",
    ViewingRoom = "ViewingRoom",
    RoomNotFound = "RoomNotFound",
    OtherError = "OtherError",
}

interface IProps {
    // if inviterName is specified, the preview bar will shown an invite to the room.
    // You should also specify onRejectClick if specifying inviterName
    inviterName?: string;

    // If invited by 3rd party invite, the email address the invite was sent to
    invitedEmail?: string;

    // For third party invites, information passed about the room out-of-band
    oobData?: IOOBData;

    // For third party invites, a URL for a 3pid invite signing service
    signUrl?: string;

    // A standard client/server API error object. If supplied, indicates that the
    // caller was unable to fetch details about the room for the given reason.
    error?: MatrixError;

    canPreview?: boolean;
    previewLoading?: boolean;

    // The id of the room to be previewed, if it is known.
    // (It may be unknown if we are waiting for an alias to be resolved.)
    roomId?: string;

    // A `Room` object for the room to be previewed, if we have one.
    room?: Room;

    loading?: boolean;
    joining?: boolean;
    rejecting?: boolean;
    // The alias that was used to access this room, if appropriate
    // If given, this will be how the room is referred to (eg.
    // in error messages).
    roomAlias?: string;

    onJoinClick?(): void;
    onRejectClick?(): void;
    onRejectAndIgnoreClick?(): void;
    onForgetClick?(): void;
}

interface IState {
    busy: boolean;
    accountEmails?: string[];
    invitedEmailMxid?: string;
    threePidFetchError?: MatrixError;
}

export default class RoomPreviewBar extends React.Component<IProps, IState> {
    public static defaultProps = {
        onJoinClick() {},
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            busy: false,
        };
    }

    public componentDidMount(): void {
        this.checkInvitedEmail();
    }

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        if (this.props.invitedEmail !== prevProps.invitedEmail || this.props.inviterName !== prevProps.inviterName) {
            this.checkInvitedEmail();
        }
    }

    private async checkInvitedEmail(): Promise<void> {
        // If this is an invite and we've been told what email address was
        // invited, fetch the user's account emails and discovery bindings so we
        // can check them against the email that was invited.
        if (this.props.inviterName && this.props.invitedEmail) {
            this.setState({ busy: true });
            try {
                // Gather the account 3PIDs
                const account3pids = await MatrixClientPeg.get().getThreePids();
                this.setState({
                    accountEmails: account3pids.threepids.filter((b) => b.medium === "email").map((b) => b.address),
                });
                // If we have an IS connected, use that to lookup the email and
                // check the bound MXID.
                if (!MatrixClientPeg.get().getIdentityServerUrl()) {
                    this.setState({ busy: false });
                    return;
                }
                const authClient = new IdentityAuthClient();
                const identityAccessToken = await authClient.getAccessToken();
                const result = await MatrixClientPeg.get().lookupThreePid(
                    "email",
                    this.props.invitedEmail,
                    identityAccessToken!,
                );
                this.setState({ invitedEmailMxid: result.mxid });
            } catch (err) {
                this.setState({ threePidFetchError: err });
            }
            this.setState({ busy: false });
        }
    }

    private getMessageCase(): MessageCase {
        const isGuest = MatrixClientPeg.get().isGuest();

        if (isGuest) {
            return MessageCase.NotLoggedIn;
        }

        const myMember = this.getMyMember();

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
                } else if (this.state.accountEmails && !this.state.accountEmails.includes(this.props.invitedEmail)) {
                    return MessageCase.InvitedEmailNotFoundInAccount;
                } else if (!MatrixClientPeg.get().getIdentityServerUrl()) {
                    return MessageCase.InvitedEmailNoIdentityServer;
                } else if (this.state.invitedEmailMxid != MatrixClientPeg.get().getUserId()) {
                    return MessageCase.InvitedEmailMismatch;
                }
            }
            return MessageCase.Invite;
        } else if (this.props.error) {
            if ((this.props.error as MatrixError).errcode == "M_NOT_FOUND") {
                return MessageCase.RoomNotFound;
            } else {
                return MessageCase.OtherError;
            }
        } else {
            return MessageCase.ViewingRoom;
        }
    }

    private getKickOrBanInfo(): { memberName?: string; reason?: string } {
        const myMember = this.getMyMember();
        if (!myMember) {
            return {};
        }

        const kickerUserId = myMember.events.member?.getSender();
        const kickerMember = kickerUserId ? this.props.room?.currentState.getMember(kickerUserId) : undefined;
        const memberName = kickerMember?.name ?? kickerUserId;
        const reason = myMember.events.member?.getContent().reason;
        return { memberName, reason };
    }

    private joinRule(): JoinRule | null {
        return (
            this.props.room?.currentState
                .getStateEvents(EventType.RoomJoinRules, "")
                ?.getContent<IJoinRuleEventContent>().join_rule ?? null
        );
    }

    private getMyMember(): RoomMember | null {
        return this.props.room?.getMember(MatrixClientPeg.get().getUserId()!) ?? null;
    }

    private getInviteMember(): RoomMember | null {
        const { room } = this.props;
        if (!room) {
            return null;
        }
        const myUserId = MatrixClientPeg.get().getUserId()!;
        const inviteEvent = room.currentState.getMember(myUserId);
        if (!inviteEvent) {
            return null;
        }
        const inviterUserId = inviteEvent.events.member?.getSender();
        return inviterUserId ? room.currentState.getMember(inviterUserId) : null;
    }

    private isDMInvite(): boolean {
        const myMember = this.getMyMember();
        if (!myMember) {
            return false;
        }
        const memberContent = myMember.events.member?.getContent();
        return memberContent?.membership === "invite" && memberContent.is_direct;
    }

    private makeScreenAfterLogin(): { screen: string; params: Record<string, any> } {
        return {
            screen: "room",
            params: {
                email: this.props.invitedEmail,
                signurl: this.props.signUrl,
                room_name: this.props.oobData?.name ?? null,
                room_avatar_url: this.props.oobData?.avatarUrl ?? null,
                inviter_name: this.props.oobData?.inviterName ?? null,
            },
        };
    }

    private onLoginClick = (): void => {
        dis.dispatch({ action: "start_login", screenAfterLogin: this.makeScreenAfterLogin() });
    };

    private onRegisterClick = (): void => {
        dis.dispatch({ action: "start_registration", screenAfterLogin: this.makeScreenAfterLogin() });
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;
        const roomName = this.props.room?.name ?? this.props.roomAlias ?? "";
        const isSpace = this.props.room?.isSpaceRoom() ?? this.props.oobData?.roomType === RoomType.Space;

        let showSpinner = false;
        let title: string | undefined;
        let subTitle: string | ReactNode[] | undefined;
        let reasonElement: JSX.Element | undefined;
        let primaryActionHandler: (() => void) | undefined;
        let primaryActionLabel: string | undefined;
        let secondaryActionHandler: (() => void) | undefined;
        let secondaryActionLabel: string | undefined;
        let footer: JSX.Element | undefined;
        const extraComponents: JSX.Element[] = [];

        const messageCase = this.getMessageCase();
        switch (messageCase) {
            case MessageCase.Joining: {
                if (this.props.oobData?.roomType || isSpace) {
                    title = isSpace ? _t("Joining space…") : _t("Joining room…");
                } else {
                    title = _t("Joining…");
                }

                showSpinner = true;
                break;
            }
            case MessageCase.Loading: {
                title = _t("Loading…");
                showSpinner = true;
                break;
            }
            case MessageCase.Rejecting: {
                title = _t("Rejecting invite…");
                showSpinner = true;
                break;
            }
            case MessageCase.NotLoggedIn: {
                const opts: RoomPreviewOpts = { canJoin: false };
                if (this.props.roomId) {
                    ModuleRunner.instance.invoke(RoomViewLifecycle.PreviewRoomNotLoggedIn, opts, this.props.roomId);
                }
                if (opts.canJoin) {
                    title = _t("Join the room to participate");
                    primaryActionLabel = _t("Join");
                    primaryActionHandler = () => {
                        ModuleRunner.instance.invoke(RoomViewLifecycle.JoinFromRoomPreview, this.props.roomId);
                    };
                } else {
                    title = _t("Join the conversation with an account");
                    if (SettingsStore.getValue(UIFeature.Registration)) {
                        primaryActionLabel = _t("Sign Up");
                        primaryActionHandler = this.onRegisterClick;
                    }
                    secondaryActionLabel = _t("Sign In");
                    secondaryActionHandler = this.onLoginClick;
                }
                if (this.props.previewLoading) {
                    footer = (
                        <div>
                            <Spinner w={20} h={20} />
                            {_t("Loading preview")}
                        </div>
                    );
                }
                break;
            }
            case MessageCase.Kicked: {
                const { memberName, reason } = this.getKickOrBanInfo();
                if (roomName) {
                    title = _t("You were removed from %(roomName)s by %(memberName)s", { memberName, roomName });
                } else {
                    title = _t("You were removed by %(memberName)s", { memberName });
                }
                subTitle = reason ? _t("Reason: %(reason)s", { reason }) : undefined;

                if (isSpace) {
                    primaryActionLabel = _t("Forget this space");
                } else {
                    primaryActionLabel = _t("Forget this room");
                }
                primaryActionHandler = this.props.onForgetClick;

                if (this.joinRule() !== JoinRule.Invite) {
                    secondaryActionLabel = primaryActionLabel;
                    secondaryActionHandler = primaryActionHandler;

                    primaryActionLabel = _t("Re-join");
                    primaryActionHandler = this.props.onJoinClick;
                }
                break;
            }
            case MessageCase.Banned: {
                const { memberName, reason } = this.getKickOrBanInfo();
                if (roomName) {
                    title = _t("You were banned from %(roomName)s by %(memberName)s", { memberName, roomName });
                } else {
                    title = _t("You were banned by %(memberName)s", { memberName });
                }
                subTitle = reason ? _t("Reason: %(reason)s", { reason }) : undefined;
                if (isSpace) {
                    primaryActionLabel = _t("Forget this space");
                } else {
                    primaryActionLabel = _t("Forget this room");
                }
                primaryActionHandler = this.props.onForgetClick;
                break;
            }
            case MessageCase.OtherThreePIDError: {
                if (roomName) {
                    title = _t("Something went wrong with your invite to %(roomName)s", { roomName });
                } else {
                    title = _t("Something went wrong with your invite.");
                }
                const joinRule = this.joinRule();
                const errCodeMessage = _t(
                    "An error (%(errcode)s) was returned while trying to validate your " +
                        "invite. You could try to pass this information on to the person who invited you.",
                    { errcode: this.state.threePidFetchError?.errcode || _t("unknown error code") },
                );
                switch (joinRule) {
                    case "invite":
                        subTitle = [_t("You can only join it with a working invite."), errCodeMessage];
                        primaryActionLabel = _t("Try to join anyway");
                        primaryActionHandler = this.props.onJoinClick;
                        break;
                    case "public":
                        subTitle = _t("You can still join here.");
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
            case MessageCase.InvitedEmailNotFoundInAccount: {
                if (roomName) {
                    title = _t(
                        "This invite to %(roomName)s was sent to %(email)s which is not " +
                            "associated with your account",
                        {
                            roomName,
                            email: this.props.invitedEmail,
                        },
                    );
                } else {
                    title = _t("This invite was sent to %(email)s which is not associated with your account", {
                        email: this.props.invitedEmail,
                    });
                }

                subTitle = _t(
                    "Link this email with your account in Settings to receive invites directly in %(brand)s.",
                    { brand },
                );
                primaryActionLabel = _t("Join the discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.InvitedEmailNoIdentityServer: {
                if (roomName) {
                    title = _t("This invite to %(roomName)s was sent to %(email)s", {
                        roomName,
                        email: this.props.invitedEmail,
                    });
                } else {
                    title = _t("This invite was sent to %(email)s", { email: this.props.invitedEmail });
                }

                subTitle = _t("Use an identity server in Settings to receive invites directly in %(brand)s.", {
                    brand,
                });
                primaryActionLabel = _t("Join the discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.InvitedEmailMismatch: {
                if (roomName) {
                    title = _t("This invite to %(roomName)s was sent to %(email)s", {
                        roomName,
                        email: this.props.invitedEmail,
                    });
                } else {
                    title = _t("This invite was sent to %(email)s", { email: this.props.invitedEmail });
                }

                subTitle = _t("Share this email in Settings to receive invites directly in %(brand)s.", { brand });
                primaryActionLabel = _t("Join the discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.Invite: {
                const avatar = <RoomAvatar room={this.props.room} oobData={this.props.oobData} />;

                const inviteMember = this.getInviteMember();
                let inviterElement: JSX.Element;
                if (inviteMember) {
                    inviterElement = (
                        <span>
                            <span className="mx_RoomPreviewBar_inviter">{inviteMember.rawDisplayName}</span> (
                            {inviteMember.userId})
                        </span>
                    );
                } else {
                    inviterElement = <span className="mx_RoomPreviewBar_inviter">{this.props.inviterName}</span>;
                }

                const isDM = this.isDMInvite();
                if (isDM) {
                    title = _t("Do you want to chat with %(user)s?", {
                        user: inviteMember?.name ?? this.props.inviterName,
                    });
                    subTitle = [avatar, _t("<userName/> wants to chat", {}, { userName: () => inviterElement })];
                    primaryActionLabel = _t("Start chatting");
                } else {
                    title = _t("Do you want to join %(roomName)s?", { roomName });
                    subTitle = [avatar, _t("<userName/> invited you", {}, { userName: () => inviterElement })];
                    primaryActionLabel = _t("Accept");
                }

                const myUserId = MatrixClientPeg.get().getUserId()!;
                const member = this.props.room?.currentState.getMember(myUserId);
                const memberEventContent = member?.events.member?.getContent();

                if (memberEventContent?.reason) {
                    reasonElement = (
                        <InviteReason
                            reason={memberEventContent.reason}
                            htmlReason={memberEventContent[MemberEventHtmlReasonField]}
                        />
                    );
                }

                primaryActionHandler = this.props.onJoinClick;
                secondaryActionLabel = _t("Reject");
                secondaryActionHandler = this.props.onRejectClick;

                if (this.props.onRejectAndIgnoreClick) {
                    extraComponents.push(
                        <AccessibleButton kind="secondary" onClick={this.props.onRejectAndIgnoreClick} key="ignore">
                            {_t("Reject & Ignore user")}
                        </AccessibleButton>,
                    );
                }
                break;
            }
            case MessageCase.ViewingRoom: {
                if (this.props.canPreview) {
                    title = _t("You're previewing %(roomName)s. Want to join it?", { roomName });
                } else if (roomName) {
                    title = _t("%(roomName)s can't be previewed. Do you want to join it?", { roomName });
                } else {
                    title = _t("There's no preview, would you like to join?");
                }
                primaryActionLabel = _t("Join the discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.RoomNotFound: {
                if (roomName) {
                    title = _t("%(roomName)s does not exist.", { roomName });
                } else {
                    title = _t("This room or space does not exist.");
                }
                subTitle = _t("Are you sure you're at the right place?");
                break;
            }
            case MessageCase.OtherError: {
                if (roomName) {
                    title = _t("%(roomName)s is not accessible at this time.", { roomName });
                } else {
                    title = _t("This room or space is not accessible at this time.");
                }
                subTitle = [
                    _t("Try again later, or ask a room or space admin to check if you have access."),
                    _t(
                        "%(errcode)s was returned while trying to access the room or space. " +
                            "If you think you're seeing this message in error, please " +
                            "<issueLink>submit a bug report</issueLink>.",
                        { errcode: String(this.props.error?.errcode) },
                        {
                            issueLink: (label) => (
                                <a
                                    href="https://github.com/vector-im/element-web/issues/new/choose"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                >
                                    {label}
                                </a>
                            ),
                        },
                    ),
                ];
                break;
            }
        }

        let subTitleElements;
        if (subTitle) {
            if (!Array.isArray(subTitle)) {
                subTitle = [subTitle];
            }
            subTitleElements = subTitle.map((t, i) => <p key={`subTitle${i}`}>{t}</p>);
        }

        let titleElement;
        if (showSpinner) {
            titleElement = (
                <h3 className="mx_RoomPreviewBar_spinnerTitle">
                    <Spinner />
                    {title}
                </h3>
            );
        } else {
            titleElement = <h3>{title}</h3>;
        }

        let primaryButton;
        if (primaryActionHandler) {
            primaryButton = (
                <AccessibleButton kind="primary" onClick={primaryActionHandler}>
                    {primaryActionLabel}
                </AccessibleButton>
            );
        }

        let secondaryButton;
        if (secondaryActionHandler) {
            secondaryButton = (
                <AccessibleButton kind="secondary" onClick={secondaryActionHandler}>
                    {secondaryActionLabel}
                </AccessibleButton>
            );
        }

        const isPanel = this.props.canPreview;

        const classes = classNames("mx_RoomPreviewBar", "dark-panel", `mx_RoomPreviewBar_${messageCase}`, {
            mx_RoomPreviewBar_panel: isPanel,
            mx_RoomPreviewBar_dialog: !isPanel,
        });

        // ensure correct tab order for both views
        const actions = isPanel ? (
            <>
                {secondaryButton}
                {extraComponents}
                {primaryButton}
            </>
        ) : (
            <>
                {primaryButton}
                {extraComponents}
                {secondaryButton}
            </>
        );

        return (
            <div className={classes}>
                <div className="mx_RoomPreviewBar_message">
                    {titleElement}
                    {subTitleElements}
                </div>
                {reasonElement}
                <div className="mx_RoomPreviewBar_actions">{actions}</div>
                <div className="mx_RoomPreviewBar_footer">{footer}</div>
            </div>
        );
    }
}
