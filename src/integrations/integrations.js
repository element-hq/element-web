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

import sdk from "../index";
import ScalarAuthClient from '../ScalarAuthClient';
import Modal from '../Modal';
import { TermsNotSignedError, dialogTermsInteractionCallback } from '../Terms';

export async function showIntegrationsManager(opts) {
    const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");

    let props = {};
    if (ScalarAuthClient.isPossible()) {
        props.loading = true;
    } else {
        props.configured = false;
    }

    const close = Modal.createTrackedDialog(
        'Integrations Manager', '', IntegrationsManager, props, "mx_IntegrationsManager",
    ).close;

    if (!ScalarAuthClient.isPossible()) {
        return;
    }

    const scalarClient = new ScalarAuthClient();
    scalarClient.setTermsInteractionCallback(integrationsTermsInteractionCallback);
    try {
        await scalarClient.connect();
        if (!scalarClient.hasCredentials()) {
            props = { connected: false };
        } else {
            props = {
                url: scalarClient.getScalarInterfaceUrlForRoom(
                    opts.room,
                    opts.screen,
                    opts.integrationId,
                ),
            };
        }
    } catch (err) {
        if (err instanceof TermsNotSignedError) {
            // user canceled terms dialog, so just cancel the action
            close();
            return;
        }
        console.error(err);
        props = { connected: false };
    }
    close();
    Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, props, "mx_IntegrationsManager");
}

/*
 * To avoid visual glitching of two modals stacking briefly, we customise the
 * terms dialog sizing when it will appear for the integrations manager so that
 * it gets the same basic size as the IM's own modal.
 */
function integrationsTermsInteractionCallback(policiesAndServicePairs, agreedUrls) {
    return dialogTermsInteractionCallback(
        policiesAndServicePairs,
        agreedUrls,
        "mx_TermsDialog_forIntegrationsManager",
    );
}
