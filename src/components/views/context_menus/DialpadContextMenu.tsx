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

import React from 'react';
import { _t } from '../../../languageHandler';
import { ContextMenu, IProps as IContextMenuProps } from '../../structures/ContextMenu';
import { MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import Dialpad from '../voip/DialPad';
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface IProps extends IContextMenuProps {
    call: MatrixCall;
}

interface IState {
    value: string;
}

@replaceableComponent("views.context_menus.DialpadContextMenu")
export default class DialpadContextMenu extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
            value: '',
        }
    }

    onDigitPress = (digit) => {
        this.props.call.sendDtmfDigit(digit);
        this.setState({value: this.state.value + digit});
    }

    render() {
        return <ContextMenu {...this.props}>
            <div className="mx_DialPadContextMenu_header">
                <div>
                    <span className="mx_DialPadContextMenu_title">{_t("Dial pad")}</span>
                </div>
                <div className="mx_DialPadContextMenu_dialled">{this.state.value}</div>
            </div>
            <div className="mx_DialPadContextMenu_horizSep" />
            <div className="mx_DialPadContextMenu_dialPad">
                <Dialpad onDigitPress={this.onDigitPress} hasDialAndDelete={false} />
            </div>
        </ContextMenu>;
    }
}
