/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, createRef } from "react";

import Field from "../elements/Field";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import { type IFieldState, type IValidationResult } from "../elements/Validation";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    title: string;
    description: React.ReactNode;
    value: string;
    placeholder?: string;
    button?: string;
    busyMessage: TranslationKey;
    focus: boolean;
    hasCancel: boolean;
    validator?: (fieldState: IFieldState) => Promise<IValidationResult>; // result of withValidation
    fixedWidth?: boolean;
    onFinished(ok?: false, text?: void): void;
    onFinished(ok: true, text: string): void;
}

interface IState {
    value: string;
    busy: boolean;
    valid: boolean;
}

export default class TextInputDialog extends React.Component<IProps, IState> {
    private field = createRef<Field>();

    public static defaultProps: Partial<IProps> = {
        title: "",
        value: "",
        description: "",
        busyMessage: _td("common|loading"),
        focus: true,
        hasCancel: true,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            value: this.props.value,
            busy: false,
            valid: false,
        };
    }

    public componentDidMount(): void {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            // this._field.current.value = this.props.value;
            this.field.current?.focus();
        }
    }

    private onOk = async (ev: React.FormEvent): Promise<void> => {
        ev.preventDefault();
        if (!this.field.current) return;
        if (this.props.validator) {
            this.setState({ busy: true });
            await this.field.current.validate({ allowEmpty: false });

            if (!this.field.current.state.valid) {
                this.field.current.focus();
                this.field.current.validate({ allowEmpty: false, focused: true });
                this.setState({ busy: false });
                return;
            }
        }
        this.props.onFinished(true, this.state.value);
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private onChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            value: ev.target.value,
        });
    };

    private onValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await this.props.validator!(fieldState);
        this.setState({
            valid: !!result.valid,
        });
        return result;
    };

    public render(): React.ReactNode {
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
                            <label htmlFor="textinput"> {this.props.description} </label>
                        </div>
                        <div>
                            <Field
                                className="mx_TextInputDialog_input"
                                ref={this.field}
                                type="text"
                                label={this.props.placeholder}
                                value={this.state.value}
                                onChange={this.onChange}
                                onValidate={this.props.validator ? this.onValidate : undefined}
                            />
                        </div>
                    </div>
                </form>
                <DialogButtons
                    primaryButton={this.state.busy ? _t(this.props.busyMessage) : this.props.button}
                    disabled={this.state.busy}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel}
                    hasCancel={this.props.hasCancel}
                />
            </BaseDialog>
        );
    }
}
