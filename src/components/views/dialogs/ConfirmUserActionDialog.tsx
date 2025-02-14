/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { type RoomMember } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import MemberAvatar from "../avatars/MemberAvatar";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";

interface IProps {
    // matrix-js-sdk (room) member object.
    member: RoomMember;
    action: string; // eg. 'Ban'
    title: string; // eg. 'Ban this user?'

    // Whether to display a text field for a reason
    // If true, the second argument to onFinished will
    // be the string entered.
    askReason?: boolean;
    danger?: boolean;
    children?: ReactNode;
    className?: string;
    roomId?: string;
    onFinished: (success?: boolean, reason?: string) => void;
}

interface IState {
    reason: string;
}

/*
 * A dialog for confirming an operation on another user.
 * Takes a user ID and a verb, displays the target user prominently
 * such that it should be easy to confirm that the operation is being
 * performed on the right person, and displays the operation prominently
 * to make it obvious what is going to happen.
 * Also tweaks the style for 'dangerous' actions (albeit only with colour)
 */
export default class ConfirmUserActionDialog extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        danger: false,
        askReason: false,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            reason: "",
        };
    }

    private onOk = (ev: FormEvent): void => {
        ev.preventDefault();
        this.props.onFinished(true, this.state.reason);
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private onReasonChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            reason: ev.target.value,
        });
    };

    public render(): React.ReactNode {
        const confirmButtonClass = this.props.danger ? "danger" : "";

        let reasonBox;
        if (this.props.askReason) {
            reasonBox = (
                <form onSubmit={this.onOk}>
                    <Field
                        type="text"
                        onChange={this.onReasonChange}
                        value={this.state.reason}
                        className="mx_ConfirmUserActionDialog_reasonField"
                        label={_t("room_settings|permissions|ban_reason")}
                        autoFocus={true}
                    />
                </form>
            );
        }

        const avatar = <MemberAvatar member={this.props.member} size="48px" />;
        const name = this.props.member.name;
        const userId = this.props.member.userId;

        const displayUserIdentifier = UserIdentifierCustomisations.getDisplayUserIdentifier(userId, {
            roomId: this.props.roomId,
            withDisplayName: true,
        });

        return (
            <BaseDialog
                className={classNames("mx_ConfirmUserActionDialog", this.props.className)}
                onFinished={this.props.onFinished}
                title={this.props.title}
                contentId="mx_Dialog_content"
            >
                <div id="mx_Dialog_content" className="mx_Dialog_content">
                    <div className="mx_ConfirmUserActionDialog_user">
                        <div className="mx_ConfirmUserActionDialog_avatar">{avatar}</div>
                        <div className="mx_ConfirmUserActionDialog_name">{name}</div>
                        <div className="mx_ConfirmUserActionDialog_userId">{displayUserIdentifier}</div>
                    </div>

                    {reasonBox}
                    {this.props.children}
                </div>
                <DialogButtons
                    primaryButton={this.props.action}
                    onPrimaryButtonClick={this.onOk}
                    primaryButtonClass={confirmButtonClass}
                    focus={!this.props.askReason}
                    onCancel={this.onCancel}
                />
            </BaseDialog>
        );
    }
}
