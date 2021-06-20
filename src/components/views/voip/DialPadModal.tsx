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
import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import Field from "../elements/Field";
import DialPad from './DialPad';
import dis from '../../../dispatcher/dispatcher';
import {replaceableComponent} from "../../../utils/replaceableComponent";
import { DialNumberPayload } from "../../../dispatcher/payloads/DialNumberPayload";
import { Action } from "../../../dispatcher/actions";

interface IProps {
    onFinished: (boolean) => void;
}

interface IState {
    value: string;
}

@replaceableComponent("views.voip.DialPadModal")
export default class DialpadModal extends React.PureComponent<IProps, IState> {
    constructor(props) {
        super(props);
        this.state = {
            value: '',
        }
    }

    onCancelClick = () => {
        this.props.onFinished(false);
    }

    onChange = (ev) => {
        this.setState({value: ev.target.value});
    }

    onFormSubmit = (ev) => {
        ev.preventDefault();
        this.onDialPress();
    }

    onDigitPress = (digit) => {
        this.setState({value: this.state.value + digit});
    }

    onDeletePress = () => {
        if (this.state.value.length === 0) return;
        this.setState({value: this.state.value.slice(0, -1)});
    }

    onDialPress = async () => {
        const payload: DialNumberPayload = {
            action: Action.DialNumber,
            number: this.state.value,
        };
        dis.dispatch(payload);

        this.props.onFinished(true);
    }

    render() {
        return <div className="mx_DialPadModal">
            <div className="mx_DialPadModal_header">
                <div>
                    <span className="mx_DialPadModal_title">{_t("Dial pad")}</span>
                    <AccessibleButton className="mx_DialPadModal_cancel" onClick={this.onCancelClick} />
                </div>
                <form onSubmit={this.onFormSubmit}>
                    <Field className="mx_DialPadModal_field" id="dialpad_number"
                        value={this.state.value} autoFocus={true}
                        onChange={this.onChange}
                    />
                </form>
            </div>
            <div className="mx_DialPadModal_horizSep" />
            <div className="mx_DialPadModal_dialPad">
                <DialPad hasDialAndDelete={true}
                    onDigitPress={this.onDigitPress}
                    onDeletePress={this.onDeletePress}
                    onDialPress={this.onDialPress}
                />
            </div>
        </div>;
    }
}
