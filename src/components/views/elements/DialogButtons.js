/*
Copyright 2017 Aidan Gauland

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

"use strict";

import React from "react";
import PropTypes from "prop-types";
import { _t } from '../../../languageHandler';

/**
 * Basic container for buttons in modal dialogs.
 */
module.exports = React.createClass({
    displayName: "DialogButtons",

    propTypes: {
        // The primary button which is styled differently and has default focus.
        primaryButton: PropTypes.node.isRequired,

        // onClick handler for the primary button.
        onPrimaryButtonClick: PropTypes.func.isRequired,

        // onClick handler for the cancel button.
        onCancel: PropTypes.func.isRequired,

        focus: PropTypes.bool,
    },

    render: function() {
        let primaryButtonClassName = "mx_Dialog_primary";
        if (this.props.primaryButtonClass) {
            primaryButtonClassName += " " + this.props.primaryButtonClass;
        }
        return (
            <div className="mx_Dialog_buttons">
                <button className={primaryButtonClassName}
                    onClick={this.props.onPrimaryButtonClick}
                    autoFocus={this.props.focus}
                >
                    { this.props.primaryButton }
                </button>
                { this.props.children }
                <button onClick={this.props.onCancel}>
                    { _t("Cancel") }
                </button>
            </div>
        );
    },
});
