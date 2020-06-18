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

import React, {InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes} from 'react';
import classNames from 'classnames';
import * as sdk from '../../../index';
import { debounce } from 'lodash';
import {IFieldState, IValidationResult} from "./Validation";

// Invoke validation from user input (when typing, etc.) at most once every N ms.
const VALIDATION_THROTTLE_MS = 200;

const BASE_ID = "mx_Field";
let count = 1;
function getId() {
    return `${BASE_ID}_${count++}`;
}

interface IProps {
    // The field's ID, which binds the input and label together. Immutable.
    id?: string;
    // The field's type (when used as an <input>). Defaults to "text".
    type?: string;
    // id of a <datalist> element for suggestions
    list?: string;
    // The field's label string.
    label?: string;
    // The field's placeholder string. Defaults to the label.
    placeholder?: string;
    // Optional component to include inside the field before the input.
    prefixComponent?: React.ReactNode;
    // Optional component to include inside the field after the input.
    postfixComponent?: React.ReactNode;
    // The callback called whenever the contents of the field
    // changes.  Returns an object with `valid` boolean field
    // and a `feedback` react component field to provide feedback
    // to the user.
    onValidate?: (input: IFieldState) => Promise<IValidationResult>;
    // If specified, overrides the value returned by onValidate.
    flagInvalid?: boolean;
    // If specified, contents will appear as a tooltip on the element and
    // validation feedback tooltips will be suppressed.
    tooltipContent?: React.ReactNode;
    // If specified alongside tooltipContent, the class name to apply to the
    // tooltip itself.
    tooltipClassName?: string;
    // If specified, an additional class name to apply to the field container
    className?: string;
    // All other props pass through to the <input>.
}

interface IInputProps extends IProps, InputHTMLAttributes<HTMLInputElement> {
    // The element to create. Defaults to "input".
    element?: "input";
    // The input's value. This is a controlled component, so the value is required.
    value: string;
}

interface ISelectProps extends IProps, SelectHTMLAttributes<HTMLSelectElement> {
    // To define options for a select, use <Field><option ... /></Field>
    element: "select";
    // The select's value. This is a controlled component, so the value is required.
    value: string;
}

interface ITextareaProps extends IProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
    element: "textarea";
    // The textarea's value. This is a controlled component, so the value is required.
    value: string;
}

type PropShapes = IInputProps | ISelectProps | ITextareaProps;

interface IState {
    valid: boolean;
    feedback: React.ReactNode;
    feedbackVisible: boolean;
    focused: boolean;
}

export default class Field extends React.PureComponent<PropShapes, IState> {
    private id: string;
    private input: HTMLInputElement;

    public static readonly defaultProps = {
        element: "input",
        type: "text",
    };

    /*
     * This was changed from throttle to debounce: this is more traditional for
     * form validation since it means that the validation doesn't happen at all
     * until the user stops typing for a bit (debounce defaults to not running on
     * the leading edge). If we're doing an HTTP hit on each validation, we have more
     * incentive to prevent validating input that's very unlikely to be valid.
     * We may find that we actually want different behaviour for registration
     * fields, in which case we can add some options to control it.
     */
    private validateOnChange = debounce(() => {
        this.validate({
            focused: true,
        });
    }, VALIDATION_THROTTLE_MS);

    constructor(props) {
        super(props);
        this.state = {
            valid: undefined,
            feedback: undefined,
            feedbackVisible: false,
            focused: false,
        };

        this.id = this.props.id || getId();
    }

    public focus() {
        this.input.focus();
    }

    private onFocus = (ev) => {
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

    private onChange = (ev) => {
        this.validateOnChange();
        // Parent component may have supplied its own `onChange` as well
        if (this.props.onChange) {
            this.props.onChange(ev);
        }
    };

    private onBlur = (ev) => {
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

    private async validate({ focused, allowEmpty = true }: {focused: boolean, allowEmpty?: boolean}) {
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



    public render() {
        const {
            element, prefixComponent, postfixComponent, className, onValidate, children,
            tooltipContent, flagInvalid, tooltipClassName, list, ...inputProps} = this.props;

        // Set some defaults for the <input> element
        const ref = input => this.input = input;
        inputProps.placeholder = inputProps.placeholder || inputProps.label;
        inputProps.id = this.id; // this overwrites the id from props

        inputProps.onFocus = this.onFocus;
        inputProps.onChange = this.onChange;
        inputProps.onBlur = this.onBlur;

        // Appease typescript's inference
        const inputProps_ = {...inputProps, ref, list};

        const fieldInput = React.createElement(this.props.element, inputProps_, children);

        let prefixContainer = null;
        if (prefixComponent) {
            prefixContainer = <span className="mx_Field_prefix">{prefixComponent}</span>;
        }
        let postfixContainer = null;
        if (postfixComponent) {
            postfixContainer = <span className="mx_Field_postfix">{postfixComponent}</span>;
        }

        const hasValidationFlag = flagInvalid !== null && flagInvalid !== undefined;
        const fieldClasses = classNames("mx_Field", `mx_Field_${this.props.element}`, className, {
            // If we have a prefix element, leave the label always at the top left and
            // don't animate it, as it looks a bit clunky and would add complexity to do
            // properly.
            mx_Field_labelAlwaysTopLeft: prefixComponent,
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
            <label htmlFor={this.id}>{this.props.label}</label>
            {postfixContainer}
            {fieldTooltip}
        </div>;
    }
}
