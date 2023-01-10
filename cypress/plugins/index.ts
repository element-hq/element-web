/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

/// <reference types="cypress" />

import PluginEvents = Cypress.PluginEvents;
import PluginConfigOptions = Cypress.PluginConfigOptions;
import { synapseDocker } from "./synapsedocker";
import { dendriteDocker } from "./dendritedocker";
import { slidingSyncProxyDocker } from "./sliding-sync";
import { webserver } from "./webserver";
import { docker } from "./docker";
import { log } from "./log";

/**
 * @type {Cypress.PluginConfig}
 */
export default function (on: PluginEvents, config: PluginConfigOptions) {
    docker(on, config);
    synapseDocker(on, config);
    dendriteDocker(on, config);
    slidingSyncProxyDocker(on, config);
    webserver(on, config);
    log(on, config);
}
