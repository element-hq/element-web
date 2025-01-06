/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Separate file that sets up rageshake logging when imported.
 * This is necessary so that rageshake logging is set up before
 * anything else. Webpack puts all import statements at the top
 * of the file before any code, so imports will always be
 * evaluated first. Other imports can cause other code to be
 * evaluated (eg. the loglevel library in js-sdk, which if set
 * up before rageshake causes some js-sdk logging to be missing
 * from the rageshake.)
 */

import { logger } from "matrix-js-sdk/src/logger";

import * as rageshake from "../rageshake/rageshake";
import SdkConfig from "../SdkConfig";
import sendBugReport from "../rageshake/submit-rageshake";

export function initRageshake(): Promise<void> {
    // we manually check persistence for rageshakes ourselves
    const prom = rageshake.init(/*setUpPersistence=*/ false);
    prom.then(
        async () => {
            logger.log("Initialised rageshake.");
            logger.log(
                "To fix line numbers in Chrome: " +
                    "Meatball menu → Settings → Ignore list → Add /rageshake\\.ts & /logger\\.ts$",
            );

            window.addEventListener("beforeunload", () => {
                logger.log("element-web closing");
                // try to flush the logs to indexeddb
                rageshake.flush();
            });

            await rageshake.cleanup();
        },
        (err) => {
            logger.error("Failed to initialise rageshake: " + err);
        },
    );
    return prom;
}

export function initRageshakeStore(): Promise<void> {
    return rageshake.tryInitStorage();
}

window.mxSendRageshake = function (text: string, withLogs?: boolean): void {
    const url = SdkConfig.get().bug_report_endpoint_url;
    if (!url) {
        logger.error("Cannot send a rageshake - no bug_report_endpoint_url configured");
        return;
    }

    if (withLogs === undefined) withLogs = true;
    if (!text || !text.trim()) {
        logger.error("Cannot send a rageshake without a message - please tell us what went wrong");
        return;
    }
    sendBugReport(url, {
        userText: text,
        sendLogs: withLogs,
        progressCallback: logger.log.bind(console),
    }).then(
        () => {
            logger.log("Bug report sent!");
        },
        (err) => {
            logger.error(err);
        },
    );
};
