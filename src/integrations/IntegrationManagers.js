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

import SdkConfig from '../SdkConfig';
import sdk from "../index";
import Modal from '../Modal';
import {IntegrationManagerInstance, KIND_ACCOUNT, KIND_CONFIG} from "./IntegrationManagerInstance";
import type {MatrixClient, MatrixEvent} from "matrix-js-sdk";
import WidgetUtils from "../utils/WidgetUtils";
import MatrixClientPeg from "../MatrixClientPeg";

export class IntegrationManagers {
    static _instance;

    static sharedInstance(): IntegrationManagers {
        if (!IntegrationManagers._instance) {
            IntegrationManagers._instance = new IntegrationManagers();
        }
        return IntegrationManagers._instance;
    }

    _managers: IntegrationManagerInstance[] = [];
    _client: MatrixClient;

    constructor() {
        this._compileManagers();
    }

    startWatching(): void {
        this.stopWatching();
        this._client = MatrixClientPeg.get();
        this._client.on("accountData", this._onAccountData.bind(this));
        this._compileManagers();
    }

    stopWatching(): void {
        if (!this._client) return;
        this._client.removeListener("accountData", this._onAccountData.bind(this));
    }

    _compileManagers() {
        this._managers = [];
        this._setupConfiguredManager();
        this._setupAccountManagers();
    }

    _setupConfiguredManager() {
        const apiUrl = SdkConfig.get()['integrations_rest_url'];
        const uiUrl = SdkConfig.get()['integrations_ui_url'];

        if (apiUrl && uiUrl) {
            this._managers.push(new IntegrationManagerInstance(KIND_CONFIG, apiUrl, uiUrl));
        }
    }

    _setupAccountManagers() {
        if (!this._client || !this._client.getUserId()) return; // not logged in
        const widgets = WidgetUtils.getIntegrationManagerWidgets();
        widgets.forEach(w => {
            const data = w.content['data'];
            if (!data) return;

            const uiUrl = w.content['url'];
            const apiUrl = data['api_url'];
            if (!apiUrl || !uiUrl) return;

            this._managers.push(new IntegrationManagerInstance(KIND_ACCOUNT, apiUrl, uiUrl));
        });
    }

    _onAccountData(ev: MatrixEvent): void {
        if (ev.getType() === 'm.widgets') {
            this._compileManagers();
        }
    }

    hasManager(): boolean {
        return this._managers.length > 0;
    }

    getPrimaryManager(): IntegrationManagerInstance {
        if (this.hasManager()) {
            return this._managers[this._managers.length - 1];
        } else {
            return null;
        }
    }

    openNoManagerDialog(): void {
        // TODO: Is it Integrations (plural) or Integration (singular). Singular is easier spoken.
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        Modal.createTrackedDialog(
            "Integration Manager", "None", IntegrationsManager,
            {configured: false}, 'mx_IntegrationsManager',
        );
    }

    async overwriteManagerOnAccount(manager: IntegrationManagerInstance) {
        // TODO: TravisR - We should be logging out of scalar clients.
        await WidgetUtils.removeIntegrationManagerWidgets();

        // TODO: TravisR - We should actually be carrying over the discovery response verbatim.
        await WidgetUtils.addIntegrationManagerWidget(manager.name, manager.uiUrl, manager.apiUrl);
    }

    /**
     * Attempts to discover an integration manager using only its name. This will not validate that
     * the integration manager is functional - that is the caller's responsibility.
     * @param {string} domainName The domain name to look up.
     * @returns {Promise<IntegrationManagerInstance>} Resolves to an integration manager instance,
     * or null if none was found.
     */
    async tryDiscoverManager(domainName: string): IntegrationManagerInstance {
        console.log("Looking up integration manager via .well-known");
        if (domainName.startsWith("http:") || domainName.startsWith("https:")) {
            // trim off the scheme and just use the domain
            const url = url.parse(domainName);
            domainName = url.host;
        }

        let wkConfig;
        try {
            const result = await fetch(`https://${domainName}/.well-known/matrix/integrations`);
            wkConfig = await result.json();
        } catch (e) {
            console.error(e);
            console.warn("Failed to locate integration manager");
            return null;
        }

        if (!wkConfig || !wkConfig["m.integrations_widget"]) {
            console.warn("Missing integrations widget on .well-known response");
            return null;
        }

        const widget = wkConfig["m.integrations_widget"];
        if (!widget["url"] || !widget["data"] || !widget["data"]["api_url"]) {
            console.warn("Malformed .well-known response for integrations widget");
            return null;
        }

        // All discovered managers are per-user managers
        const manager = new IntegrationManagerInstance(KIND_ACCOUNT, widget["data"]["api_url"], widget["url"]);
        console.log("Got an integration manager (untested)");

        // We don't test the manager because the caller may need to do extra
        // checks or similar with it. For instance, they may need to deal with
        // terms of service or want to call something particular.

        return manager;
    }
}

// For debugging
global.mxIntegrationManagers = IntegrationManagers;
