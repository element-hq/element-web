/*
Copyright 2019 New Vector Ltd

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
import classNames from 'classnames';
import sdk from '../../../index';
import { throttle } from 'lodash';

// Invoke validation from user input (when typing, etc.) at most once every N ms.
const VALIDATION_THROTTLE_MS = 200;

export default class Field extends React.PureComponent {
    static propTypes = {
        // The field's ID, which binds the input and label together.
        id: PropTypes.string.isRequired,
        // The element to create. Defaults to "input".
        // To define options for a select, use <Field><option ... /></Field>
        element: PropTypes.oneOf(["input", "select", "textarea"]),
        // The field's type (when used as an <input>). Defaults to "text".
        type: PropTypes.string,
        // The field's label string.
        label: PropTypes.string,
        // The field's placeholder string. Defaults to the label.
        placeholder: PropTypes.string,
        // The field's value.
        // This is a controlled component, so the value is required.
        value: PropTypes.string.isRequired,
        // Optional component to include inside the field before the input.
        prefix: PropTypes.node,
        // The callback called whenever the contents of the field
        // changes.  Returns an object with `valid` boolean field
        // and a `feedback` react component field to provide feedback
        // to the user.
        onValidate: PropTypes.func,
        // All other props pass through to the <input>.
    };

    constructor() {
        super();
        this.state = {
            valid: undefined,
            feedback: undefined,
        };
    }

    onFocus = (ev) => {
        this.validate({
            focused: true,
        });
        // Parent component may have supplied its own `onFocus` as well
        if (this.props.onFocus) {
            this.props.onFocus(ev);
        }
    };

    onChange = (ev) => {
        this.validateOnChange();
        // Parent component may have supplied its own `onChange` as well
        if (this.props.onChange) {
            this.props.onChange(ev);
        }
    };

    onBlur = (ev) => {
        this.validate({
            focused: false,
        });
        // Parent component may have supplied its own `onBlur` as well
        if (this.props.onBlur) {
            this.props.onBlur(ev);
        }
    };

    focus() {
        this.input.focus();
    }

    async validate({ focused, allowEmpty = true }) {
        if (!this.props.onValidate) {
            return;
        }
        const value = this.input ? this.input.value : null;
        const { valid, feedback } = await this.props.onValidate({
            value,
            focused,
            allowEmpty,
        });

        if (feedback) {
            this.setState({
                valid,
                feedback,
                feedbackVisible: true,
            });
        } else {
            // When we receive null `feedback`, we want to hide the tooltip.
            // We leave the previous `feedback` content in state without updating it,
            // so that we can hide the tooltip containing the most recent feedback
            // via CSS animation.
            this.setState({
                valid,
                feedbackVisible: false,
            });
        }
    }

    validateOnChange = throttle(() => {
        this.validate({
            focused: true,
        });
    }, VALIDATION_THROTTLE_MS);

    render() {
        const { element, prefix, onValidate, children, ...inputProps } = this.props;

        const inputElement = element || "input";

        // Set some defaults for the <input> element
        inputProps.type = inputProps.type || "text";
        inputProps.ref = input => this.input = input;
        inputProps.placeholder = inputProps.placeholder || inputProps.label;

        inputProps.onFocus = this.onFocus;
        inputProps.onChange = this.onChange;
        inputProps.onBlur = this.onBlur;

        const fieldInput = React.createElement(inputElement, inputProps, children);

        let prefixContainer = null;
        if (prefix) {
            prefixContainer = <span className="mx_Field_prefix">{prefix}</span>;
        }

        const fieldClasses = classNames("mx_Field", `mx_Field_${inputElement}`, {
            // If we have a prefix element, leave the label always at the top left and
            // don't animate it, as it looks a bit clunky and would add complexity to do
            // properly.
            mx_Field_labelAlwaysTopLeft: prefix,
            mx_Field_valid: onValidate && this.state.valid === true,
            mx_Field_invalid: onValidate && this.state.valid === false,
        });

        // Handle displaying feedback on validity
        const Tooltip = sdk.getComponent("elements.Tooltip");
        let tooltip;
        if (this.state.feedback) {
            tooltip = <Tooltip
                tooltipClassName="mx_Field_tooltip"
                visible={this.state.feedbackVisible}
                label={this.state.feedback}
            />;
        }

        return <div className={fieldClasses}>
            {prefixContainer}
            {fieldInput}
            <label htmlFor={this.props.id}>{this.props.label}</label>
            {tooltip}
        </div>;
    }
}
