/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import Modal from '../../../Modal';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import {ValidatedServerConfig} from "../../../utils/AutoDiscoveryUtils";
import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";
import SdkConfig from "../../../SdkConfig";
import CountlyAnalytics from "../../../CountlyAnalytics";

/*
 * A pure UI component which displays the HS and IS to use.
 */

export default class ServerConfig extends React.PureComponent {
    static propTypes = {
        onServerConfigChange: PropTypes.func.isRequired,

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

        CountlyAnalytics.instance.track("onboarding_custom_server");
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(newProps) { // eslint-disable-line camelcase
        if (newProps.serverConfig.hsUrl === this.state.hsUrl &&
            newProps.serverConfig.isUrl === this.state.isUrl) return;

        this.validateAndApplyServer(newProps.serverConfig.hsUrl, newProps.serverConfig.isUrl);
    }

    async validateServer() {
        // TODO: Do we want to support .well-known lookups here?
        // If for some reason someone enters "matrix.org" for a URL, we could do a lookup to
        // find their homeserver without demanding they use "https://matrix.org"
        const result = this.validateAndApplyServer(this.state.hsUrl, this.state.isUrl);
        if (!result) {
            return result;
        }

        return result;
    }

    async validateAndApplyServer(hsUrl, isUrl) {
        // Always try and use the defaults first
        const defaultConfig: ValidatedServerConfig = SdkConfig.get()["validated_server_config"];
        if (defaultConfig.hsUrl === hsUrl && defaultConfig.isUrl === isUrl) {
            this.setState({
                hsUrl: defaultConfig.hsUrl,
                isUrl: defaultConfig.isUrl,
                busy: false,
                errorText: "",
            });
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

            const stateForError = AutoDiscoveryUtils.authComponentStateForError(e);
            if (!stateForError.isFatalError) {
                this.setState({
                    busy: false,
                });
                // carry on anyway
                const result = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl, true);
                this.props.onServerConfigChange(result);
                return result;
            } else {
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

    showHelpPopup = () => {
        const CustomServerDialog = sdk.getComponent('auth.CustomServerDialog');
        Modal.createTrackedDialog('Custom Server Dialog', '', CustomServerDialog);
    };

    _renderHomeserverSection() {
        const Field = sdk.getComponent('elements.Field');
        return <div>
            {_t("Enter your custom homeserver URL <a>What does this mean?</a>", {}, {
                a: sub => <a className="mx_ServerConfig_help" href="#" onClick={this.showHelpPopup}>
                    {sub}
                </a>,
            })}
            <Field
                id="mx_ServerConfig_hsUrl"
                label={_t("Homeserver URL")}
                placeholder={this.props.serverConfig.hsUrl}
                value={this.state.hsUrl}
                onBlur={this.onHomeserverBlur}
                onChange={this.onHomeserverChange}
                disabled={this.state.busy}
            />
        </div>;
    }

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const errorText = this.state.errorText
            ? <span className='mx_ServerConfig_error'>{this.state.errorText}</span>
            : null;

        const submitButton = this.props.submitText
            ? <AccessibleButton
                  element="button"
                  type="submit"
                  className={this.props.submitClass}
                  onClick={this.onSubmit}
                  disabled={this.state.busy}>{this.props.submitText}</AccessibleButton>
            : null;

        return (
            <form className="mx_ServerConfig" onSubmit={this.onSubmit} autoComplete="off">
                <h3>{_t("Other servers")}</h3>
                {errorText}
                {this._renderHomeserverSection()}
                {submitButton}
            </form>
        );
    }
}
