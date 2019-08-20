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
import MatrixClientPeg from "../../../MatrixClientPeg";
import {SERVICE_TYPES} from "matrix-js-sdk";
import {IntegrationManagerInstance} from "../../../integrations/IntegrationManagerInstance";
import Modal from "../../../Modal";

export default class SetIntegrationManager extends React.Component {
    constructor() {
        super();

        const currentManager = IntegrationManagers.sharedInstance().getPrimaryManager();

        this.state = {
            currentManager,
            url: "", // user-entered text
            error: null,
            busy: false,
            checking: false,
        };
    }

    _onUrlChanged = (ev) => {
        const u = ev.target.value;
        this.setState({url: u});
    };

    _getTooltip = () => {
        if (this.state.checking) {
            const InlineSpinner = sdk.getComponent('views.elements.InlineSpinner');
            return <div>
                <InlineSpinner />
                { _t("Checking server") }
            </div>;
        } else if (this.state.error) {
            return <span className="warning">{this.state.error}</span>;
        } else {
            return null;
        }
    };

    _canChange = () => {
        return !!this.state.url && !this.state.busy;
    };

    _continueTerms = async (manager) => {
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

    _setManager = async (ev) => {
        // Don't reload the page when the user hits enter in the form.
        ev.preventDefault();
        ev.stopPropagation();

        this.setState({busy: true, checking: true, error: null});

        let offline = false;
        let manager: IntegrationManagerInstance;
        try {
            manager = await IntegrationManagers.sharedInstance().tryDiscoverManager(this.state.url);
            offline = !manager; // no manager implies offline
        } catch (e) {
            console.error(e);
            offline = true; // probably a connection error
        }
        if (offline) {
            this.setState({
                busy: false,
                checking: false,
                error: _t("Integration manager offline or not accessible."),
            });
            return;
        }

        // Test the manager (causes terms of service prompt if agreement is needed)
        // We also cancel the tooltip at this point so it doesn't collide with the dialog.
        this.setState({checking: false});
        try {
            const client = manager.getScalarClient();
            await client.connect();
        } catch (e) {
            console.error(e);
            this.setState({
                busy: false,
                error: _t("Terms of service not accepted or the integration manager is invalid."),
            });
            return;
        }

        // Specifically request the terms of service to see if there are any.
        // The above won't trigger a terms of service check if there are no terms to
        // sign, so when there's no terms at all we need to ensure we tell the user.
        let hasTerms = true;
        try {
            const terms = await MatrixClientPeg.get().getTerms(SERVICE_TYPES.IM, manager.trimmedApiUrl);
            hasTerms = terms && terms['policies'] && Object.keys(terms['policies']).length > 0;
        } catch (e) {
            // Assume errors mean there are no terms. This could be a 404, 500, etc
            console.error(e);
            hasTerms = false;
        }
        if (!hasTerms) {
            this.setState({busy: false});
            const QuestionDialog = sdk.getComponent("views.dialogs.QuestionDialog");
            Modal.createTrackedDialog('No Terms Warning', '', QuestionDialog, {
                title: _t("Integration manager has no terms of service"),
                description: (
                    <div>
                        <span className="warning">
                            {_t("The integration manager you have chosen does not have any terms of service.")}
                        </span>
                        <span>
                            &nbsp;{_t("Only continue if you trust the owner of the server.")}
                        </span>
                    </div>
                ),
                button: _t("Continue"),
                onFinished: async (confirmed) => {
                    if (!confirmed) return;
                    this._continueTerms(manager);
                },
            });
            return;
        }

        this._continueTerms(manager);
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
                <Field
                    label={_t("Enter a new integration manager")}
                    id="mx_SetIntegrationManager_newUrl"
                    type="text" value={this.state.url}
                    autoComplete="off"
                    onChange={this._onUrlChanged}
                    tooltipContent={this._getTooltip()}
                    tooltipClassName="mx_SetIntegrationManager_tooltip"
                    disabled={this.state.busy}
                    flagInvalid={!!this.state.error}
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
