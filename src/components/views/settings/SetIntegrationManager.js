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

import React from 'react';
import {_t} from "../../../languageHandler";
import sdk from '../../../index';
import Field from "../elements/Field";
import {IntegrationManagers} from "../../../integrations/IntegrationManagers";

export default class SetIntegrationManager extends React.Component {
    constructor() {
        super();

        const currentManager = IntegrationManagers.sharedInstance().getPrimaryManager();

        this.state = {
            currentManager,
            url: "", // user-entered text
            error: null,
            busy: false,
        };
    }

    _onUrlChanged = (ev) => {
        const u = ev.target.value;
        this.setState({url: u});
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

    _canChange = () => {
        return !!this.state.url && !this.state.busy;
    };

    _setManager = async (ev) => {
        // Don't reload the page when the user hits enter in the form.
        ev.preventDefault();
        ev.stopPropagation();

        this.setState({busy: true});

        const manager = await IntegrationManagers.sharedInstance().tryDiscoverManager(this.state.url);
        if (!manager) {
            this.setState({
                busy: false,
                error: _t("Integration manager offline or not accessible."),
            });
            return;
        }

        try {
            await IntegrationManagers.sharedInstance().overwriteManagerOnAccount(manager);
            this.setState({
                busy: false,
                error: null,
                currentManager: IntegrationManagers.sharedInstance().getPrimaryManager(),
                url: "", // clear input
            });
        } catch (e) {
            console.error(e);
            this.setState({
                busy: false,
                error: _t("Failed to update integration manager"),
            });
        }
    };

    render() {
        const AccessibleButton = sdk.getComponent('views.elements.AccessibleButton');

        const currentManager = this.state.currentManager;
        let managerName;
        let bodyText;
        if (currentManager) {
            managerName = `(${currentManager.name})`;
            bodyText = _t(
                "You are currently using <b>%(serverName)s</b> to manage your bots, widgets, " +
                "and sticker packs.",
                {serverName: currentManager.name},
                { b: sub => <b>{sub}</b> },
            );
        } else {
            bodyText = _t(
                "Add which integration manager you want to manage your bots, widgets, " +
                "and sticker packs.",
            );
        }

        return (
            <form className="mx_SettingsTab_section mx_SetIntegrationManager" onSubmit={this._setManager}>
                <div className="mx_SettingsTab_heading">
                    <span>{_t("Integration Manager")}</span>
                    <span className="mx_SettingsTab_subheading">{managerName}</span>
                </div>
                <span className="mx_SettingsTab_subsectionText">
                    {bodyText}
                </span>
                <Field label={_t("Enter a new integration manager")}
                    id="mx_SetIntegrationManager_newUrl"
                    type="text" value={this.state.url} autoComplete="off"
                    onChange={this._onUrlChanged}
                    tooltipContent={this._getTooltip()}
                />
                <AccessibleButton
                    kind="primary_sm"
                    type="submit"
                    disabled={!this._canChange()}
                    onClick={this._setManager}
                >{_t("Change")}</AccessibleButton>
            </form>
        );
    }
}
