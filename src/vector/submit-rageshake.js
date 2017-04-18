/*
Copyright 2017 OpenMarket Ltd

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

import pako from 'pako';
import q from "q";

import PlatformPeg from 'matrix-react-sdk/lib/PlatformPeg';

import rageshake from './rageshake'


// polyfill textencoder if necessary
import * as TextEncodingUtf8 from 'text-encoding-utf-8';
let TextEncoder = window.TextEncoder;
if (!TextEncoder) {
    TextEncoder = TextEncodingUtf8.TextEncoder;
}

/**
 * Send a bug report.
 * @param {string} bugReportEndpoint HTTP url to send the report to
 * @param {object} opts optional dictionary of options
 * @param {string} opts.userText Any additional user input.
 * @param {boolean} opts.sendLogs True to send logs
 * @return {Promise} Resolved when the bug report is sent.
 */
export default async function sendBugReport(bugReportEndpoint, opts) {
    if (!bugReportEndpoint) {
        throw new Error("No bug report endpoint has been set.");
    }

    opts = opts || {};

    let version = "UNKNOWN";
    try {
        version = await PlatformPeg.get().getAppVersion();
    }
    catch (err) {} // PlatformPeg already logs this.

    let userAgent = "UNKNOWN";
    if (window.navigator && window.navigator.userAgent) {
        userAgent = window.navigator.userAgent;
    }

    console.log("Sending bug report.");

    const body = new FormData();
    body.append('text', opts.userText || "User did not supply any additional text.");
    body.append('app', 'riot-web');
    body.append('version', version);
    body.append('user_agent', userAgent);

    if (opts.sendLogs) {
        const logs = await rageshake.getLogsForReport();
        for (let entry of logs) {
            // encode as UTF-8
            const buf = new TextEncoder().encode(entry.lines);

            // compress
            const compressed = pako.gzip(buf);

            body.append('compressed-log', new Blob([compressed]), entry.id);
        }
    }

    await _submitReport(bugReportEndpoint, body);
}

function _submitReport(endpoint, body) {
    const deferred = q.defer();

    const req = new XMLHttpRequest();
    req.open("POST", endpoint);
    req.timeout = 5 * 60 * 1000;
    req.onreadystatechange = function() {
        if (req.readyState === XMLHttpRequest.DONE) {
            on_done();
        }
    };
    req.send(body);
    return deferred.promise;

    function on_done() {
        if (req.status < 200 || req.status >= 400) {
            deferred.reject(new Error(`HTTP ${req.status}`));
            return;
        }
        deferred.resolve();
    }
}
