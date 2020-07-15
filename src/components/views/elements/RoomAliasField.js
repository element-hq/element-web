/*
Copyright 2019 New Vector Ltd

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
import { _t } from '../../../languageHandler';
import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import withValidation from './Validation';
import {MatrixClientPeg} from '../../../MatrixClientPeg';

// Controlled form component wrapping Field for inputting a room alias scoped to a given domain
export default class RoomAliasField extends React.PureComponent {
    static propTypes = {
        domain: PropTypes.string.isRequired,
        onChange: PropTypes.func,
        value: PropTypes.string.isRequired,
    };

    constructor(props) {
        super(props);
        this.state = {isValid: true};
    }

    _asFullAlias(localpart) {
        return `#${localpart}:${this.props.domain}`;
    }

    render() {
        const Field = sdk.getComponent('views.elements.Field');
        const poundSign = (<span>#</span>);
        const aliasPostfix = ":" + this.props.domain;
        const domain = (<span title={aliasPostfix}>{aliasPostfix}</span>);
        const maxlength = 255 - this.props.domain.length - 2;   // 2 for # and :
        return (
                <Field
                    label={_t("Room address")}
                    className="mx_RoomAliasField"
                    prefixComponent={poundSign}
                    postfixComponent={domain}
                    ref={ref => this._fieldRef = ref}
                    onValidate={this._onValidate}
                    placeholder={_t("e.g. my-room")}
                    onChange={this._onChange}
                    value={this.props.value.substring(1, this.props.value.length - this.props.domain.length - 1)}
                    maxLength={maxlength} />
        );
    }

    _onChange = (ev) => {
        if (this.props.onChange) {
            this.props.onChange(this._asFullAlias(ev.target.value));
        }
    };

    _onValidate = async (fieldState) => {
        const result = await this._validationRules(fieldState);
        this.setState({isValid: result.valid});
        return result;
    };

    _validationRules = withValidation({
        rules: [
            {
                key: "safeLocalpart",
                test: async ({ value }) => {
                    if (!value) {
                        return true;
                    }
                    const fullAlias = this._asFullAlias(value);
                    // XXX: FIXME https://github.com/matrix-org/matrix-doc/issues/668
                    return !value.includes("#") && !value.includes(":") && !value.includes(",") &&
                        encodeURI(fullAlias) === fullAlias;
                },
                invalid: () => _t("Some characters not allowed"),
            }, {
                key: "required",
                test: async ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Please provide a room address"),
            }, {
                key: "taken",
                final: true,
                test: async ({value}) => {
                    if (!value) {
                        return true;
                    }
                    const client = MatrixClientPeg.get();
                    try {
                        await client.getRoomIdForAlias(this._asFullAlias(value));
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

    get isValid() {
        return this.state.isValid;
    }

    validate(options) {
        return this._fieldRef.validate(options);
    }

    focus() {
        this._fieldRef.focus();
    }
}
