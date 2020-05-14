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
import Field from "../elements/Field";

export default createReactClass({
    displayName: 'TextInputDialog',
    propTypes: {
        title: PropTypes.string,
        description: PropTypes.oneOfType([
            PropTypes.element,
            PropTypes.string,
        ]),
        value: PropTypes.string,
        placeholder: PropTypes.string,
        button: PropTypes.string,
        focus: PropTypes.bool,
        onFinished: PropTypes.func.isRequired,
        hasCancel: PropTypes.bool,
        validator: PropTypes.func, // result of withValidation
        fixedWidth: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            title: "",
            value: "",
            description: "",
            focus: true,
            hasCancel: true,
        };
    },

    getInitialState: function() {
        return {
            value: this.props.value,
            valid: false,
        };
    },

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount: function() {
        this._field = createRef();
    },

    componentDidMount: function() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            // this._field.current.value = this.props.value;
            this._field.current.focus();
        }
    },

    onOk: async function(ev) {
        ev.preventDefault();
        if (this.props.validator) {
            await this._field.current.validate({ allowEmpty: false });

            if (!this._field.current.state.valid) {
                this._field.current.focus();
                this._field.current.validate({ allowEmpty: false, focused: true });
                return;
            }
        }
        this.props.onFinished(true, this.state.value);
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    onChange: function(ev) {
        this.setState({
            value: ev.target.value,
        });
    },

    onValidate: async function(fieldState) {
        const result = await this.props.validator(fieldState);
        this.setState({
            valid: result.valid,
        });
        return result;
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return (
            <BaseDialog
                className="mx_TextInputDialog"
                onFinished={this.props.onFinished}
                title={this.props.title}
                fixedWidth={this.props.fixedWidth}
            >
                <form onSubmit={this.onOk}>
                    <div className="mx_Dialog_content">
                        <div className="mx_TextInputDialog_label">
                            <label htmlFor="textinput"> { this.props.description } </label>
                        </div>
                        <div>
                            <Field
                                className="mx_TextInputDialog_input"
                                ref={this._field}
                                type="text"
                                label={this.props.placeholder}
                                value={this.state.value}
                                onChange={this.onChange}
                                onValidate={this.props.validator ? this.onValidate : undefined}
                                size="64"
                            />
                        </div>
                    </div>
                </form>
                <DialogButtons
                    primaryButton={this.props.button}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel}
                    hasCancel={this.props.hasCancel}
                />
            </BaseDialog>
        );
    },
});
