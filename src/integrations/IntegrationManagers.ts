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

import type {MatrixClient} from "matrix-js-sdk/src/client";
import type {MatrixEvent} from "matrix-js-sdk/src/models/event";
import type {Room} from "matrix-js-sdk/src/models/room";

import SdkConfig from '../SdkConfig';
import Modal from '../Modal';
import {IntegrationManagerInstance, Kind} from "./IntegrationManagerInstance";
import IntegrationsImpossibleDialog from "../components/views/dialogs/IntegrationsImpossibleDialog";
import TabbedIntegrationManagerDialog from "../components/views/dialogs/TabbedIntegrationManagerDialog";
import IntegrationsDisabledDialog from "../components/views/dialogs/IntegrationsDisabledDialog";
import WidgetUtils from "../utils/WidgetUtils";
import {MatrixClientPeg} from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";
import url from 'url';

const KIND_PREFERENCE = [
    // Ordered: first is most preferred, last is least preferred.
    Kind.Account,
    Kind.Homeserver,
    Kind.Config,
];

export class IntegrationManagers {
    private static instance;

    private managers: IntegrationManagerInstance[] = [];
    private client: MatrixClient;
    private primaryManager: IntegrationManagerInstance;

    public static sharedInstance(): IntegrationManagers {
        if (!IntegrationManagers.instance) {
            IntegrationManagers.instance = new IntegrationManagers();
        }
        return IntegrationManagers.instance;
    }

    constructor() {
        this.compileManagers();
    }

    startWatching(): void {
        this.stopWatching();
        this.client = MatrixClientPeg.get();
        this.client.on("accountData", this.onAccountData);
        this.client.on("WellKnown.client", this.setupHomeserverManagers);
        this.compileManagers();
    }

    stopWatching(): void {
        if (!this.client) return;
        this.client.removeListener("accountData", this.onAccountData);
        this.client.removeListener("WellKnown.client", this.setupHomeserverManagers);
    }

    private compileManagers() {
        this.managers = [];
        this.setupConfiguredManager();
        this.setupAccountManagers();
    }

    private setupConfiguredManager() {
        const apiUrl: string = SdkConfig.get()['integrations_rest_url'];
        const uiUrl: string = SdkConfig.get()['integrations_ui_url'];

        if (apiUrl && uiUrl) {
            this.managers.push(new IntegrationManagerInstance(Kind.Config, apiUrl, uiUrl));
            this.primaryManager = null; // reset primary
        }
    }

    private setupHomeserverManagers = async (discoveryResponse) => {
        console.log("Updating homeserver-configured integration managers...");
        if (discoveryResponse && discoveryResponse['m.integrations']) {
            let managers = discoveryResponse['m.integrations']['managers'];
            if (!Array.isArray(managers)) managers = []; // make it an array so we can wipe the HS managers

            console.log(`Homeserver has ${managers.length} integration managers`);

            // Clear out any known managers for the homeserver
            // TODO: Log out of the scalar clients
            this.managers = this.managers.filter(m => m.kind !== Kind.Homeserver);

            // Now add all the managers the homeserver wants us to have
            for (const hsManager of managers) {
                if (!hsManager["api_url"]) continue;
                this.managers.push(new IntegrationManagerInstance(
                    Kind.Homeserver,
                    hsManager["api_url"],
                    hsManager["ui_url"], // optional
                ));
            }

            this.primaryManager = null; // reset primary
        } else {
            console.log("Homeserver has no integration managers");
        }
    };

    private setupAccountManagers() {
        if (!this.client || !this.client.getUserId()) return; // not logged in
        const widgets = WidgetUtils.getIntegrationManagerWidgets();
        widgets.forEach(w => {
            const data = w.content['data'];
            if (!data) return;

            const uiUrl = w.content['url'];
            const apiUrl = data['api_url'];
            if (!apiUrl || !uiUrl) return;

            const manager = new IntegrationManagerInstance(Kind.Account, apiUrl, uiUrl, w['id'] || w['state_key'] || '');
            this.managers.push(manager);
        });
        this.primaryManager = null; // reset primary
    }

    private onAccountData = (ev: MatrixEvent): void => {
        if (ev.getType() === 'm.widgets') {
            this.compileManagers();
        }
    };

    hasManager(): boolean {
        return this.managers.length > 0;
    }

    getOrderedManagers(): IntegrationManagerInstance[] {
        const ordered = [];
        for (const kind of KIND_PREFERENCE) {
            const managers = this.managers.filter(m => m.kind === kind);
            if (!managers || !managers.length) continue;

            if (kind === Kind.Account) {
                // Order by state_keys (IDs)
                managers.sort((a, b) => a.id.localeCompare(b.id));
            }

            ordered.push(...managers);
        }
        return ordered;
    }

    getPrimaryManager(): IntegrationManagerInstance {
        if (this.hasManager()) {
            if (this.primaryManager) return this.primaryManager;

            this.primaryManager = this.getOrderedManagers()[0];
            return this.primaryManager;
        } else {
            return null;
        }
    }

    openNoManagerDialog(): void {
        Modal.createTrackedDialog('Integrations impossible', '', IntegrationsImpossibleDialog);
    }

    openAll(room: Room = null, screen: string = null, integrationId: string = null): void {
        if (!SettingsStore.getValue("integrationProvisioning")) {
            return this.showDisabledDialog();
        }

        if (this.managers.length === 0) {
            return this.openNoManagerDialog();
        }

        Modal.createTrackedDialog(
            'Tabbed Integration Manager', '', TabbedIntegrationManagerDialog,
            {room, screen, integrationId}, 'mx_TabbedIntegrationManagerDialog',
        );
    }

    showDisabledDialog(): void {
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
    async tryDiscoverManager(domainName: string): Promise<IntegrationManagerInstance> {
        console.log("Looking up integration manager via .well-known");
        if (domainName.startsWith("http:") || domainName.startsWith("https:")) {
            // trim off the scheme and just use the domain
            domainName = url.parse(domainName).host;
        }

        let wkConfig: object;
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
        const manager = new IntegrationManagerInstance(Kind.Account, widget["data"]["api_url"], widget["url"]);
        console.log("Got an integration manager (untested)");

        // We don't test the manager because the caller may need to do extra
        // checks or similar with it. For instance, they may need to deal with
        // terms of service or want to call something particular.

        return manager;
    }
}

// For debugging
window.mxIntegrationManagers = IntegrationManagers;
