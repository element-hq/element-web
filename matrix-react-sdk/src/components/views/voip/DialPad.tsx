/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as React from "react";

import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import { _t } from "../../../languageHandler";
import { XOR } from "../../../@types/common";

export const BUTTONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
export const BUTTON_LETTERS = ["", "ABC", "DEF", "GHI", "JKL", "MNO", "PQRS", "TUV", "WXYZ", "", "+", ""];

enum DialPadButtonKind {
    Digit,
    Dial,
}

type DigitButtonProps = {
    kind: DialPadButtonKind.Digit;
    digit: string;
    digitSubtext: string;
    onButtonPress: (digit: string, ev: ButtonEvent) => void;
};

type DialButtonProps = {
    kind: DialPadButtonKind.Dial;
    onButtonPress: () => void;
};

class DialPadButton extends React.PureComponent<DigitButtonProps | DialButtonProps> {
    public onClick = (ev: ButtonEvent): void => {
        switch (this.props.kind) {
            case DialPadButtonKind.Digit:
                this.props.onButtonPress(this.props.digit, ev);
                break;
            case DialPadButtonKind.Dial:
                this.props.onButtonPress();
                break;
        }
    };

    public render(): React.ReactNode {
        switch (this.props.kind) {
            case DialPadButtonKind.Digit:
                return (
                    <AccessibleButton className="mx_DialPad_button" onClick={this.onClick}>
                        {this.props.digit}
                        <div className="mx_DialPad_buttonSubText">{this.props.digitSubtext}</div>
                    </AccessibleButton>
                );
            case DialPadButtonKind.Dial:
                return (
                    <AccessibleButton
                        className="mx_DialPad_button mx_DialPad_dialButton"
                        onClick={this.onClick}
                        aria-label={_t("Dial")}
                    />
                );
        }
    }
}

interface IBaseProps {
    onDigitPress: (digit: string, ev: ButtonEvent) => void;
    onDeletePress?: (ev: ButtonEvent) => void;
    hasDial: boolean;
}

interface IProps extends IBaseProps {
    hasDial: false;
}

interface IDialProps extends IBaseProps {
    hasDial: true;
    onDialPress: () => void;
}

export default class DialPad extends React.PureComponent<XOR<IProps, IDialProps>> {
    public render(): React.ReactNode {
        const buttonNodes: JSX.Element[] = [];

        for (let i = 0; i < BUTTONS.length; i++) {
            const button = BUTTONS[i];
            const digitSubtext = BUTTON_LETTERS[i];
            buttonNodes.push(
                <DialPadButton
                    key={button}
                    kind={DialPadButtonKind.Digit}
                    digit={button}
                    digitSubtext={digitSubtext}
                    onButtonPress={this.props.onDigitPress}
                />,
            );
        }

        if (this.props.hasDial) {
            buttonNodes.push(
                <DialPadButton key="dial" kind={DialPadButtonKind.Dial} onButtonPress={this.props.onDialPress} />,
            );
        }

        return <div className="mx_DialPad">{buttonNodes}</div>;
    }
}
