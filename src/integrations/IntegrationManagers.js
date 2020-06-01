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
import * as sdk from "../index";
import Modal from '../Modal';
import {IntegrationManagerInstance, KIND_ACCOUNT, KIND_CONFIG, KIND_HOMESERVER} from "./IntegrationManagerInstance";
import type {MatrixClient, MatrixEvent, Room} from "matrix-js-sdk";
import WidgetUtils from "../utils/WidgetUtils";
import {MatrixClientPeg} from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";

const KIND_PREFERENCE = [
    // Ordered: first is most preferred, last is least preferred.
    KIND_ACCOUNT,
    KIND_HOMESERVER,
    KIND_CONFIG,
];

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
    _primaryManager: IntegrationManagerInstance;

    constructor() {
        this._compileManagers();
    }

    startWatching(): void {
        this.stopWatching();
        this._client = MatrixClientPeg.get();
        this._client.on("accountData", this._onAccountData);
        this._client.on("WellKnown.client", this._setupHomeserverManagers);
        this._compileManagers();
    }

    stopWatching(): void {
        if (!this._client) return;
        this._client.removeListener("accountData", this._onAccountData);
        this._client.removeListener("WellKnown.client", this._setupHomeserverManagers);
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
            this._primaryManager = null; // reset primary
        }
    }

    async _setupHomeserverManagers(discoveryResponse) {
        console.log("Updating homeserver-configured integration managers...");
        if (discoveryResponse && discoveryResponse['m.integrations']) {
            let managers = discoveryResponse['m.integrations']['managers'];
            if (!Array.isArray(managers)) managers = []; // make it an array so we can wipe the HS managers

            console.log(`Homeserver has ${managers.length} integration managers`);

            // Clear out any known managers for the homeserver
            // TODO: Log out of the scalar clients
            this._managers = this._managers.filter(m => m.kind !== KIND_HOMESERVER);

            // Now add all the managers the homeserver wants us to have
            for (const hsManager of managers) {
                if (!hsManager["api_url"]) continue;
                this._managers.push(new IntegrationManagerInstance(
                    KIND_HOMESERVER,
                    hsManager["api_url"],
                    hsManager["ui_url"], // optional
                ));
            }

            this._primaryManager = null; // reset primary
        } else {
            console.log("Homeserver has no integration managers");
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

            const manager = new IntegrationManagerInstance(KIND_ACCOUNT, apiUrl, uiUrl);
            manager.id = w['id'] || w['state_key'] || '';
            this._managers.push(manager);
        });
        this._primaryManager = null; // reset primary
    }

    _onAccountData = (ev: MatrixEvent): void => {
        if (ev.getType() === 'm.widgets') {
            this._compileManagers();
        }
    };

    hasManager(): boolean {
        return this._managers.length > 0;
    }

    getOrderedManagers(): IntegrationManagerInstance[] {
        const ordered = [];
        for (const kind of KIND_PREFERENCE) {
            const managers = this._managers.filter(m => m.kind === kind);
            if (!managers || !managers.length) continue;

            if (kind === KIND_ACCOUNT) {
                // Order by state_keys (IDs)
                managers.sort((a, b) => a.id.localeCompare(b.id));
            }

            ordered.push(...managers);
        }
        return ordered;
    }

    getPrimaryManager(): IntegrationManagerInstance {
        if (this.hasManager()) {
            if (this._primaryManager) return this._primaryManager;

            this._primaryManager = this.getOrderedManagers()[0];
            return this._primaryManager;
        } else {
            return null;
        }
    }

    openNoManagerDialog(): void {
        const IntegrationsImpossibleDialog = sdk.getComponent("dialogs.IntegrationsImpossibleDialog");
        Modal.createTrackedDialog('Integrations impossible', '', IntegrationsImpossibleDialog);
    }

    openAll(room: Room = null, screen: string = null, integrationId: string = null): void {
        if (!SettingsStore.getValue("integrationProvisioning")) {
            return this.showDisabledDialog();
        }

        if (this._managers.length === 0) {
            return this.openNoManagerDialog();
        }

        const TabbedIntegrationManagerDialog = sdk.getComponent("views.dialogs.TabbedIntegrationManagerDialog");
        Modal.createTrackedDialog(
            'Tabbed Integration Manager', '', TabbedIntegrationManagerDialog,
            {room, screen, integrationId}, 'mx_TabbedIntegrationManagerDialog',
        );
    }

    showDisabledDialog(): void {
        const IntegrationsDisabledDialog = sdk.getComponent("dialogs.IntegrationsDisabledDialog");
        Modal.createTrackedDialog('Integrations disabled', '', IntegrationsDisabledDialog);
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
