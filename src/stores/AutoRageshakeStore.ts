/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    ClientEvent,
    type MatrixEvent,
    MatrixEventEvent,
    type SyncStateData,
    type SyncState,
    ToDeviceMessageId,
} from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { v4 as uuidv4 } from "uuid";
import { logger } from "matrix-js-sdk/src/logger";

import SdkConfig from "../SdkConfig";
import sendBugReport from "../rageshake/submit-rageshake";
import defaultDispatcher from "../dispatcher/dispatcher";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import { type ActionPayload } from "../dispatcher/payloads";
import SettingsStore from "../settings/SettingsStore";
import { Action } from "../dispatcher/actions";

// Minimum interval of 1 minute between reports
const RAGESHAKE_INTERVAL = 60000;
// Before rageshaking, wait 5 seconds and see if the message has successfully decrypted
const GRACE_PERIOD = 5000;
// Event type for to-device messages requesting sender auto-rageshakes
const AUTO_RS_REQUEST = "im.vector.auto_rs_request";

interface IState {
    reportedSessionIds: Set<string>;
    lastRageshakeTime: number;
    initialSyncCompleted: boolean;
}

/**
 * Watches for decryption errors to auto-report if the relevant lab is
 * enabled, and keeps track of session IDs that have already been
 * reported.
 */
export default class AutoRageshakeStore extends AsyncStoreWithClient<IState> {
    private static readonly internalInstance = (() => {
        const instance = new AutoRageshakeStore();
        instance.start();
        return instance;
    })();

    private constructor() {
        super(defaultDispatcher, {
            reportedSessionIds: new Set<string>(),
            lastRageshakeTime: 0,
            initialSyncCompleted: false,
        });
        this.onDecryptionAttempt = this.onDecryptionAttempt.bind(this);
        this.onDeviceMessage = this.onDeviceMessage.bind(this);
        this.onSyncStateChange = this.onSyncStateChange.bind(this);
    }

    public static get instance(): AutoRageshakeStore {
        return AutoRageshakeStore.internalInstance;
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        switch (payload.action) {
            case Action.ReportKeyBackupNotEnabled:
                this.onReportKeyBackupNotEnabled();
        }
    }

    protected async onReady(): Promise<void> {
        if (!SettingsStore.getValue("automaticDecryptionErrorReporting")) return;

        if (this.matrixClient) {
            this.matrixClient.on(MatrixEventEvent.Decrypted, this.onDecryptionAttempt);
            this.matrixClient.on(ClientEvent.ToDeviceEvent, this.onDeviceMessage);
            this.matrixClient.on(ClientEvent.Sync, this.onSyncStateChange);
        }
    }

    protected async onNotReady(): Promise<void> {
        if (this.matrixClient) {
            this.matrixClient.removeListener(ClientEvent.ToDeviceEvent, this.onDeviceMessage);
            this.matrixClient.removeListener(MatrixEventEvent.Decrypted, this.onDecryptionAttempt);
            this.matrixClient.removeListener(ClientEvent.Sync, this.onSyncStateChange);
        }
    }

    private async onDecryptionAttempt(ev: MatrixEvent): Promise<void> {
        if (!this.state.initialSyncCompleted) {
            return;
        }

        const wireContent = ev.getWireContent();
        const sessionId = wireContent.session_id;
        if (ev.isDecryptionFailure() && !this.state.reportedSessionIds.has(sessionId)) {
            await sleep(GRACE_PERIOD);
            if (!ev.isDecryptionFailure()) {
                return;
            }

            const newReportedSessionIds = new Set(this.state.reportedSessionIds);
            await this.updateState({ reportedSessionIds: newReportedSessionIds.add(sessionId) });

            const now = new Date().getTime();
            if (now - this.state.lastRageshakeTime < RAGESHAKE_INTERVAL) {
                logger.info(
                    `Not sending recipient-side autorageshake for event ${ev.getId()}/session ${sessionId}: last rageshake was too recent`,
                );
                return;
            }

            await this.updateState({ lastRageshakeTime: now });

            const senderUserId = ev.getSender()!;
            const eventInfo = {
                event_id: ev.getId(),
                room_id: ev.getRoomId(),
                session_id: sessionId,
                device_id: wireContent.device_id,
                user_id: senderUserId,
                sender_key: wireContent.sender_key,
            };

            logger.info(`Sending recipient-side autorageshake for event ${ev.getId()}/session ${sessionId}`);
            // XXX: the rageshake server returns the URL for the github issue... which is typically absent for
            //   auto-uisis, because we've disabled creation of GH issues for them. So the `recipient_rageshake`
            //   field is broken.
            const rageshakeURL = await sendBugReport(SdkConfig.get().bug_report_endpoint_url, {
                userText: "Auto-reporting decryption error (recipient)",
                sendLogs: true,
                labels: ["Z-UISI", "web", "uisi-recipient"],
                customApp: SdkConfig.get().uisi_autorageshake_app,
                customFields: { auto_uisi: JSON.stringify(eventInfo) },
            });

            const messageContent = {
                ...eventInfo,
                recipient_rageshake: rageshakeURL,
                [ToDeviceMessageId]: uuidv4(),
            };
            this.matrixClient?.sendToDevice(
                AUTO_RS_REQUEST,
                new Map([[senderUserId, new Map([[messageContent.device_id, messageContent]])]]),
            );
        }
    }

    private async onSyncStateChange(
        _state: SyncState,
        _prevState: SyncState | null,
        data?: SyncStateData,
    ): Promise<void> {
        if (!this.state.initialSyncCompleted) {
            await this.updateState({ initialSyncCompleted: !!data?.nextSyncToken });
        }
    }

    private async onDeviceMessage(ev: MatrixEvent): Promise<void> {
        if (ev.getType() !== AUTO_RS_REQUEST) return;
        const messageContent = ev.getContent();
        const recipientRageshake = messageContent["recipient_rageshake"] || "";
        const now = new Date().getTime();
        if (now - this.state.lastRageshakeTime > RAGESHAKE_INTERVAL) {
            await this.updateState({ lastRageshakeTime: now });
            logger.info(
                `Sending sender-side autorageshake for event ${messageContent["event_id"]}/session ${messageContent["session_id"]}`,
            );
            await sendBugReport(SdkConfig.get().bug_report_endpoint_url, {
                userText: `Auto-reporting decryption error (sender)\nRecipient rageshake: ${recipientRageshake}`,
                sendLogs: true,
                labels: ["Z-UISI", "web", "uisi-sender"],
                customApp: SdkConfig.get().uisi_autorageshake_app,
                customFields: {
                    recipient_rageshake: recipientRageshake,
                    auto_uisi: JSON.stringify(messageContent),
                },
            });
        } else {
            logger.info(
                `Not sending sender-side autorageshake for event ${messageContent["event_id"]}/session ${messageContent["session_id"]}: last rageshake was too recent`,
            );
        }
    }

    private async onReportKeyBackupNotEnabled(): Promise<void> {
        if (!SettingsStore.getValue("automaticKeyBackNotEnabledReporting")) return;

        await sendBugReport(SdkConfig.get().bug_report_endpoint_url, {
            userText: `Auto-reporting key backup not enabled`,
            sendLogs: true,
            labels: ["web", Action.ReportKeyBackupNotEnabled],
        });
    }
}

window.mxAutoRageshakeStore = AutoRageshakeStore.instance;
