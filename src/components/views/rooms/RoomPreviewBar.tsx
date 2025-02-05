/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type ReactNode } from "react";
import { type Room, type RoomMember, EventType, RoomType, JoinRule, type MatrixError } from "matrix-js-sdk/src/matrix";
import { KnownMembership, type RoomJoinRulesEventContent } from "matrix-js-sdk/src/types";
import classNames from "classnames";
import {
    type RoomPreviewOpts,
    RoomViewLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import { _t, UserFriendlyError } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import IdentityAuthClient from "../../../IdentityAuthClient";
import InviteReason from "../elements/InviteReason";
import { type IOOBData } from "../../../stores/ThreepidInviteStore";
import Spinner from "../elements/Spinner";
import AccessibleButton from "../elements/AccessibleButton";
import RoomAvatar from "../avatars/RoomAvatar";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { ModuleRunner } from "../../../modules/ModuleRunner";
import { Icon as AskToJoinIcon } from "../../../../res/img/element-icons/ask-to-join.svg";
import Field from "../elements/Field";

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
    PromptAskToJoin = "PromptAskToJoin",
    Knocked = "Knocked",
    RequestDenied = "requestDenied",
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

    canAskToJoinAndMembershipIsLeave?: boolean;
    promptAskToJoin?: boolean;
    knocked?: boolean;
    onSubmitAskToJoin?(reason?: string): void;
    onCancelAskToJoin?(): void;
}

interface IState {
    busy: boolean;
    accountEmails?: string[];
    invitedEmailMxid?: string;
    threePidFetchError?: MatrixError;
    reason?: string;
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
                const account3pids = await MatrixClientPeg.safeGet().getThreePids();
                this.setState({
                    accountEmails: account3pids.threepids.filter((b) => b.medium === "email").map((b) => b.address),
                });
                // If we have an IS connected, use that to lookup the email and
                // check the bound MXID.
                if (!MatrixClientPeg.safeGet().getIdentityServerUrl()) {
                    this.setState({ busy: false });
                    return;
                }
                const authClient = new IdentityAuthClient();
                const identityAccessToken = await authClient.getAccessToken();
                const result = await MatrixClientPeg.safeGet().lookupThreePid(
                    "email",
                    this.props.invitedEmail,
                    identityAccessToken!,
                );
                if (!("mxid" in result)) {
                    throw new UserFriendlyError("room|error_3pid_invite_email_lookup");
                }
                this.setState({ invitedEmailMxid: result.mxid });
            } catch (err) {
                this.setState({ threePidFetchError: err as MatrixError });
            }
            this.setState({ busy: false });
        }
    }

    private getMessageCase(): MessageCase {
        const isGuest = MatrixClientPeg.safeGet().isGuest();

        if (isGuest) {
            return MessageCase.NotLoggedIn;
        }

        const myMember = this.getMyMember();

        if (myMember) {
            const previousMembership = myMember.events.member?.getPrevContent().membership;
            if (myMember.isKicked()) {
                if (previousMembership === KnownMembership.Knock) {
                    return MessageCase.RequestDenied;
                } else if (this.props.promptAskToJoin) {
                    return MessageCase.PromptAskToJoin;
                }
                return MessageCase.Kicked;
            } else if (myMember.membership === KnownMembership.Ban) {
                return MessageCase.Banned;
            }
        }

        if (this.props.joining) {
            return MessageCase.Joining;
        } else if (this.props.rejecting) {
            return MessageCase.Rejecting;
        } else if (this.props.loading || this.state.busy) {
            return MessageCase.Loading;
        } else if (this.props.knocked) {
            return MessageCase.Knocked;
        } else if (this.props.canAskToJoinAndMembershipIsLeave || this.props.promptAskToJoin) {
            return MessageCase.PromptAskToJoin;
        }

        if (this.props.inviterName) {
            if (this.props.invitedEmail) {
                if (this.state.threePidFetchError) {
                    return MessageCase.OtherThreePIDError;
                } else if (this.state.accountEmails && !this.state.accountEmails.includes(this.props.invitedEmail)) {
                    return MessageCase.InvitedEmailNotFoundInAccount;
                } else if (!MatrixClientPeg.safeGet().getIdentityServerUrl()) {
                    return MessageCase.InvitedEmailNoIdentityServer;
                } else if (this.state.invitedEmailMxid != MatrixClientPeg.safeGet().getUserId()) {
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
                ?.getContent<RoomJoinRulesEventContent>().join_rule ?? null
        );
    }

    private getMyMember(): RoomMember | null {
        return this.props.room?.getMember(MatrixClientPeg.safeGet().getSafeUserId()) ?? null;
    }

    private getInviteMember(): RoomMember | null {
        const { room } = this.props;
        if (!room) {
            return null;
        }
        const myUserId = MatrixClientPeg.safeGet().getSafeUserId();
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
        return memberContent?.membership === KnownMembership.Invite && memberContent.is_direct;
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

    private onChangeReason = (event: ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ reason: event.target.value });
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
                    title = isSpace ? _t("room|joining_space") : _t("room|joining_room");
                } else {
                    title = _t("room|joining");
                }

                showSpinner = true;
                break;
            }
            case MessageCase.Loading: {
                title = _t("common|loading");
                showSpinner = true;
                break;
            }
            case MessageCase.Rejecting: {
                title = _t("room|rejecting");
                showSpinner = true;
                break;
            }
            case MessageCase.NotLoggedIn: {
                const opts: RoomPreviewOpts = { canJoin: false };
                if (this.props.roomId) {
                    ModuleRunner.instance.invoke(RoomViewLifecycle.PreviewRoomNotLoggedIn, opts, this.props.roomId);
                }
                if (opts.canJoin) {
                    title = _t("room|join_title");
                    primaryActionLabel = _t("action|join");
                    primaryActionHandler = () => {
                        ModuleRunner.instance.invoke(RoomViewLifecycle.JoinFromRoomPreview, this.props.roomId);
                    };
                } else {
                    title = _t("room|join_title_account");
                    if (SettingsStore.getValue(UIFeature.Registration)) {
                        primaryActionLabel = _t("room|join_button_account");
                        primaryActionHandler = this.onRegisterClick;
                    }
                    secondaryActionLabel = _t("action|sign_in");
                    secondaryActionHandler = this.onLoginClick;
                }
                if (this.props.previewLoading) {
                    footer = (
                        <div>
                            <Spinner w={20} h={20} />
                            {_t("room|loading_preview")}
                        </div>
                    );
                }
                break;
            }
            case MessageCase.Kicked: {
                const { memberName, reason } = this.getKickOrBanInfo();
                if (roomName) {
                    title = _t("room|kicked_from_room_by", { memberName, roomName });
                } else {
                    title = _t("room|kicked_by", { memberName });
                }
                subTitle = reason ? _t("room|kick_reason", { reason }) : undefined;

                if (isSpace) {
                    primaryActionLabel = _t("room|forget_space");
                } else {
                    primaryActionLabel = _t("room|forget_room");
                }
                primaryActionHandler = this.props.onForgetClick;

                if (this.joinRule() !== JoinRule.Invite) {
                    secondaryActionLabel = primaryActionLabel;
                    secondaryActionHandler = primaryActionHandler;

                    primaryActionLabel = _t("room|rejoin_button");
                    primaryActionHandler = this.props.onJoinClick;
                }
                break;
            }
            case MessageCase.RequestDenied: {
                title = _t("room|knock_denied_title");

                subTitle = _t("room|knock_denied_subtitle");

                if (isSpace) {
                    primaryActionLabel = _t("room|forget_space");
                } else {
                    primaryActionLabel = _t("room|forget_room");
                }
                primaryActionHandler = this.props.onForgetClick;
                break;
            }
            case MessageCase.Banned: {
                const { memberName, reason } = this.getKickOrBanInfo();
                if (roomName) {
                    title = _t("room|banned_from_room_by", { memberName, roomName });
                } else {
                    title = _t("room|banned_by", { memberName });
                }
                subTitle = reason ? _t("room|kick_reason", { reason }) : undefined;
                if (isSpace) {
                    primaryActionLabel = _t("room|forget_space");
                } else {
                    primaryActionLabel = _t("room|forget_room");
                }
                primaryActionHandler = this.props.onForgetClick;
                break;
            }
            case MessageCase.OtherThreePIDError: {
                if (roomName) {
                    title = _t("room|3pid_invite_error_title_room", { roomName });
                } else {
                    title = _t("room|3pid_invite_error_title");
                }
                const joinRule = this.joinRule();
                const errCodeMessage = _t("room|3pid_invite_error_description", {
                    errcode: this.state.threePidFetchError?.errcode || _t("error|unknown_error_code"),
                });
                switch (joinRule) {
                    case "invite":
                        subTitle = [_t("room|3pid_invite_error_invite_subtitle"), errCodeMessage];
                        primaryActionLabel = _t("room|3pid_invite_error_invite_action");
                        primaryActionHandler = this.props.onJoinClick;
                        break;
                    case "public":
                        subTitle = _t("room|3pid_invite_error_public_subtitle");
                        primaryActionLabel = _t("room|join_the_discussion");
                        primaryActionHandler = this.props.onJoinClick;
                        break;
                    default:
                        subTitle = errCodeMessage;
                        primaryActionLabel = _t("room|3pid_invite_error_invite_action");
                        primaryActionHandler = this.props.onJoinClick;
                        break;
                }
                break;
            }
            case MessageCase.InvitedEmailNotFoundInAccount: {
                if (roomName) {
                    title = _t("room|3pid_invite_email_not_found_account_room", {
                        roomName,
                        email: this.props.invitedEmail,
                    });
                } else {
                    title = _t("room|3pid_invite_email_not_found_account", {
                        email: this.props.invitedEmail,
                    });
                }

                subTitle = _t("room|link_email_to_receive_3pid_invite", { brand });
                primaryActionLabel = _t("room|join_the_discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.InvitedEmailNoIdentityServer: {
                if (roomName) {
                    title = _t("room|invite_sent_to_email_room", {
                        roomName,
                        email: this.props.invitedEmail,
                    });
                } else {
                    title = _t("room|invite_sent_to_email", { email: this.props.invitedEmail });
                }

                subTitle = _t("room|3pid_invite_no_is_subtitle", {
                    brand,
                });
                primaryActionLabel = _t("room|join_the_discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.InvitedEmailMismatch: {
                if (roomName) {
                    title = _t("room|invite_sent_to_email_room", {
                        roomName,
                        email: this.props.invitedEmail,
                    });
                } else {
                    title = _t("room|invite_sent_to_email", { email: this.props.invitedEmail });
                }

                subTitle = _t("room|invite_email_mismatch_suggestion", { brand });
                primaryActionLabel = _t("room|join_the_discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.Invite: {
                const isDM = this.isDMInvite();
                const avatar = <RoomAvatar room={this.props.room} oobData={this.props.oobData} />;

                const inviteMember = this.getInviteMember();
                const userName = (
                    <span className="mx_RoomPreviewBar_inviter">
                        {inviteMember?.rawDisplayName ?? this.props.inviterName}
                    </span>
                );
                const inviterElement = (
                    <>
                        {isDM
                            ? _t("room|dm_invite_subtitle", {}, { userName })
                            : _t("room|invite_subtitle", {}, { userName })}
                        {inviteMember && (
                            <>
                                <br />
                                <span className="mx_RoomPreviewBar_inviter_mxid">{inviteMember.userId}</span>
                            </>
                        )}
                    </>
                );

                if (isDM) {
                    title = _t("room|dm_invite_title", {
                        user: inviteMember?.name ?? this.props.inviterName,
                    });
                    primaryActionLabel = _t("room|dm_invite_action");
                } else {
                    title = _t("room|invite_title", { roomName });
                    primaryActionLabel = _t("action|accept");
                }
                subTitle = [avatar, inviterElement];

                const myUserId = MatrixClientPeg.safeGet().getSafeUserId();
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
                secondaryActionLabel = _t("action|reject");
                secondaryActionHandler = this.props.onRejectClick;

                if (this.props.onRejectAndIgnoreClick) {
                    extraComponents.push(
                        <AccessibleButton kind="secondary" onClick={this.props.onRejectAndIgnoreClick} key="ignore">
                            {_t("room|invite_reject_ignore")}
                        </AccessibleButton>,
                    );
                }
                break;
            }
            case MessageCase.ViewingRoom: {
                if (this.props.canPreview) {
                    title = _t("room|peek_join_prompt", { roomName });
                } else if (roomName) {
                    title = _t("room|no_peek_join_prompt", { roomName });
                } else {
                    title = _t("room|no_peek_no_name_join_prompt");
                }
                primaryActionLabel = _t("room|join_the_discussion");
                primaryActionHandler = this.props.onJoinClick;
                break;
            }
            case MessageCase.RoomNotFound: {
                if (roomName) {
                    title = _t("room|not_found_title_name", { roomName });
                } else {
                    title = _t("room|not_found_title");
                }
                subTitle = _t("room|not_found_subtitle");
                break;
            }
            case MessageCase.OtherError: {
                if (roomName) {
                    title = _t("room|inaccessible_name", { roomName });
                } else {
                    title = _t("room|inaccessible");
                }
                subTitle = [
                    _t("room|inaccessible_subtitle_1"),
                    _t(
                        "room|inaccessible_subtitle_2",
                        { errcode: String(this.props.error?.errcode) },
                        {
                            issueLink: (label) => (
                                <a
                                    href={SdkConfig.get().feedback.new_issue_url}
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
            case MessageCase.PromptAskToJoin: {
                if (roomName) {
                    title = _t("room|knock_prompt_name", { roomName });
                } else {
                    title = _t("room|knock_prompt");
                }

                const avatar = <RoomAvatar room={this.props.room} oobData={this.props.oobData} />;
                subTitle = [avatar, _t("room|knock_subtitle")];

                reasonElement = (
                    <Field
                        autoFocus
                        className="mx_RoomPreviewBar_fullWidth"
                        element="textarea"
                        onChange={this.onChangeReason}
                        placeholder={_t("room|knock_message_field_placeholder")}
                        type="text"
                        value={this.state.reason ?? ""}
                    />
                );

                primaryActionHandler = () =>
                    this.props.onSubmitAskToJoin && this.props.onSubmitAskToJoin(this.state.reason);
                primaryActionLabel = _t("room|knock_send_action");

                break;
            }
            case MessageCase.Knocked: {
                title = _t("room|knock_sent");

                subTitle = [
                    <>
                        <AskToJoinIcon className="mx_Icon mx_Icon_16 mx_RoomPreviewBar_icon" />
                        {_t("room|knock_sent_subtitle")}
                    </>,
                ];

                secondaryActionHandler = this.props.onCancelAskToJoin;
                secondaryActionLabel = _t("room|knock_cancel_action");

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

        const classes = classNames("mx_RoomPreviewBar", `mx_RoomPreviewBar_${messageCase}`, {
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
            <div role="complementary" className={classes}>
                <div className="mx_RoomPreviewBar_message">
                    {titleElement}
                    {subTitleElements}
                </div>
                {reasonElement}
                <div
                    className={classNames("mx_RoomPreviewBar_actions", {
                        mx_RoomPreviewBar_fullWidth: messageCase === MessageCase.PromptAskToJoin,
                    })}
                >
                    {actions}
                </div>
                <div className="mx_RoomPreviewBar_footer">{footer}</div>
            </div>
        );
    }
}
