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
 * A dialog for confirming a redaction.
 */
export default React.createClass({
    displayName: 'ConfirmRedactDialog',
    propTypes: {
        onFinished: React.PropTypes.func.isRequired,
    },

    defaultProps: {
        danger: false,
    },

    onOk: function() {
        this.props.onFinished(true);
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        const title = "Confirm Redaction";

        const confirmButtonClass = classnames({
            'mx_Dialog_primary': true,
            'danger': false,
        });

        return (
            <BaseDialog className="mx_ConfirmUserActionDialog" onFinished={this.props.onFinished}
                onEnterPressed={ this.onOk }
                title={title}
            >
                <div className="mx_Dialog_content">
                    Are you sure you wish to redact (delete) this event?
                    Note that if you redact a room name or topic change, it could undo the change.
                </div>
                <div className="mx_Dialog_buttons">
                    <button className={confirmButtonClass} onClick={this.onOk}>
                        Redact
                    </button>

                    <button onClick={this.onCancel}>
                        Cancel
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
