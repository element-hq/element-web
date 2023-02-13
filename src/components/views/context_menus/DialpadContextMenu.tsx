/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { createRef } from "react";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import ContextMenu, { IProps as IContextMenuProps } from "../../structures/ContextMenu";
import Field from "../elements/Field";
import DialPad from "../voip/DialPad";

interface IProps extends IContextMenuProps {
    call: MatrixCall;
}

interface IState {
    value: string;
}

export default class DialpadContextMenu extends React.Component<IProps, IState> {
    private numberEntryFieldRef: React.RefObject<Field> = createRef();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            value: "",
        };
    }

    public onDigitPress = (digit: string, ev: ButtonEvent): void => {
        this.props.call.sendDtmfDigit(digit);
        this.setState({ value: this.state.value + digit });

        // Keep the number field focused so that keyboard entry is still available
        // However, don't focus if this wasn't the result of directly clicking on the button,
        // i.e someone using keyboard navigation.
        if (ev.type === "click") {
            this.numberEntryFieldRef.current?.focus();
        }
    };

    public onCancelClick = (): void => {
        this.props.onFinished();
    };

    public onKeyDown = (ev: React.KeyboardEvent): void => {
        // Prevent Backspace and Delete keys from functioning in the entry field
        if (ev.code === "Backspace" || ev.code === "Delete") {
            ev.preventDefault();
        }
    };

    public onChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ value: ev.target.value });
    };

    public render(): React.ReactNode {
        return (
            <ContextMenu {...this.props}>
                <div className="mx_DialPadContextMenuWrapper">
                    <div>
                        <AccessibleButton className="mx_DialPadContextMenu_cancel" onClick={this.onCancelClick} />
                    </div>
                    <div className="mx_DialPadContextMenu_header">
                        <Field
                            ref={this.numberEntryFieldRef}
                            className="mx_DialPadContextMenu_dialled"
                            value={this.state.value}
                            autoFocus={true}
                            onKeyDown={this.onKeyDown}
                            onChange={this.onChange}
                        />
                    </div>
                    <div className="mx_DialPadContextMenu_dialPad">
                        <DialPad onDigitPress={this.onDigitPress} hasDial={false} />
                    </div>
                </div>
            </ContextMenu>
        );
    }
}
