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
import { replaceableComponent } from "../../../utils/replaceableComponent";

const BUTTONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const BUTTON_LETTERS = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ', '', '+', ''];

enum DialPadButtonKind {
    Digit,
    Dial,
}

interface IButtonProps {
    kind: DialPadButtonKind;
    digit?: string;
    digitSubtext?: string;
    onButtonPress: (digit: string, ev: ButtonEvent) => void;
}

class DialPadButton extends React.PureComponent<IButtonProps> {
    onClick = (ev: ButtonEvent) => {
        this.props.onButtonPress(this.props.digit, ev);
    };

    render() {
        switch (this.props.kind) {
            case DialPadButtonKind.Digit:
                return <AccessibleButton className="mx_DialPad_button" onClick={this.onClick}>
                    { this.props.digit }
                    <div className="mx_DialPad_buttonSubText">
                        { this.props.digitSubtext }
                    </div>
                </AccessibleButton>;
            case DialPadButtonKind.Dial:
                return <AccessibleButton className="mx_DialPad_button mx_DialPad_dialButton" onClick={this.onClick} />;
        }
    }
}

interface IProps {
    onDigitPress: (digit: string, ev: ButtonEvent) => void;
    hasDial: boolean;
    onDeletePress?: (ev: ButtonEvent) => void;
    onDialPress?: () => void;
}

@replaceableComponent("views.voip.DialPad")
export default class Dialpad extends React.PureComponent<IProps> {
    render() {
        const buttonNodes = [];

        for (let i = 0; i < BUTTONS.length; i++) {
            const button = BUTTONS[i];
            const digitSubtext = BUTTON_LETTERS[i];
            buttonNodes.push(<DialPadButton
                key={button}
                kind={DialPadButtonKind.Digit}
                digit={button}
                digitSubtext={digitSubtext}
                onButtonPress={this.props.onDigitPress}
            />);
        }

        if (this.props.hasDial) {
            buttonNodes.push(<DialPadButton
                key="dial"
                kind={DialPadButtonKind.Dial}
                onButtonPress={this.props.onDialPress}
            />);
        }

        return <div className="mx_DialPad">
            { buttonNodes }
        </div>;
    }
}
