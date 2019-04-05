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

import React from 'react';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';

const MODULAR_URL = 'https://modular.im/?utm_source=riot-web&utm_medium=web&utm_campaign=riot-web-authentication';

/*
 * Configure the Modular server name.
 *
 * This is a variant of ServerConfig with only the HS field and different body
 * text that is specific to the Modular case.
 */
export default class ModularServerConfig extends React.PureComponent {
    static propTypes = {
        onServerConfigChange: PropTypes.func,

        // default URLs are defined in config.json (or the hardcoded defaults)
        // they are used if the user has not overridden them with a custom URL.
        // In other words, if the custom URL is blank, the default is used.
        defaultHsUrl: PropTypes.string, // e.g. https://matrix.org

        // This component always uses the default IS URL and doesn't allow it
        // to be changed.  We still receive it as a prop here to simplify
        // consumers by still passing the IS URL via onServerConfigChange.
        defaultIsUrl: PropTypes.string, // e.g. https://vector.im

        // custom URLs are explicitly provided by the user and override the
        // default URLs.  The user enters them via the component's input fields,
        // which is reflected on these properties whenever on..UrlChanged fires.
        // They are persisted in localStorage by MatrixClientPeg, and so can
        // override the default URLs when the component initially loads.
        customHsUrl: PropTypes.string,

        delayTimeMs: PropTypes.number, // time to wait before invoking onChanged
    }

    static defaultProps = {
        onServerConfigChange: function() {},
        customHsUrl: "",
        delayTimeMs: 0,
    }

    constructor(props) {
        super(props);

        this.state = {
            hsUrl: props.customHsUrl,
        };
    }

    componentWillReceiveProps(newProps) {
        if (newProps.customHsUrl === this.state.hsUrl) return;

        this.setState({
            hsUrl: newProps.customHsUrl,
        });
        this.props.onServerConfigChange({
            hsUrl: newProps.customHsUrl,
            isUrl: this.props.defaultIsUrl,
        });
    }

    onHomeserverBlur = (ev) => {
        this._hsTimeoutId = this._waitThenInvoke(this._hsTimeoutId, () => {
            this.props.onServerConfigChange({
                hsUrl: this.state.hsUrl,
                isUrl: this.props.defaultIsUrl,
            });
        });
    }

    onHomeserverChange = (ev) => {
        const hsUrl = ev.target.value;
        this.setState({ hsUrl });
    }

    _waitThenInvoke(existingTimeoutId, fn) {
        if (existingTimeoutId) {
            clearTimeout(existingTimeoutId);
        }
        return setTimeout(fn.bind(this), this.props.delayTimeMs);
    }

    render() {
        const Field = sdk.getComponent('elements.Field');

        return (
            <div className="mx_ServerConfig">
                <h3>{_t("Your Modular server")}</h3>
                {_t(
                    "Enter the location of your Modular homeserver. It may use your own " +
                    "domain name or be a subdomain of <a>modular.im</a>.",
                    {}, {
                        a: sub => <a href={MODULAR_URL} target="_blank" rel="noopener">
                            {sub}
                        </a>,
                    },
                )}
                <div className="mx_ServerConfig_fields">
                    <Field id="mx_ServerConfig_hsUrl"
                        label={_t("Server Name")}
                        placeholder={this.props.defaultHsUrl}
                        value={this.state.hsUrl}
                        onBlur={this.onHomeserverBlur}
                        onChange={this.onHomeserverChange}
                    />
                </div>
            </div>
        );
    }
}
