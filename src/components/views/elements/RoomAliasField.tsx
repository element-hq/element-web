/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { createRef, KeyboardEventHandler } from "react";

import { _t } from '../../../languageHandler';
import withValidation from './Validation';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import Field, { IValidateOpts } from "./Field";

interface IProps {
    domain: string;
    value: string;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    onKeyDown?: KeyboardEventHandler;
    onChange?(value: string): void;
}

interface IState {
    isValid: boolean;
}

// Controlled form component wrapping Field for inputting a room alias scoped to a given domain
@replaceableComponent("views.elements.RoomAliasField")
export default class RoomAliasField extends React.PureComponent<IProps, IState> {
    private fieldRef = createRef<Field>();

    constructor(props, context) {
        super(props, context);

        this.state = {
            isValid: true,
        };
    }

    private asFullAlias(localpart: string): string {
        return `#${localpart}:${this.props.domain}`;
    }

    render() {
        const poundSign = (<span>#</span>);
        const aliasPostfix = ":" + this.props.domain;
        const domain = (<span title={aliasPostfix}>{ aliasPostfix }</span>);
        const maxlength = 255 - this.props.domain.length - 2;   // 2 for # and :
        return (
            <Field
                label={this.props.label || _t("Room address")}
                className="mx_RoomAliasField"
                prefixComponent={poundSign}
                postfixComponent={domain}
                ref={this.fieldRef}
                onValidate={this.onValidate}
                placeholder={this.props.placeholder || _t("e.g. my-room")}
                onChange={this.onChange}
                value={this.props.value.substring(1, this.props.value.length - this.props.domain.length - 1)}
                maxLength={maxlength}
                disabled={this.props.disabled}
                autoComplete="off"
                onKeyDown={this.props.onKeyDown}
            />
        );
    }

    private onChange = (ev) => {
        if (this.props.onChange) {
            this.props.onChange(this.asFullAlias(ev.target.value));
        }
    };

    private onValidate = async (fieldState) => {
        const result = await this.validationRules(fieldState);
        this.setState({ isValid: result.valid });
        return result;
    };

    private validationRules = withValidation({
        rules: [
            {
                key: "safeLocalpart",
                test: async ({ value }) => {
                    if (!value) {
                        return true;
                    }
                    const fullAlias = this.asFullAlias(value);
                    // XXX: FIXME https://github.com/matrix-org/matrix-doc/issues/668
                    return !value.includes("#") && !value.includes(":") && !value.includes(",") &&
                        encodeURI(fullAlias) === fullAlias;
                },
                invalid: () => _t("Some characters not allowed"),
            }, {
                key: "required",
                test: async ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Please provide an address"),
            }, {
                key: "taken",
                final: true,
                test: async ({ value }) => {
                    if (!value) {
                        return true;
                    }
                    const client = MatrixClientPeg.get();
                    try {
                        await client.getRoomIdForAlias(this.asFullAlias(value));
                        // we got a room id, so the alias is taken
                        return false;
                    } catch (err) {
                        // any server error code will do,
                        // either it M_NOT_FOUND or the alias is invalid somehow,
                        // in which case we don't want to show the invalid message
                        return !!err.errcode;
                    }
                },
                valid: () => _t("This address is available to use"),
                invalid: () => _t("This address is already in use"),
            },
        ],
    });

    public get isValid() {
        return this.state.isValid;
    }

    public validate(options: IValidateOpts) {
        return this.fieldRef.current?.validate(options);
    }

    public focus() {
        this.fieldRef.current?.focus();
    }
}
