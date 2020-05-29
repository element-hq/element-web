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

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import { MatrixClient } from 'matrix-js-sdk';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import { GroupMemberType } from '../../../groups';

/*
 * A dialog for confirming an operation on another user.
 * Takes a user ID and a verb, displays the target user prominently
 * such that it should be easy to confirm that the operation is being
 * performed on the right person, and displays the operation prominently
 * to make it obvious what is going to happen.
 * Also tweaks the style for 'dangerous' actions (albeit only with colour)
 */
export default createReactClass({
    displayName: 'ConfirmUserActionDialog',
    propTypes: {
        // matrix-js-sdk (room) member object. Supply either this or 'groupMember'
        member: PropTypes.object,
        // group member object. Supply either this or 'member'
        groupMember: GroupMemberType,
        // needed if a group member is specified
        matrixClient: PropTypes.instanceOf(MatrixClient),
        action: PropTypes.string.isRequired, // eg. 'Ban'
        title: PropTypes.string.isRequired, // eg. 'Ban this user?'

        // Whether to display a text field for a reason
        // If true, the second argument to onFinished will
        // be the string entered.
        askReason: PropTypes.bool,
        danger: PropTypes.bool,
        onFinished: PropTypes.func.isRequired,
    },

    getDefaultProps: () => ({
        danger: false,
        askReason: false,
    }),

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount: function() {
        this._reasonField = null;
    },

    onOk: function() {
        let reason;
        if (this._reasonField) {
            reason = this._reasonField.value;
        }
        this.props.onFinished(true, reason);
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    _collectReasonField: function(e) {
        this._reasonField = e;
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const MemberAvatar = sdk.getComponent("views.avatars.MemberAvatar");
        const BaseAvatar = sdk.getComponent("views.avatars.BaseAvatar");

        const confirmButtonClass = this.props.danger ? 'danger' : '';

        let reasonBox;
        if (this.props.askReason) {
            reasonBox = (
                <div>
                    <form onSubmit={this.onOk}>
                        <input className="mx_ConfirmUserActionDialog_reasonField"
                            ref={this._collectReasonField}
                            placeholder={_t("Reason")}
                            autoFocus={true}
                        />
                    </form>
                </div>
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
            const httpAvatarUrl = this.props.groupMember.avatarUrl ?
                this.props.matrixClient.mxcUrlToHttp(this.props.groupMember.avatarUrl, 48, 48) : null;
            name = this.props.groupMember.displayname || this.props.groupMember.userId;
            userId = this.props.groupMember.userId;
            avatar = <BaseAvatar name={name} url={httpAvatarUrl} width={48} height={48} />;
        }

        return (
            <BaseDialog className="mx_ConfirmUserActionDialog" onFinished={this.props.onFinished}
                title={this.props.title}
                contentId='mx_Dialog_content'
            >
                <div id="mx_Dialog_content" className="mx_Dialog_content">
                    <div className="mx_ConfirmUserActionDialog_avatar">
                        { avatar }
                    </div>
                    <div className="mx_ConfirmUserActionDialog_name">{ name }</div>
                    <div className="mx_ConfirmUserActionDialog_userId">{ userId }</div>
                </div>
                { reasonBox }
                <DialogButtons primaryButton={this.props.action}
                    onPrimaryButtonClick={this.onOk}
                    primaryButtonClass={confirmButtonClass}
                    focus={!this.props.askReason}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    },
});
