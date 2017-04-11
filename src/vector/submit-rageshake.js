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

import q from "q";
import request from "browser-request";

import PlatformPeg from 'matrix-react-sdk/lib/PlatformPeg';

import rageshake from './rageshake'

/**
 * Send a bug report.
 * @param {string} bugReportEndpoint HTTP url to send the report to
 * @param {string} userText Any additional user input.
 * @param {boolean} sendLogs True to send logs
 * @return {Promise} Resolved when the bug report is sent.
 */
export default async function sendBugReport(bugReportEndpoint, userText, sendLogs) {
    if (!bugReportEndpoint) {
        throw new Error("No bug report endpoint has been set.");
    }

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

    let logs = [];
    if (sendLogs) {
        logs = await rageshake.getLogsForReport();
    }

    await q.Promise((resolve, reject) => {
        request({
            method: "POST",
            url: bugReportEndpoint,
            body: {
                logs: logs,
                text: (
                    userText || "User did not supply any additional text."
                ),
                app: 'riot-web',
                version: version,
                user_agent: userAgent,
            },
            json: true,
            timeout: 5 * 60 * 1000,
        }, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            if (res.status < 200 || res.status >= 400) {
                reject(new Error(`HTTP ${res.status}`));
                return;
            }
            resolve();
        })
    });
}
