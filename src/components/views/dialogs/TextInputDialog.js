/*
Copyright 2015, 2016 OpenMarket Ltd

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

import React, {createRef} from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';

export default createReactClass({
    displayName: 'TextInputDialog',
    propTypes: {
        title: PropTypes.string,
        description: PropTypes.oneOfType([
            PropTypes.element,
            PropTypes.string,
        ]),
        value: PropTypes.string,
        button: PropTypes.string,
        focus: PropTypes.bool,
        onFinished: PropTypes.func.isRequired,
    },

    getDefaultProps: function() {
        return {
            title: "",
            value: "",
            description: "",
            focus: true,
        };
    },

    UNSAFE_componentWillMount: function() {
        this._textinput = createRef();
    },

    componentDidMount: function() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            this._textinput.current.value = this.props.value;
        }
    },

    onOk: function() {
        this.props.onFinished(true, this._textinput.current.value);
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return (
            <BaseDialog className="mx_TextInputDialog" onFinished={this.props.onFinished}
                title={this.props.title}
            >
                <form onSubmit={this.onOk}>
                    <div className="mx_Dialog_content">
                        <div className="mx_TextInputDialog_label">
                            <label htmlFor="textinput"> { this.props.description } </label>
                        </div>
                        <div>
                            <input
                                id="textinput"
                                ref={this._textinput}
                                className="mx_TextInputDialog_input"
                                defaultValue={this.props.value}
                                autoFocus={this.props.focus}
                                size="64" />
                        </div>
                    </div>
                </form>
                <DialogButtons primaryButton={this.props.button}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    },
});
