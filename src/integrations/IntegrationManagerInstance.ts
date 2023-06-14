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

import { ComponentProps } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import type { Room } from "matrix-js-sdk/src/models/room";
import ScalarAuthClient from "../ScalarAuthClient";
import { dialogTermsInteractionCallback, TermsNotSignedError } from "../Terms";
import Modal from "../Modal";
import SettingsStore from "../settings/SettingsStore";
import IntegrationManager from "../components/views/settings/IntegrationManager";
import { IntegrationManagers } from "./IntegrationManagers";
import { parseUrl } from "../utils/UrlUtils";

export enum Kind {
    Account = "account",
    Config = "config",
    Homeserver = "homeserver",
}

export class IntegrationManagerInstance {
    // Per the spec: UI URL is optional.
    public constructor(
        public readonly kind: string,
        public readonly apiUrl: string,
        public readonly uiUrl: string = apiUrl,
        public readonly id?: string, // only applicable in some cases
    ) {}

    public get name(): string {
        const parsed = parseUrl(this.uiUrl);
        return parsed.host ?? "";
    }

    public get trimmedApiUrl(): string {
        const parsed = parseUrl(this.apiUrl);
        parsed.pathname = "";
        return parsed.toString();
    }

    public getScalarClient(): ScalarAuthClient {
        return new ScalarAuthClient(this.apiUrl, this.uiUrl);
    }

    public async open(room: Room, screen?: string, integrationId?: string): Promise<void> {
        if (!SettingsStore.getValue("integrationProvisioning")) {
            return IntegrationManagers.sharedInstance().showDisabledDialog();
        }

        const dialog = Modal.createDialog(IntegrationManager, { loading: true }, "mx_IntegrationManager");

        const client = this.getScalarClient();
        client.setTermsInteractionCallback((policyInfo, agreedUrls) => {
            // To avoid visual glitching of two modals stacking briefly, we customise the
            // terms dialog sizing when it will appear for the integration manager so that
            // it gets the same basic size as the integration manager's own modal.
            return dialogTermsInteractionCallback(policyInfo, agreedUrls, "mx_TermsDialog_forIntegrationManager");
        });

        const newProps: Partial<ComponentProps<typeof IntegrationManager>> = {};
        try {
            await client.connect();
            if (!client.hasCredentials()) {
                newProps["connected"] = false;
            } else {
                newProps["url"] = client.getScalarInterfaceUrlForRoom(room, screen, integrationId);
            }
        } catch (e) {
            if (e instanceof TermsNotSignedError) {
                dialog.close();
                return;
            }

            logger.error(e);
            newProps["connected"] = false;
        }

        // Close the old dialog and open a new one
        dialog.close();
        Modal.createDialog(IntegrationManager, newProps, "mx_IntegrationManager");
    }
}
