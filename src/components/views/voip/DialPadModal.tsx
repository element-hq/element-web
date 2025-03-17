/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, createRef, type SyntheticEvent } from "react";

import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import Field from "../elements/Field";
import DialPad from "./DialPad";
import DialPadBackspaceButton from "../elements/DialPadBackspaceButton";
import LegacyCallHandler from "../../../LegacyCallHandler";

interface IProps {
    onFinished: (dialled: boolean) => void;
}

interface IState {
    value: string;
}

export default class DialpadModal extends React.PureComponent<IProps, IState> {
    private numberEntryFieldRef: React.RefObject<Field> = createRef();

    public constructor(props: IProps) {
        super(props);
        this.state = {
            value: "",
        };
    }

    public onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    public onChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ value: ev.target.value });
    };

    public onFormSubmit = (ev: SyntheticEvent): void => {
        ev.preventDefault();
        this.onDialPress();
    };

    public onDigitPress = (digit: string, ev: ButtonEvent): void => {
        this.setState({ value: this.state.value + digit });

        // Keep the number field focused so that keyboard entry is still available.
        // However, don't focus if this wasn't the result of directly clicking on the button,
        // i.e someone using keyboard navigation.
        if (ev.type === "click") {
            this.numberEntryFieldRef.current?.focus();
        }
    };

    public onDeletePress = (ev: ButtonEvent): void => {
        if (this.state.value.length === 0) return;
        this.setState({ value: this.state.value.slice(0, -1) });

        // Keep the number field focused so that keyboard entry is still available
        // However, don't focus if this wasn't the result of directly clicking on the button,
        // i.e someone using keyboard navigation.
        if (ev.type === "click") {
            this.numberEntryFieldRef.current?.focus();
        }
    };

    public onDialPress = async (): Promise<void> => {
        LegacyCallHandler.instance.dialNumber(this.state.value);
        this.props.onFinished(true);
    };

    public render(): React.ReactNode {
        const backspaceButton = <DialPadBackspaceButton onBackspacePress={this.onDeletePress} />;

        // Only show the backspace button if the field has content
        let dialPadField;
        if (this.state.value.length !== 0) {
            dialPadField = (
                <Field
                    ref={this.numberEntryFieldRef}
                    className="mx_DialPadModal_field"
                    id="dialpad_number"
                    value={this.state.value}
                    autoFocus={true}
                    onChange={this.onChange}
                    postfixComponent={backspaceButton}
                />
            );
        } else {
            dialPadField = (
                <Field
                    ref={this.numberEntryFieldRef}
                    className="mx_DialPadModal_field"
                    id="dialpad_number"
                    value={this.state.value}
                    autoFocus={true}
                    onChange={this.onChange}
                />
            );
        }

        return (
            <div className="mx_DialPadModal">
                <div>
                    <AccessibleButton className="mx_DialPadModal_cancel" onClick={this.onCancelClick} />
                </div>
                <div className="mx_DialPadModal_header">
                    <form onSubmit={this.onFormSubmit}>{dialPadField}</form>
                </div>
                <div className="mx_DialPadModal_dialPad">
                    <DialPad
                        hasDial={true}
                        onDigitPress={this.onDigitPress}
                        onDeletePress={this.onDeletePress}
                        onDialPress={this.onDialPress}
                    />
                </div>
            </div>
        );
    }
}
