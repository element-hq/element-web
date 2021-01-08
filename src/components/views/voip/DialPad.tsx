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
import AccessibleButton from "../elements/AccessibleButton";

const BUTTONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

enum DialPadButtonKind {
    Digit,
    Delete,
    Dial,
}

interface IButtonProps {
    kind: DialPadButtonKind;
    digit?: string;
    onButtonPress: (string) => void;
}

class DialPadButton extends React.PureComponent<IButtonProps> {
    onClick = () => {
        this.props.onButtonPress(this.props.digit);
    }

    render() {
        switch (this.props.kind) {
            case DialPadButtonKind.Digit:
                return <AccessibleButton className="mx_DialPad_button" onClick={this.onClick}>
                    {this.props.digit}
                </AccessibleButton>;
            case DialPadButtonKind.Delete:
                return <AccessibleButton className="mx_DialPad_button mx_DialPad_deleteButton"
                    onClick={this.onClick}
                />;
            case DialPadButtonKind.Dial:
                return <AccessibleButton className="mx_DialPad_button mx_DialPad_dialButton" onClick={this.onClick} />;
        }
    }
}

interface IProps {
    onDigitPress: (string) => void;
    onDeletePress: (string) => void;
    onDialPress: (string) => void;
}

export default class Dialpad extends React.PureComponent<IProps> {
    render() {
        const buttonNodes = [];

        for (const button of BUTTONS) {
            buttonNodes.push(<DialPadButton key={button} kind={DialPadButtonKind.Digit}
                digit={button} onButtonPress={this.props.onDigitPress}
            />);
        }

        buttonNodes.push(<DialPadButton key="del" kind={DialPadButtonKind.Delete}
            onButtonPress={this.props.onDeletePress}
        />);
        buttonNodes.push(<DialPadButton key="dial" kind={DialPadButtonKind.Dial}
            onButtonPress={this.props.onDialPress}
        />);

        return <div className="mx_DialPad">
            {buttonNodes}
        </div>;
    }
}
