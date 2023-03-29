/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd

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

import React, { createRef } from "react";

import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";

enum Phases {
    Display = "display",
    Edit = "edit",
}

interface IProps {
    onValueChanged?: (value: string, shouldSubmit: boolean) => void;
    initialValue: string;
    label: string;
    placeholder: string;
    className: string;
    labelClassName?: string;
    placeholderClassName: string;
    // Overrides blurToSubmit if true
    blurToCancel?: boolean;
    // Will cause onValueChanged(value, true) to fire on blur
    blurToSubmit: boolean;
    editable: boolean;
}

interface IState {
    phase: Phases;
}

export default class EditableText extends React.Component<IProps, IState> {
    // we track value as an JS object field rather than in React state
    // as React doesn't play nice with contentEditable.
    public value = "";
    private placeholder = false;
    private editableDiv = createRef<HTMLDivElement>();

    public static defaultProps: Partial<IProps> = {
        onValueChanged() {},
        initialValue: "",
        label: "",
        placeholder: "",
        editable: true,
        className: "mx_EditableText",
        placeholderClassName: "mx_EditableText_placeholder",
        blurToSubmit: false,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            phase: Phases.Display,
        };
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (prevProps.initialValue !== this.props.initialValue) {
            this.value = this.props.initialValue;
            if (this.editableDiv.current) {
                this.showPlaceholder(!this.value);
            }
        }
    }

    public componentDidMount(): void {
        this.value = this.props.initialValue;
        if (this.editableDiv.current) {
            this.showPlaceholder(!this.value);
        }
    }

    private showPlaceholder = (show: boolean): void => {
        if (!this.editableDiv.current) return;
        if (show) {
            this.editableDiv.current.textContent = this.props.placeholder;
            this.editableDiv.current.setAttribute(
                "class",
                this.props.className + " " + this.props.placeholderClassName,
            );
            this.placeholder = true;
            this.value = "";
        } else {
            this.editableDiv.current.textContent = this.value;
            this.editableDiv.current.setAttribute("class", this.props.className);
            this.placeholder = false;
        }
    };

    private cancelEdit = (): void => {
        this.setState({
            phase: Phases.Display,
        });
        this.value = this.props.initialValue;
        this.showPlaceholder(!this.value);
        this.onValueChanged(false);
        this.editableDiv.current?.blur();
    };

    private onValueChanged = (shouldSubmit: boolean): void => {
        this.props.onValueChanged?.(this.value, shouldSubmit);
    };

    private onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (this.placeholder) {
            this.showPlaceholder(false);
        }

        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Enter:
                ev.stopPropagation();
                ev.preventDefault();
                break;
        }
    };

    private onKeyUp = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (!(ev.target as HTMLDivElement).textContent) {
            this.showPlaceholder(true);
        } else if (!this.placeholder) {
            this.value = (ev.target as HTMLDivElement).textContent ?? "";
        }

        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Escape:
                this.cancelEdit();
                break;
            case KeyBindingAction.Enter:
                this.onFinish(ev);
                break;
        }
    };

    private onClickDiv = (): void => {
        if (!this.props.editable) return;

        this.setState({
            phase: Phases.Edit,
        });
    };

    private onFocus = (ev: React.FocusEvent<HTMLDivElement>): void => {
        const node = ev.target.childNodes[0];
        if (node) {
            const range = document.createRange();
            range.setStart(node, 0);
            range.setEnd(node, ev.target.childNodes.length);

            const sel = window.getSelection()!;
            sel.removeAllRanges();
            sel.addRange(range);
        }
    };

    private onFinish = (
        ev: React.KeyboardEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>,
        shouldSubmit = false,
    ): void => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const action = getKeyBindingsManager().getAccessibilityAction(ev as React.KeyboardEvent);
        const submit = action === KeyBindingAction.Enter || shouldSubmit;
        this.setState(
            {
                phase: Phases.Display,
            },
            () => {
                if (this.value !== this.props.initialValue) {
                    self.onValueChanged(submit);
                }
            },
        );
    };

    private onBlur = (ev: React.FocusEvent<HTMLDivElement>): void => {
        const sel = window.getSelection()!;
        sel.removeAllRanges();

        if (this.props.blurToCancel) {
            this.cancelEdit();
        } else {
            this.onFinish(ev, this.props.blurToSubmit);
        }

        this.showPlaceholder(!this.value);
    };

    public render(): React.ReactNode {
        const { className, editable, initialValue, label, labelClassName } = this.props;
        let editableEl;

        if (!editable || (this.state.phase === Phases.Display && (label || labelClassName) && !this.value)) {
            // show the label
            editableEl = (
                <div className={className + " " + labelClassName} onClick={this.onClickDiv}>
                    {label || initialValue}
                </div>
            );
        } else {
            // show the content editable div, but manually manage its contents as react and contentEditable don't play nice together
            editableEl = (
                <div
                    ref={this.editableDiv}
                    contentEditable={true}
                    className={className}
                    onKeyDown={this.onKeyDown}
                    onKeyUp={this.onKeyUp}
                    onFocus={this.onFocus}
                    onBlur={this.onBlur}
                />
            );
        }

        return editableEl;
    }
}
