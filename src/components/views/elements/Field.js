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
import * as sdk from '../../../index';
import { debounce } from 'lodash';

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
        // Optional component to include inside the field after the input.
        postfix: PropTypes.node,
        // The callback called whenever the contents of the field
        // changes.  Returns an object with `valid` boolean field
        // and a `feedback` react component field to provide feedback
        // to the user.
        onValidate: PropTypes.func,
        // If specified, overrides the value returned by onValidate.
        flagInvalid: PropTypes.bool,
        // If specified, contents will appear as a tooltip on the element and
        // validation feedback tooltips will be suppressed.
        tooltipContent: PropTypes.node,
        // If specified alongside tooltipContent, the class name to apply to the
        // tooltip itself.
        tooltipClassName: PropTypes.string,
        // If specified, an additional class name to apply to the field container
        className: PropTypes.string,
        // All other props pass through to the <input>.
    };

    constructor() {
        super();
        this.state = {
            valid: undefined,
            feedback: undefined,
            focused: false,
        };
    }

    onFocus = (ev) => {
        this.setState({
            focused: true,
        });
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
        this.setState({
            focused: false,
        });
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

        // this method is async and so we may have been blurred since the method was called
        // if we have then hide the feedback as withValidation does
        if (this.state.focused && feedback) {
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

    /*
     * This was changed from throttle to debounce: this is more traditional for
     * form validation since it means that the validation doesn't happen at all
     * until the user stops typing for a bit (debounce defaults to not running on
     * the leading edge). If we're doing an HTTP hit on each validation, we have more
     * incentive to prevent validating input that's very unlikely to be valid.
     * We may find that we actually want different behaviour for registration
     * fields, in which case we can add some options to control it.
     */
    validateOnChange = debounce(() => {
        this.validate({
            focused: true,
        });
    }, VALIDATION_THROTTLE_MS);

    render() {
        const {
            element, prefix, postfix, className, onValidate, children,
            tooltipContent, flagInvalid, tooltipClassName, ...inputProps} = this.props;

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
        let postfixContainer = null;
        if (postfix) {
            postfixContainer = <span className="mx_Field_postfix">{postfix}</span>;
        }

        const hasValidationFlag = flagInvalid !== null && flagInvalid !== undefined;
        const fieldClasses = classNames("mx_Field", `mx_Field_${inputElement}`, className, {
            // If we have a prefix element, leave the label always at the top left and
            // don't animate it, as it looks a bit clunky and would add complexity to do
            // properly.
            mx_Field_labelAlwaysTopLeft: prefix,
            mx_Field_valid: onValidate && this.state.valid === true,
            mx_Field_invalid: hasValidationFlag
                ? flagInvalid
                : onValidate && this.state.valid === false,
        });

        // Handle displaying feedback on validity
        const Tooltip = sdk.getComponent("elements.Tooltip");
        let fieldTooltip;
        if (tooltipContent || this.state.feedback) {
            const addlClassName = tooltipClassName ? tooltipClassName : '';
            fieldTooltip = <Tooltip
                tooltipClassName={`mx_Field_tooltip ${addlClassName}`}
                visible={this.state.feedbackVisible}
                label={tooltipContent || this.state.feedback}
            />;
        }

        return <div className={fieldClasses}>
            {prefixContainer}
            {fieldInput}
            <label htmlFor={this.props.id}>{this.props.label}</label>
            {postfixContainer}
            {fieldTooltip}
        </div>;
    }
}
