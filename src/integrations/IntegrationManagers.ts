/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, type IClientWellKnown, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../SdkConfig";
import Modal from "../Modal";
import { IntegrationManagerInstance, Kind } from "./IntegrationManagerInstance";
import IntegrationsImpossibleDialog from "../components/views/dialogs/IntegrationsImpossibleDialog";
import IntegrationsDisabledDialog from "../components/views/dialogs/IntegrationsDisabledDialog";
import WidgetUtils from "../utils/WidgetUtils";
import { MatrixClientPeg } from "../MatrixClientPeg";

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
        this.client = MatrixClientPeg.safeGet();
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
        const collator = new Intl.Collator();
        const ordered: IntegrationManagerInstance[] = [];
        for (const kind of KIND_PREFERENCE) {
            const managers = this.managers.filter((m) => m.kind === kind);
            if (!managers || !managers.length) continue;

            if (kind === Kind.Account) {
                // Order by state_keys (IDs)
                managers.sort((a, b) => collator.compare(a.id ?? "", b.id ?? ""));
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
}

// For debugging
window.mxIntegrationManagers = IntegrationManagers;
