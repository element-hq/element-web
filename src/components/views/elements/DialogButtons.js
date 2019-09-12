/*
Copyright 2017 Aidan Gauland
Copyright 2018 New Vector Ltd.

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

import React from "react";
import PropTypes from "prop-types";
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';

/**
 * Basic container for buttons in modal dialogs.
 */
module.exports = createReactClass({
    displayName: "DialogButtons",

    propTypes: {
        // The primary button which is styled differently and has default focus.
        primaryButton: PropTypes.node.isRequired,

        // A node to insert into the cancel button instead of default "Cancel"
        cancelButton: PropTypes.node,

        // onClick handler for the primary button.
        onPrimaryButtonClick: PropTypes.func.isRequired,

        // should there be a cancel button? default: true
        hasCancel: PropTypes.bool,

        // onClick handler for the cancel button.
        onCancel: PropTypes.func,

        focus: PropTypes.bool,

        // disables the primary and cancel buttons
        disabled: PropTypes.bool,

        // disables only the primary button
        primaryDisabled: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            hasCancel: true,
            disabled: false,
        };
    },

    _onCancelClick: function() {
        this.props.onCancel();
    },

    render: function() {
        let primaryButtonClassName = "mx_Dialog_primary";
        if (this.props.primaryButtonClass) {
            primaryButtonClassName += " " + this.props.primaryButtonClass;
        }
        let cancelButton;
        if (this.props.cancelButton || this.props.hasCancel) {
            cancelButton = <button onClick={this._onCancelClick} disabled={this.props.disabled}>
                { this.props.cancelButton || _t("Cancel") }
            </button>;
        }
        return (
            <div className="mx_Dialog_buttons">
                { cancelButton }
                { this.props.children }
                <button className={primaryButtonClassName}
                    onClick={this.props.onPrimaryButtonClick}
                    autoFocus={this.props.focus}
                    disabled={this.props.disabled || this.props.primaryDisabled}
                >
                    { this.props.primaryButton }
                </button>
            </div>
        );
    },
});
