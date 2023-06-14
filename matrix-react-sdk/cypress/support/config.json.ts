/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

/* Intercept requests to `config.json`, so that we can test against a known configuration.
 *
 * If we don't do this, we end up testing against the Element config for develop.element.io, which then means
 * we make requests to the live `matrix.org`, which makes our tests dependent on matrix.org being up and responsive.
 */

import { isRustCryptoEnabled } from "./util";

const CONFIG_JSON = {
    // This is deliberately quite a minimal config.json, so that we can test that the default settings
    // actually work.
    //
    // The only thing that we really *need* (otherwise Element refuses to load) is a default homeserver.
    // We point that to a guaranteed-invalid domain.
    default_server_config: {
        "m.homeserver": {
            base_url: "https://server.invalid",
        },
    },

    // the location tests want a map style url.
    map_style_url: "https://api.maptiler.com/maps/streets/style.json?key=fU3vlMsMn4Jb6dnEIFsx",
};

beforeEach(() => {
    const configJson = CONFIG_JSON;

    // configure element to use rust crypto if the env var tells us so
    if (isRustCryptoEnabled()) {
        configJson["features"] = {
            feature_rust_crypto: true,
        };
    }
    cy.intercept({ method: "GET", pathname: "/config.json" }, { body: configJson });
});
