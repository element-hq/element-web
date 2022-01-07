/*
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

import React, { ChangeEvent, FormEvent, ReactNode } from 'react';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import classNames from "classnames";

import { _t } from '../../../languageHandler';
import { GroupMemberType } from '../../../groups';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { mediaFromMxc } from "../../../customisations/Media";
import MemberAvatar from '../avatars/MemberAvatar';
import BaseAvatar from '../avatars/BaseAvatar';
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from '../elements/Field';

interface IProps {
    // matrix-js-sdk (room) member object. Supply either this or 'groupMember'
    member?: RoomMember;
    // group member object. Supply either this or 'member'
    groupMember?: GroupMemberType;
    // needed if a group member is specified
    matrixClient?: MatrixClient;
    action: string; // eg. 'Ban'
    title: string; // eg. 'Ban this user?'

    // Whether to display a text field for a reason
    // If true, the second argument to onFinished will
    // be the string entered.
    askReason?: boolean;
    danger?: boolean;
    children?: ReactNode;
    className?: string;
    onFinished: (success: boolean, reason?: string) => void;
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
@replaceableComponent("views.dialogs.ConfirmUserActionDialog")
export default class ConfirmUserActionDialog extends React.Component<IProps, IState> {
    static defaultProps = {
        danger: false,
        askReason: false,
    };

    constructor(props: IProps) {
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

    private onReasonChange = (ev: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            reason: ev.target.value,
        });
    };

    public render() {
        const confirmButtonClass = this.props.danger ? 'danger' : '';

        let reasonBox;
        if (this.props.askReason) {
            reasonBox = (
                <form onSubmit={this.onOk}>
                    <Field
                        type="text"
                        onChange={this.onReasonChange}
                        value={this.state.reason}
                        className="mx_ConfirmUserActionDialog_reasonField"
                        label={_t("Reason")}
                        autoFocus={true}
                    />
                </form>
            );
        }

        let avatar;
        let name;
        let userId;
        if (this.props.member) {
            avatar = <MemberAvatar member={this.props.member} width={48} height={48} />;
            name = this.props.member.name;
            userId = this.props.member.userId;
        } else {
            const httpAvatarUrl = this.props.groupMember.avatarUrl
                ? mediaFromMxc(this.props.groupMember.avatarUrl).getSquareThumbnailHttp(48)
                : null;
            name = this.props.groupMember.displayname || this.props.groupMember.userId;
            userId = this.props.groupMember.userId;
            avatar = <BaseAvatar name={name} url={httpAvatarUrl} width={48} height={48} />;
        }

        return (
            <BaseDialog
                className={classNames("mx_ConfirmUserActionDialog", this.props.className)}
                onFinished={this.props.onFinished}
                title={this.props.title}
                contentId='mx_Dialog_content'
            >
                <div id="mx_Dialog_content" className="mx_Dialog_content">
                    <div className="mx_ConfirmUserActionDialog_user">
                        <div className="mx_ConfirmUserActionDialog_avatar">
                            { avatar }
                        </div>
                        <div className="mx_ConfirmUserActionDialog_name">{ name }</div>
                        <div className="mx_ConfirmUserActionDialog_userId">{ userId }</div>
                    </div>

                    { reasonBox }
                    { this.props.children }
                </div>
                <DialogButtons
                    primaryButton={this.props.action}
                    onPrimaryButtonClick={this.onOk}
                    primaryButtonClass={confirmButtonClass}
                    focus={!this.props.askReason}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    }
}
