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

import React, { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, RefObject, createRef } from "react";
import classNames from "classnames";
import { debounce } from "lodash";

import { IFieldState, IValidationResult } from "./Validation";
import Tooltip from "./Tooltip";

// Invoke validation from user input (when typing, etc.) at most once every N ms.
const VALIDATION_THROTTLE_MS = 200;

const BASE_ID = "mx_Field";
let count = 1;
function getId(): string {
    return `${BASE_ID}_${count++}`;
}

export interface IValidateOpts {
    focused?: boolean;
    allowEmpty?: boolean;
}

interface IProps {
    // The field's ID, which binds the input and label together. Immutable.
    id?: string;
    // The field's label string.
    label?: string;
    // The field's placeholder string. Defaults to the label.
    placeholder?: string;
    // When true (default false), the placeholder will be shown instead of the label when
    // the component is unfocused & empty.
    usePlaceholderAsHint?: boolean;
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
    forceValidity?: boolean;
    // If specified, contents will appear as a tooltip on the element and
    // validation feedback tooltips will be suppressed.
    tooltipContent?: React.ReactNode;
    // If specified the tooltip will be shown regardless of feedback
    forceTooltipVisible?: boolean;
    // If specified alongside tooltipContent, the class name to apply to the
    // tooltip itself.
    tooltipClassName?: string;
    // If specified, an additional class name to apply to the field container
    className?: string;
    // On what events should validation occur; by default on all
    validateOnFocus?: boolean;
    validateOnBlur?: boolean;
    validateOnChange?: boolean;
    // All other props pass through to the <input>.
}

export interface IInputProps extends IProps, InputHTMLAttributes<HTMLInputElement> {
    // The ref pass through to the input
    inputRef?: RefObject<HTMLInputElement>;
    // The element to create. Defaults to "input".
    element: "input";
    // The input's value. This is a controlled component, so the value is required.
    value: string;
}

interface ISelectProps extends IProps, SelectHTMLAttributes<HTMLSelectElement> {
    // The ref pass through to the select
    inputRef?: RefObject<HTMLSelectElement>;
    // To define options for a select, use <Field><option ... /></Field>
    element: "select";
    // The select's value. This is a controlled component, so the value is required.
    value: string;
}

interface ITextareaProps extends IProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
    // The ref pass through to the textarea
    inputRef?: RefObject<HTMLTextAreaElement>;
    element: "textarea";
    // The textarea's value. This is a controlled component, so the value is required.
    value: string;
}

export interface INativeOnChangeInputProps extends IProps, InputHTMLAttributes<HTMLInputElement> {
    // The ref pass through to the input
    inputRef?: RefObject<HTMLInputElement>;
    element: "input";
    // The input's value. This is a controlled component, so the value is required.
    value: string;
}

type PropShapes = IInputProps | ISelectProps | ITextareaProps | INativeOnChangeInputProps;

interface IState {
    valid?: boolean;
    feedback?: React.ReactNode;
    feedbackVisible: boolean;
    focused: boolean;
}

export default class Field extends React.PureComponent<PropShapes, IState> {
    private readonly id: string;
    private readonly _inputRef = createRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();

    public static readonly defaultProps = {
        element: "input",
        type: "text",
        validateOnFocus: true,
        validateOnBlur: true,
        validateOnChange: true,
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

    public constructor(props: PropShapes) {
        super(props);
        this.state = {
            feedbackVisible: false,
            focused: false,
        };

        this.id = this.props.id || getId();
    }

    public focus(): void {
        this.inputRef.current?.focus();
        // programmatic does not fire onFocus handler
        this.setState({
            focused: true,
        });
    }

    private onFocus = (ev: React.FocusEvent<any>): void => {
        this.setState({
            focused: true,
        });
        if (this.props.validateOnFocus) {
            this.validate({
                focused: true,
            });
        }
        // Parent component may have supplied its own `onFocus` as well
        this.props.onFocus?.(ev);
    };

    private onChange = (ev: React.ChangeEvent<any>): void => {
        if (this.props.validateOnChange) {
            this.validateOnChange();
        }
        // Parent component may have supplied its own `onChange` as well
        this.props.onChange?.(ev);
    };

    private onBlur = (ev: React.FocusEvent<any>): void => {
        this.setState({
            focused: false,
        });
        if (this.props.validateOnBlur) {
            this.validate({
                focused: false,
            });
        }
        // Parent component may have supplied its own `onBlur` as well
        this.props.onBlur?.(ev);
    };

    public async validate({ focused, allowEmpty = true }: IValidateOpts): Promise<boolean | undefined> {
        if (!this.props.onValidate) {
            return;
        }
        const value = this.inputRef.current?.value ?? null;
        const { valid, feedback } = await this.props.onValidate({
            value,
            focused: !!focused,
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

        return valid;
    }

    private get inputRef(): RefObject<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
        return this.props.inputRef ?? this._inputRef;
    }

    public render(): React.ReactNode {
        /* eslint @typescript-eslint/no-unused-vars: ["error", { "ignoreRestSiblings": true }] */
        const {
            element,
            inputRef,
            prefixComponent,
            postfixComponent,
            className,
            onValidate,
            children,
            tooltipContent,
            forceValidity,
            tooltipClassName,
            validateOnBlur,
            validateOnChange,
            validateOnFocus,
            usePlaceholderAsHint,
            forceTooltipVisible,
            ...inputProps
        } = this.props;

        // Handle displaying feedback on validity
        let fieldTooltip: JSX.Element | undefined;
        if (tooltipContent || this.state.feedback) {
            const tooltipId = `${this.id}_tooltip`;
            const visible = (this.state.focused && forceTooltipVisible) || this.state.feedbackVisible;
            if (visible) {
                inputProps["aria-describedby"] = tooltipId;
            }

            let role: React.AriaRole;
            if (tooltipContent) {
                role = "tooltip";
            } else {
                role = this.state.valid ? "status" : "alert";
            }

            fieldTooltip = (
                <Tooltip
                    id={tooltipId}
                    tooltipClassName={classNames("mx_Field_tooltip", "mx_Tooltip_noMargin", tooltipClassName)}
                    visible={visible}
                    label={tooltipContent || this.state.feedback}
                    alignment={Tooltip.Alignment.Right}
                    role={role}
                />
            );
        }

        inputProps.placeholder = inputProps.placeholder ?? inputProps.label;
        inputProps.id = this.id; // this overwrites the id from props

        inputProps.onFocus = this.onFocus;
        inputProps.onChange = this.onChange;
        inputProps.onBlur = this.onBlur;

        // Appease typescript's inference
        const inputProps_: React.HTMLAttributes<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement> &
            React.ClassAttributes<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement> = {
            ...inputProps,
            ref: this.inputRef,
        };

        const fieldInput = React.createElement(this.props.element, inputProps_, children);

        let prefixContainer: JSX.Element | undefined;
        if (prefixComponent) {
            prefixContainer = <span className="mx_Field_prefix">{prefixComponent}</span>;
        }
        let postfixContainer: JSX.Element | undefined;
        if (postfixComponent) {
            postfixContainer = <span className="mx_Field_postfix">{postfixComponent}</span>;
        }

        const hasValidationFlag = forceValidity !== null && forceValidity !== undefined;
        const fieldClasses = classNames("mx_Field", `mx_Field_${this.props.element}`, className, {
            // If we have a prefix element, leave the label always at the top left and
            // don't animate it, as it looks a bit clunky and would add complexity to do
            // properly.
            mx_Field_labelAlwaysTopLeft: prefixComponent || usePlaceholderAsHint,
            mx_Field_placeholderIsHint: usePlaceholderAsHint,
            mx_Field_valid: hasValidationFlag ? forceValidity : onValidate && this.state.valid === true,
            mx_Field_invalid: hasValidationFlag ? !forceValidity : onValidate && this.state.valid === false,
        });

        return (
            <div className={fieldClasses}>
                {prefixContainer}
                {fieldInput}
                <label htmlFor={this.id}>{this.props.label}</label>
                {postfixContainer}
                {fieldTooltip}
            </div>
        );
    }
}
