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
import {ValidatedServerConfig} from "../../../utils/AutoDiscoveryUtils";
import SdkConfig from "../../../SdkConfig";
import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";
import * as ServerType from '../../views/auth/ServerTypeSelector';

const MODULAR_URL = 'https://modular.im/?utm_source=riot-web&utm_medium=web&utm_campaign=riot-web-authentication';

// TODO: TravisR - Can this extend ServerConfig for most things?

/*
 * Configure the Modular server name.
 *
 * This is a variant of ServerConfig with only the HS field and different body
 * text that is specific to the Modular case.
 */
export default class ModularServerConfig extends React.PureComponent {
    static propTypes = {
        onServerConfigChange: PropTypes.func,

        // The current configuration that the user is expecting to change.
        serverConfig: PropTypes.instanceOf(ValidatedServerConfig).isRequired,

        delayTimeMs: PropTypes.number, // time to wait before invoking onChanged

        // Called after the component calls onServerConfigChange
        onAfterSubmit: PropTypes.func,

        // Optional text for the submit button. If falsey, no button will be shown.
        submitText: PropTypes.string,

        // Optional class for the submit button. Only applies if the submit button
        // is to be rendered.
        submitClass: PropTypes.string,
    };

    static defaultProps = {
        onServerConfigChange: function() {},
        customHsUrl: "",
        delayTimeMs: 0,
    };

    constructor(props) {
        super(props);

        this.state = {
            busy: false,
            errorText: "",
            hsUrl: props.serverConfig.hsUrl,
            isUrl: props.serverConfig.isUrl,
        };
    }

    componentWillReceiveProps(newProps) {
        if (newProps.serverConfig.hsUrl === this.state.hsUrl &&
            newProps.serverConfig.isUrl === this.state.isUrl) return;

        this.validateAndApplyServer(newProps.serverConfig.hsUrl, newProps.serverConfig.isUrl);
    }

    async validateAndApplyServer(hsUrl, isUrl) {
        // Always try and use the defaults first
        const defaultConfig: ValidatedServerConfig = SdkConfig.get()["validated_server_config"];
        if (defaultConfig.hsUrl === hsUrl && defaultConfig.isUrl === isUrl) {
            this.setState({busy: false, errorText: ""});
            this.props.onServerConfigChange(defaultConfig);
            return defaultConfig;
        }

        this.setState({
            hsUrl,
            isUrl,
            busy: true,
            errorText: "",
        });

        try {
            const result = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl);
            this.setState({busy: false, errorText: ""});
            this.props.onServerConfigChange(result);
            return result;
        } catch (e) {
            console.error(e);
            let message = _t("Unable to validate homeserver/identity server");
            if (e.translatedMessage) {
                message = e.translatedMessage;
            }
            this.setState({
                busy: false,
                errorText: message,
            });

            return null;
        }
    }

    async validateServer() {
        // TODO: Do we want to support .well-known lookups here?
        // If for some reason someone enters "matrix.org" for a URL, we could do a lookup to
        // find their homeserver without demanding they use "https://matrix.org"
        return this.validateAndApplyServer(this.state.hsUrl, ServerType.TYPES.PREMIUM.identityServerUrl);
    }

    onHomeserverBlur = (ev) => {
        this._hsTimeoutId = this._waitThenInvoke(this._hsTimeoutId, () => {
            this.validateServer();
        });
    };

    onHomeserverChange = (ev) => {
        const hsUrl = ev.target.value;
        this.setState({ hsUrl });
    };

    onSubmit = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const result = await this.validateServer();
        if (!result) return; // Do not continue.

        if (this.props.onAfterSubmit) {
            this.props.onAfterSubmit();
        }
    };

    _waitThenInvoke(existingTimeoutId, fn) {
        if (existingTimeoutId) {
            clearTimeout(existingTimeoutId);
        }
        return setTimeout(fn.bind(this), this.props.delayTimeMs);
    }

    render() {
        const Field = sdk.getComponent('elements.Field');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const submitButton = this.props.submitText
            ? <AccessibleButton
                element="button"
                type="submit"
                className={this.props.submitClass}
                onClick={this.onSubmit}
                disabled={this.state.busy}>{this.props.submitText}</AccessibleButton>
            : null;

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
                <form onSubmit={this.onSubmit} autoComplete={false} action={null}>
                    <div className="mx_ServerConfig_fields">
                        <Field id="mx_ServerConfig_hsUrl"
                            label={_t("Server Name")}
                            placeholder={this.props.serverConfig.hsUrl}
                            value={this.state.hsUrl}
                            onBlur={this.onHomeserverBlur}
                            onChange={this.onHomeserverChange}
                        />
                    </div>
                    {submitButton}
                </form>
            </div>
        );
    }
}
