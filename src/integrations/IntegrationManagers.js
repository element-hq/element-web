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
import {IntegrationManagerInstance} from "./IntegrationManagerInstance";

export class IntegrationManagers {
    static _instance;

    static sharedInstance(): IntegrationManagers {
        if (!IntegrationManagers._instance) {
            IntegrationManagers._instance = new IntegrationManagers();
        }
        return IntegrationManagers._instance;
    }

    _managers: IntegrationManagerInstance[] = [];

    constructor() {
        this._setupConfiguredManager();
    }

    _setupConfiguredManager() {
        const apiUrl = SdkConfig.get()['integrations_rest_url'];
        const uiUrl = SdkConfig.get()['integrations_ui_url'];

        if (apiUrl && uiUrl) {
            this._managers.push(new IntegrationManagerInstance(apiUrl, uiUrl));
        }
    }

    hasManager(): boolean {
        return this._managers.length > 0;
    }

    getPrimaryManager(): IntegrationManagerInstance {
        if (this.hasManager()) {
            // TODO: TravisR - Handle custom integration managers (widgets)
            return this._managers[0];
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
}
