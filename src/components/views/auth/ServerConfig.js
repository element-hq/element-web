/*
Copyright 2015, 2016 OpenMarket Ltd
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
import Modal from '../../../Modal';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';

/*
 * A pure UI component which displays the HS and IS to use.
 */

export default class ServerConfig extends React.PureComponent {
    static propTypes = {
        onServerConfigChange: PropTypes.func,

        // default URLs are defined in config.json (or the hardcoded defaults)
        // they are used if the user has not overridden them with a custom URL.
        // In other words, if the custom URL is blank, the default is used.
        defaultHsUrl: PropTypes.string, // e.g. https://matrix.org
        defaultIsUrl: PropTypes.string, // e.g. https://vector.im

        // custom URLs are explicitly provided by the user and override the
        // default URLs.  The user enters them via the component's input fields,
        // which is reflected on these properties whenever on..UrlChanged fires.
        // They are persisted in localStorage by MatrixClientPeg, and so can
        // override the default URLs when the component initially loads.
        customHsUrl: PropTypes.string,
        customIsUrl: PropTypes.string,

        delayTimeMs: PropTypes.number, // time to wait before invoking onChanged
    }

    static defaultProps = {
        onServerConfigChange: function() {},
        customHsUrl: "",
        customIsUrl: "",
        delayTimeMs: 0,
    }

    constructor(props) {
        super(props);

        this.state = {
            hsUrl: props.customHsUrl,
            isUrl: props.customIsUrl,
        };
    }

    componentWillReceiveProps(newProps) {
        if (newProps.customHsUrl === this.state.hsUrl &&
            newProps.customIsUrl === this.state.isUrl) return;

        this.setState({
            hsUrl: newProps.customHsUrl,
            isUrl: newProps.customIsUrl,
        });
        this.props.onServerConfigChange({
            hsUrl: newProps.customHsUrl,
            isUrl: newProps.customIsUrl,
        });
    }

    onHomeserverBlur = (ev) => {
        this._hsTimeoutId = this._waitThenInvoke(this._hsTimeoutId, () => {
            this.props.onServerConfigChange({
                hsUrl: this.state.hsUrl,
                isUrl: this.state.isUrl,
            });
        });
    }

    onHomeserverChange = (ev) => {
        const hsUrl = ev.target.value;
        this.setState({ hsUrl });
    }

    onIdentityServerBlur = (ev) => {
        this._isTimeoutId = this._waitThenInvoke(this._isTimeoutId, () => {
            this.props.onServerConfigChange({
                hsUrl: this.state.hsUrl,
                isUrl: this.state.isUrl,
            });
        });
    }

    onIdentityServerChange = (ev) => {
        const isUrl = ev.target.value;
        this.setState({ isUrl });
    }

    _waitThenInvoke(existingTimeoutId, fn) {
        if (existingTimeoutId) {
            clearTimeout(existingTimeoutId);
        }
        return setTimeout(fn.bind(this), this.props.delayTimeMs);
    }

    showHelpPopup = () => {
        const CustomServerDialog = sdk.getComponent('auth.CustomServerDialog');
        Modal.createTrackedDialog('Custom Server Dialog', '', CustomServerDialog);
    }

    render() {
        const Field = sdk.getComponent('elements.Field');

        return (
            <div className="mx_ServerConfig">
                <h3>{_t("Other servers")}</h3>
                {_t("Enter custom server URLs <a>What does this mean?</a>", {}, {
                    a: sub => <a className="mx_ServerConfig_help" href="#" onClick={this.showHelpPopup}>
                        { sub }
                    </a>,
                })}
                <div className="mx_ServerConfig_fields">
                    <Field id="mx_ServerConfig_hsUrl"
                        label={_t("Homeserver URL")}
                        placeholder={this.props.defaultHsUrl}
                        value={this.state.hsUrl}
                        onBlur={this.onHomeserverBlur}
                        onChange={this.onHomeserverChange}
                    />
                    <Field id="mx_ServerConfig_isUrl"
                        label={_t("Identity Server URL")}
                        placeholder={this.props.defaultIsUrl}
                        value={this.state.isUrl}
                        onBlur={this.onIdentityServerBlur}
                        onChange={this.onIdentityServerChange}
                    />
                </div>
            </div>
        );
    }
}
