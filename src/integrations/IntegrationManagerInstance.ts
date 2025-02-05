/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComponentProps } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import type { Room } from "matrix-js-sdk/src/matrix";
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
