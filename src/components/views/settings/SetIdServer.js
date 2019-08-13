/*
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

import request from 'browser-request';
import url from 'url';
import React from 'react';
import {_t} from "../../../languageHandler";
import sdk from '../../../index';
import MatrixClientPeg from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";
import Field from "../elements/Field";

/**
 * If a url has no path component, etc. abbreviate it to just the hostname
 *
 * @param {string} u The url to be abbreviated
 * @returns {string} The abbreviated url
 */
function abbreviateUrl(u) {
    if (!u) return '';

    const parsedUrl = url.parse(u);
    // if it's something we can't parse as a url then just return it
    if (!parsedUrl) return u;

    if (parsedUrl.path == '/') {
        // we ignore query / hash parts: these aren't relevant for IS server URLs
        return parsedUrl.host;
    }

    return u;
}

function unabbreviateUrl(u) {
    if (!u) return '';

    let longUrl = u;
    if (!u.startsWith('https://')) longUrl = 'https://' + u;
    const parsed = url.parse(longUrl);
    if (parsed.hostname === null) return u;

    return longUrl;
}

/**
 * Check an IS URL is valid, including liveness check
 *
 * @param {string} isUrl The url to check
 * @returns {string} null if url passes all checks, otherwise i18ned error string
 */
async function checkIdentityServerUrl(url) {
    const parsedUrl = url.parse(isUrl);

    if (parsedUrl.protocol !== 'https:') return _t("Identity Server URL must be HTTPS");

    // XXX: duplicated logic from js-sdk but it's quite tied up in the validation logic in the
    // js-sdk so probably as easy to duplicate it than to separate it out so we can reuse it
    return new Promise((resolve) => {
        request(
            // also XXX: we don't really know whether to hit /v1 or /v2 for this: we
            // probably want a /versions endpoint like the C/S API.
            { method: "GET", url: isUrl + '/_matrix/identity/api/v1' },
            (err, response, body) => {
                if (err) {
                    resolve(_t("Could not connect to Identity Server"));
                } else if (response.status < 200 || response.status >= 300) {
                    resolve(_t("Not a valid Identity Server (status code %(code)s)", {code: response.status}));
                } else {
                    resolve(null);
                }
            },
        );
    });
}

export default class SetIdServer extends React.Component {
    constructor() {
        super();

        let defaultIdServer = abbreviateUrl(MatrixClientPeg.get().getIdentityServerUrl());
        if (!defaultIdServer) {
            defaultIdServer = abbreviateUrl(SdkConfig.get()['validated_server_config']['idServer']) || '';
        }

        this.state = {
            currentClientIdServer: MatrixClientPeg.get().getIdentityServerUrl(),
            idServer: defaultIdServer,
            error: null,
            busy: false,
        };
    }

    _onIdentityServerChanged = (ev) => {
        const u = ev.target.value;

        this.setState({idServer: u});
    };

    _getTooltip = () => {
        if (this.state.busy) {
            const InlineSpinner = sdk.getComponent('views.elements.InlineSpinner');
            return <div>
                <InlineSpinner />
                { _t("Checking server") }
            </div>;
        } else if (this.state.error) {
            return this.state.error;
        } else {
            return null;
        }
    };

    _idServerChangeEnabled = () => {
        return !!this.state.idServer && !this.state.busy;
    };

    _saveIdServer = async () => {
        this.setState({busy: true});

        const fullUrl = unabbreviateUrl(this.state.idServer);

        const errStr = await checkIsUrl(fullUrl);

        let newFormValue = this.state.idServer;
        if (!errStr) {
            MatrixClientPeg.get().setIdentityServerUrl(fullUrl);
            localStorage.removeItem("mx_is_access_token");
            localStorage.setItem("mx_is_url", fullUrl);
            newFormValue = '';
        }
        this.setState({
            busy: false,
            error: errStr,
            currentClientIdServer: MatrixClientPeg.get().getIdentityServerUrl(),
            idServer: newFormValue,
        });
    };

    render() {
        const idServerUrl = this.state.currentClientIdServer;
        let sectionTitle;
        let bodyText;
        if (idServerUrl) {
            sectionTitle = _t("Identity Server (%(server)s)", { server: abbreviateUrl(idServerUrl) });
            bodyText = _t(
                "You are currently using <server></server> to discover and be discoverable by " +
                "existing contacts you know. You can change your identity server below.",
                {},
                { server: sub => <b>{abbreviateUrl(idServerUrl)}</b> },
            );
        } else {
            sectionTitle = _t("Identity Server");
            bodyText = _t(
                "You are not currently using an identity server. " +
                "To discover and be discoverable by existing contacts you know, " +
                "add one below.",
            );
        }

        return (
            <form className="mx_SettingsTab_section mx_SetIdServer" onSubmit={this._saveIdServer}>
                <span className="mx_SettingsTab_subheading">
                    {sectionTitle}
                </span>
                <span className="mx_SettingsTab_subsectionText">
                    {bodyText}
                </span>
                <Field label={_t("Identity Server")}
                    id="mx_SetIdServer_idServer"
                    type="text" value={this.state.idServer} autoComplete="off"
                    onChange={this._onIdentityServerChanged}
                    tooltip={this._getTooltip()}
                />
                <input className="mx_Dialog_primary"
                    type="submit" value={_t("Change")}
                    disabled={!this._idServerChangeEnabled()}
                />
            </form>
        );
    }
}
