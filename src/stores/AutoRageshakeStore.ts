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

import { MatrixEvent } from "matrix-js-sdk/src";

import SdkConfig from '../SdkConfig';
import sendBugReport from '../rageshake/submit-rageshake';
import defaultDispatcher from '../dispatcher/dispatcher';
import { AsyncStoreWithClient } from './AsyncStoreWithClient';
import { ActionPayload } from '../dispatcher/payloads';
import SettingsStore from "../settings/SettingsStore";

// Minimum interval of 5 minutes between reports, especially important when we're doing an initial sync with a lot of decryption errors
const RAGESHAKE_INTERVAL = 5*60*1000;
// Event type for to-device messages requesting sender auto-rageshakes
const AUTO_RS_REQUEST = "im.vector.auto_rs_request";

interface IState {
    reportedSessionIds: Set<string>;
    lastRageshakeTime: number;
}

/**
 * Watches for decryption errors to auto-report if the relevant lab is
 * enabled, and keeps track of session IDs that have already been
 * reported.
 */
export default class AutoRageshakeStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new AutoRageshakeStore();

    private constructor() {
        super(defaultDispatcher, {
            reportedSessionIds: new Set<string>(),
            lastRageshakeTime: 0,
        });
        this.onDecryptionAttempt = this.onDecryptionAttempt.bind(this);
        this.onDeviceMessage = this.onDeviceMessage.bind(this);
    }

    public static get instance(): AutoRageshakeStore {
        return AutoRageshakeStore.internalInstance;
    }

    protected async onAction(payload: ActionPayload) {
        // we don't actually do anything here
    }

    protected async onReady() {
        if (!SettingsStore.getValue("automaticDecryptionErrorReporting")) return;

        if (this.matrixClient) {
            this.matrixClient.on('Event.decrypted', this.onDecryptionAttempt);
            this.matrixClient.on('toDeviceEvent', this.onDeviceMessage);
        }
    }

    protected async onNotReady() {
        if (this.matrixClient) {
            this.matrixClient.removeListener('toDeviceEvent', this.onDeviceMessage);
            this.matrixClient.removeListener('Event.decrypted', this.onDecryptionAttempt);
        }
    }

    private async onDecryptionAttempt(ev: MatrixEvent): Promise<void> {
        const wireContent = ev.getWireContent();
        const sessionId = wireContent.session_id;
        if (ev.isDecryptionFailure() && !this.state.reportedSessionIds.has(sessionId)) {
            const newReportedSessionIds = new Set(this.state.reportedSessionIds);
            await this.updateState({ reportedSessionIds: newReportedSessionIds.add(sessionId) });

            const now = new Date().getTime();
            if (now - this.state.lastRageshakeTime < RAGESHAKE_INTERVAL) { return; }

            await this.updateState({ lastRageshakeTime: now });

            const eventInfo = {
                "event_id": ev.getId(),
                "room_id": ev.getRoomId(),
                "session_id": sessionId,
                "device_id": wireContent.device_id,
                "user_id": ev.getSender(),
                "sender_key": wireContent.sender_key,
            };

            const rageshakeURL = await sendBugReport(SdkConfig.get().bug_report_endpoint_url, {
                userText: "Auto-reporting decryption error (recipient)",
                sendLogs: true,
                label: "Z-UISI",
                customFields: { "auto_uisi": JSON.stringify(eventInfo) },
            });

            const messageContent = {
                ...eventInfo,
                "recipient_rageshake": rageshakeURL,
            };
            this.matrixClient.sendToDevice(
                AUTO_RS_REQUEST,
                { [messageContent.user_id]: { [messageContent.device_id]: messageContent } },
            );
        }
    }

    private async onDeviceMessage(ev: MatrixEvent): Promise<void> {
        if (ev.getType() !== AUTO_RS_REQUEST) return;
        const messageContent = ev.getContent();
        const recipientRageshake = messageContent["recipient_rageshake"] || "";
        const now = new Date().getTime();
        if (now - this.state.lastRageshakeTime > RAGESHAKE_INTERVAL) {
            await this.updateState({ lastRageshakeTime: now });
            await sendBugReport(SdkConfig.get().bug_report_endpoint_url, {
                userText: `Auto-reporting decryption error (sender)\nRecipient rageshake: ${recipientRageshake}`,
                sendLogs: true,
                label: "Z-UISI",
                customFields: {
                    "recipient_rageshake": recipientRageshake,
                    "auto_uisi": JSON.stringify(messageContent),
                },
            });
        }
    }
}

window.mxAutoRageshakeStore = AutoRageshakeStore.instance;
