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
import sdk from '../../../index';
import classnames from 'classnames';

/*
 * A dialog for confirming an operation on another user.
 * Takes a user ID and a verb, displays the target user prominently
 * such that it should be easy to confirm that the operation is being
 * performed on the right person, and displays the operation prominently
 * to make it obvious what is going to happen.
 * Also tweaks the style for 'dangerous' actions (albeit only with colour)
 */
export default React.createClass({
    displayName: 'ConfirmUserActionDialog',
    propTypes: {
        member: React.PropTypes.object.isRequired, // matrix-js-sdk member object
        action: React.PropTypes.string.isRequired, // eg. 'Ban'

        // Whether to display a text field for a reason
        // If true, the second argument to onFinished will
        // be the string entered.
        askReason: React.PropTypes.bool,
        danger: React.PropTypes.bool,
        onFinished: React.PropTypes.func.isRequired,
    },

    defaultProps: {
        danger: false,
        askReason: false,
    },

    componentWillMount: function() {
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
        const MemberAvatar = sdk.getComponent("views.avatars.MemberAvatar");

        const title = this.props.action + " this person?";
        const confirmButtonClass = classnames({
            'mx_Dialog_primary': true,
            'danger': this.props.danger,
        });

        let reasonBox;
        if (this.props.askReason) {
            reasonBox = (
                <div>
                    <form onSubmit={this.onOk}>
                        <input className="mx_ConfirmUserActionDialog_reasonField"
                            ref={this._collectReasonField}
                            placeholder="Reason"
                            autoFocus={true}
                        />
                    </form>
                </div>
            );
        }

        return (
            <BaseDialog className="mx_ConfirmUserActionDialog" onFinished={this.props.onFinished}
                onEnterPressed={ this.onOk }
                title={title}
            >
                <div className="mx_Dialog_content">
                    <div className="mx_ConfirmUserActionDialog_avatar">
                        <MemberAvatar member={this.props.member} width={48} height={48} />
                    </div>
                    <div className="mx_ConfirmUserActionDialog_name">{this.props.member.name}</div>
                    <div className="mx_ConfirmUserActionDialog_userId">{this.props.member.userId}</div>
                </div>
                {reasonBox}
                <div className="mx_Dialog_buttons">
                    <button className={confirmButtonClass}
                        onClick={this.onOk} autoFocus={!this.props.askReason}
                    >
                        {this.props.action}
                    </button>

                    <button onClick={this.onCancel}>
                        Cancel
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
