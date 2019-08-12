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

import ScalarAuthClient from "../ScalarAuthClient";
import sdk from "../index";
import {dialogTermsInteractionCallback, TermsNotSignedError} from "../Terms";
import type {Room} from "matrix-js-sdk";
import Modal from '../Modal';

export class IntegrationManagerInstance {
    apiUrl: string;
    uiUrl: string;

    constructor(apiUrl: string, uiUrl: string) {
        this.apiUrl = apiUrl;
        this.uiUrl = uiUrl;

        // Per the spec: UI URL is optional.
        if (!this.uiUrl) this.uiUrl = this.apiUrl;
    }

    getScalarClient(): ScalarAuthClient {
        return new ScalarAuthClient(this.apiUrl, this.uiUrl);
    }

    async open(room: Room = null, screen: string = null, integrationId: string = null): void {
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        const dialog = Modal.createTrackedDialog(
            'Integration Manager', '', IntegrationsManager,
            {loading: true}, 'mx_IntegrationsManager',
        );

        const client = this.getScalarClient();
        client.setTermsInteractionCallback((policyInfo, agreedUrls) => {
            // To avoid visual glitching of two modals stacking briefly, we customise the
            // terms dialog sizing when it will appear for the integrations manager so that
            // it gets the same basic size as the IM's own modal.
            return dialogTermsInteractionCallback(
                policyInfo, agreedUrls, 'mx_TermsDialog_forIntegrationsManager',
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
            'Integration Manager', '', IntegrationsManager,
            newProps, 'mx_IntegrationsManager',
        );
    }
}
