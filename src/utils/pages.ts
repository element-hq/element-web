/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { IConfigOptions } from "../IConfigOptions";
import { getEmbeddedPagesWellKnown } from "../utils/WellKnownUtils";
import { SnakedObject } from "./SnakedObject";

export function getHomePageUrl(appConfig: IConfigOptions, matrixClient: MatrixClient): string | undefined {
    const config = new SnakedObject(appConfig);

    const pagesConfig = config.get("embedded_pages");
    let pageUrl = pagesConfig ? new SnakedObject(pagesConfig).get("home_url") : null;

    if (!pageUrl) {
        // This is a deprecated config option for the home page
        // (despite the name, given we also now have a welcome
        // page, which is not the same).
        pageUrl = (<any>appConfig).welcomePageUrl;
        if (pageUrl) {
            logger.warn(
                "You are using a deprecated config option: `welcomePageUrl`. Please use " +
                    "`embedded_pages.home_url` instead, per https://github.com/vector-im/element-web/issues/21428",
            );
        }
    }

    if (!pageUrl) {
        pageUrl = getEmbeddedPagesWellKnown(matrixClient)?.home_url;
    }

    return pageUrl;
}

export function shouldUseLoginForWelcome(appConfig: IConfigOptions): boolean {
    const config = new SnakedObject(appConfig);
    const pagesConfig = config.get("embedded_pages");
    return pagesConfig ? new SnakedObject(pagesConfig).get("login_for_welcome") === true : false;
}
