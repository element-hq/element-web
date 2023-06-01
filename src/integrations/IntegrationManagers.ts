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

import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, IClientWellKnown, MatrixClient } from "matrix-js-sdk/src/client";
import { compare } from "matrix-js-sdk/src/utils";

import type { MatrixEvent } from "matrix-js-sdk/src/models/event";
import SdkConfig from "../SdkConfig";
import Modal from "../Modal";
import { IntegrationManagerInstance, Kind } from "./IntegrationManagerInstance";
import IntegrationsImpossibleDialog from "../components/views/dialogs/IntegrationsImpossibleDialog";
import IntegrationsDisabledDialog from "../components/views/dialogs/IntegrationsDisabledDialog";
import WidgetUtils from "../utils/WidgetUtils";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { parseUrl } from "../utils/UrlUtils";

const KIND_PREFERENCE = [
    // Ordered: first is most preferred, last is least preferred.
    Kind.Account,
    Kind.Homeserver,
    Kind.Config,
];

export class IntegrationManagers {
    private static instance?: IntegrationManagers;

    private managers: IntegrationManagerInstance[] = [];
    private client?: MatrixClient;
    private primaryManager: IntegrationManagerInstance | null = null;

    public static sharedInstance(): IntegrationManagers {
        if (!IntegrationManagers.instance) {
            IntegrationManagers.instance = new IntegrationManagers();
        }
        return IntegrationManagers.instance;
    }

    public constructor() {
        this.compileManagers();
    }

    public startWatching(): void {
        this.stopWatching();
        this.client = MatrixClientPeg.get();
        this.client.on(ClientEvent.AccountData, this.onAccountData);
        this.client.on(ClientEvent.ClientWellKnown, this.setupHomeserverManagers);
        this.compileManagers();
    }

    public stopWatching(): void {
        if (!this.client) return;
        this.client.removeListener(ClientEvent.AccountData, this.onAccountData);
        this.client.removeListener(ClientEvent.ClientWellKnown, this.setupHomeserverManagers);
    }

    private compileManagers(): void {
        this.managers = [];
        this.setupConfiguredManager();
        this.setupAccountManagers();
    }

    private setupConfiguredManager(): void {
        const apiUrl = SdkConfig.get("integrations_rest_url");
        const uiUrl = SdkConfig.get("integrations_ui_url");

        if (apiUrl && uiUrl) {
            this.managers.push(new IntegrationManagerInstance(Kind.Config, apiUrl, uiUrl));
            this.primaryManager = null; // reset primary
        }
    }

    private setupHomeserverManagers = async (discoveryResponse: IClientWellKnown): Promise<void> => {
        logger.log("Updating homeserver-configured integration managers...");
        if (discoveryResponse && discoveryResponse["m.integrations"]) {
            let managers = discoveryResponse["m.integrations"]["managers"];
            if (!Array.isArray(managers)) managers = []; // make it an array so we can wipe the HS managers

            logger.log(`Homeserver has ${managers.length} integration managers`);

            // Clear out any known managers for the homeserver
            // TODO: Log out of the scalar clients
            this.managers = this.managers.filter((m) => m.kind !== Kind.Homeserver);

            // Now add all the managers the homeserver wants us to have
            for (const hsManager of managers) {
                if (!hsManager["api_url"]) continue;
                this.managers.push(
                    new IntegrationManagerInstance(
                        Kind.Homeserver,
                        hsManager["api_url"],
                        hsManager["ui_url"], // optional
                    ),
                );
            }

            this.primaryManager = null; // reset primary
        } else {
            logger.log("Homeserver has no integration managers");
        }
    };

    private setupAccountManagers(): void {
        if (!this.client || !this.client.getUserId()) return; // not logged in
        const widgets = WidgetUtils.getIntegrationManagerWidgets(this.client);
        widgets.forEach((w) => {
            const data = w.content["data"];
            if (!data) return;

            const uiUrl = w.content["url"];
            const apiUrl = data["api_url"] as string;
            if (!apiUrl || !uiUrl) return;

            const manager = new IntegrationManagerInstance(
                Kind.Account,
                apiUrl,
                uiUrl,
                w["id"] || w["state_key"] || "",
            );
            this.managers.push(manager);
        });
        this.primaryManager = null; // reset primary
    }

    private onAccountData = (ev: MatrixEvent): void => {
        if (ev.getType() === "m.widgets") {
            this.compileManagers();
        }
    };

    public hasManager(): boolean {
        return this.managers.length > 0;
    }

    public getOrderedManagers(): IntegrationManagerInstance[] {
        const ordered: IntegrationManagerInstance[] = [];
        for (const kind of KIND_PREFERENCE) {
            const managers = this.managers.filter((m) => m.kind === kind);
            if (!managers || !managers.length) continue;

            if (kind === Kind.Account) {
                // Order by state_keys (IDs)
                managers.sort((a, b) => compare(a.id ?? "", b.id ?? ""));
            }

            ordered.push(...managers);
        }
        return ordered;
    }

    public getPrimaryManager(): IntegrationManagerInstance | null {
        if (this.hasManager()) {
            if (this.primaryManager) return this.primaryManager;

            this.primaryManager = this.getOrderedManagers()[0];
            return this.primaryManager;
        } else {
            return null;
        }
    }

    public openNoManagerDialog(): void {
        Modal.createDialog(IntegrationsImpossibleDialog);
    }

    public showDisabledDialog(): void {
        Modal.createDialog(IntegrationsDisabledDialog);
    }

    /**
     * Attempts to discover an integration manager using only its name. This will not validate that
     * the integration manager is functional - that is the caller's responsibility.
     * @param {string} domainName The domain name to look up.
     * @returns {Promise<IntegrationManagerInstance>} Resolves to an integration manager instance,
     * or null if none was found.
     */
    public async tryDiscoverManager(domainName: string): Promise<IntegrationManagerInstance | null> {
        logger.log("Looking up integration manager via .well-known");
        if (domainName.startsWith("http:") || domainName.startsWith("https:")) {
            // trim off the scheme and just use the domain
            domainName = parseUrl(domainName).host;
        }

        let wkConfig: IClientWellKnown;
        try {
            const result = await fetch(`https://${domainName}/.well-known/matrix/integrations`);
            wkConfig = await result.json();
        } catch (e) {
            logger.error(e);
            logger.warn("Failed to locate integration manager");
            return null;
        }

        if (!wkConfig || !wkConfig["m.integrations_widget"]) {
            logger.warn("Missing integrations widget on .well-known response");
            return null;
        }

        const widget = wkConfig["m.integrations_widget"];
        if (!widget["url"] || !widget["data"] || !widget["data"]["api_url"]) {
            logger.warn("Malformed .well-known response for integrations widget");
            return null;
        }

        // All discovered managers are per-user managers
        const manager = new IntegrationManagerInstance(Kind.Account, widget["data"]["api_url"], widget["url"]);
        logger.log("Got an integration manager (untested)");

        // We don't test the manager because the caller may need to do extra
        // checks or similar with it. For instance, they may need to deal with
        // terms of service or want to call something particular.

        return manager;
    }
}

// For debugging
window.mxIntegrationManagers = IntegrationManagers;
