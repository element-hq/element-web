/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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
import PropTypes from 'prop-types';
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import { _t } from '../../../languageHandler';

export default React.createClass({
    displayName: 'CreateRoomDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    componentWillMount: function() {
        const config = SdkConfig.get();
        // Dialog shows inverse of m.federate (noFederate) strict false check to skip undefined check (default = true)
        this.defaultNoFederate = config.default_federate === false;
    },

    onOk: function() {
        this.props.onFinished(true, this.refs.textinput.value, this.refs.checkbox.checked);
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return (
            <BaseDialog className="mx_CreateRoomDialog" onFinished={this.props.onFinished}
                title={_t('Create Room')}
            >
                <form onSubmit={this.onOk}>
                    <div className="mx_Dialog_content">
                        <div className="mx_CreateRoomDialog_label">
                            <label htmlFor="textinput"> { _t('Room name (optional)') } </label>
                        </div>
                        <div className="mx_CreateRoomDialog_input_container">
                            <input id="textinput" ref="textinput" className="mx_CreateRoomDialog_input" autoFocus={true} />
                        </div>
                        <br />

                        <details className="mx_CreateRoomDialog_details">
                            <summary className="mx_CreateRoomDialog_details_summary">{ _t('Advanced options') }</summary>
                            <div>
                                <input type="checkbox" id="checkbox" ref="checkbox" defaultChecked={this.defaultNoFederate} />
                                <label htmlFor="checkbox">
                                { _t('Block users on other matrix homeservers from joining this room') }
                                    <br />
                                    ({ _t('This setting cannot be changed later!') })
                                </label>
                            </div>
                        </details>
                    </div>
                </form>
                <DialogButtons primaryButton={_t('Create Room')}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    },
});
