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

import type {Room} from "matrix-js-sdk/src/models/room";

import ScalarAuthClient from "../ScalarAuthClient";
import {dialogTermsInteractionCallback, TermsNotSignedError} from "../Terms";
import Modal from '../Modal';
import url from 'url';
import SettingsStore from "../settings/SettingsStore";
import IntegrationManager from "../components/views/settings/IntegrationManager";
import {IntegrationManagers} from "./IntegrationManagers";

export enum Kind {
    Account = "account",
    Config = "config",
    Homeserver = "homeserver",
}

export class IntegrationManagerInstance {
    public readonly apiUrl: string;
    public readonly uiUrl: string;
    public readonly kind: string;
    public readonly id: string; // only applicable in some cases

    // Per the spec: UI URL is optional.
    constructor(kind: string, apiUrl: string, uiUrl: string = apiUrl, id?: string) {
        this.kind = kind;
        this.apiUrl = apiUrl;
        this.uiUrl = uiUrl;
        this.id = id;
    }

    get name(): string {
        const parsed = url.parse(this.uiUrl);
        return parsed.host;
    }

    get trimmedApiUrl(): string {
        const parsed = url.parse(this.apiUrl);
        parsed.pathname = '';
        parsed.path = '';
        return url.format(parsed);
    }

    getScalarClient(): ScalarAuthClient {
        return new ScalarAuthClient(this.apiUrl, this.uiUrl);
    }

    async open(room: Room = null, screen: string = null, integrationId: string = null): Promise<void> {
        if (!SettingsStore.getValue("integrationProvisioning")) {
            return IntegrationManagers.sharedInstance().showDisabledDialog();
        }

        const dialog = Modal.createTrackedDialog(
            'Integration Manager', '', IntegrationManager,
            {loading: true}, 'mx_IntegrationManager',
        );

        const client = this.getScalarClient();
        client.setTermsInteractionCallback((policyInfo, agreedUrls) => {
            // To avoid visual glitching of two modals stacking briefly, we customise the
            // terms dialog sizing when it will appear for the integration manager so that
            // it gets the same basic size as the IM's own modal.
            return dialogTermsInteractionCallback(
                policyInfo, agreedUrls, 'mx_TermsDialog_forIntegrationManager',
            );
        });

        const newProps = {};
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

            console.error(e);
            newProps["connected"] = false;
        }

        // Close the old dialog and open a new one
        dialog.close();
        Modal.createTrackedDialog(
            'Integration Manager', '', IntegrationManager,
            newProps, 'mx_IntegrationManager',
        );
    }
}
