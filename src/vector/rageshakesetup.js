/*
Copyright 2018 New Vector Ltd

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

import rageshake from "matrix-react-sdk/lib/rageshake/rageshake";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";

function initRageshake() {
    rageshake.init().then(() => {
        console.log("Initialised rageshake: See https://bugs.chromium.org/p/chromium/issues/detail?id=583193 to fix line numbers on Chrome.");

        window.addEventListener('beforeunload', (e) => {
            console.log('riot-web closing');
            // try to flush the logs to indexeddb
            rageshake.flush();
        });

        rageshake.cleanup();
    }, (err) => {
        console.error("Failed to initialise rageshake: " + err);
    });
}

initRageshake();

global.mxSendRageshake = function(text, withLogs) {
    if (withLogs === undefined) withLogs = true;
    require(['matrix-react-sdk/lib/rageshake/submit-rageshake'], (s) => {
        s(SdkConfig.get().bug_report_endpoint_url, {
            userText: text,
            sendLogs: withLogs,
            progressCallback: console.log.bind(console),
        }).then(() => {
            console.log("Bug report sent!");
        }, (err) => {
            console.error(err);
        });
    });
};
