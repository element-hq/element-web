/*
Copyright 2025-2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { type LogSpan } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import type DeviceListener from "./DeviceListener";
import { getUserDeviceIds } from "../utils/crypto/deviceInfo";
import { isBulkUnverifiedDeviceReminderSnoozed } from "../utils/device/snoozeBulkUnverifiedDeviceReminder";
import {
    hideToast as hideBulkUnverifiedSessionsToast,
    showToast as showBulkUnverifiedSessionsToast,
} from "../toasts/BulkUnverifiedSessionsToast";
import {
    hideToast as hideUnverifiedSessionToast,
    showToast as showUnverifiedSessionToast,
} from "../toasts/UnverifiedSessionToast";

export default class DeviceListenerOtherDevices {
    /**
     * The DeviceListener launching this instance.
     */
    private deviceListener: DeviceListener;

    /**
     * The Matrix client in use by the current user.
     */
    private client: MatrixClient;

    /**
     * Device IDs for which the user has dismissed the verify toast ('Later').
     */
    private dismissed = new Set<string>();

    /**
     * A list of our own device IDs so we can batch ones that were already
     * there the last time the app launched into a single toast, but display new
     * ones in their own toasts.
     */
    private ourDeviceIdsAtStart: Set<string> | null = null;

    /**
     * The set of device IDs we're currently displaying toasts for.
     */
    private displayingToastsForDeviceIds = new Set<string>();

    /**
     * Start tracking other devices and call `recheck()` on the supplied
     * DeviceListener when something changes.
     */
    public constructor(deviceListener: DeviceListener, client: MatrixClient) {
        this.deviceListener = deviceListener;
        this.client = client;

        this.client.on(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
    }

    /**
     * Stop tracking other devices and clear our stored information.
     */
    public stop(): void {
        this.dismissed.clear();
        this.ourDeviceIdsAtStart = null;
        this.displayingToastsForDeviceIds = new Set();

        this.client.removeListener(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
    }

    /**
     * Dismiss notifications about our own unverified devices.
     *
     * @param {String[]} deviceIds List of device IDs to dismiss notifications for
     */
    public dismissUnverifiedSessions(deviceIds: Iterable<string>): void {
        for (const d of deviceIds) {
            this.dismissed.add(d);
        }

        // TODO: maybe we don't need a full DeviceListener check? (Maybe we only
        // need to call this.recheck().)
        this.deviceListener.recheck();
    }

    /**
     * Get the device list for the current user.
     *
     * @returns the set of device IDs
     */
    private async getDeviceIds(): Promise<Set<string>> {
        return await getUserDeviceIds(this.client, this.client.getSafeUserId());
    }

    /**
     */
    private async ensureDeviceIdsAtStartPopulated(): Promise<void> {
        if (this.ourDeviceIdsAtStart === null) {
            this.ourDeviceIdsAtStart = await this.getDeviceIds();
        }
    }

    /**
     * Called when the user's devices are updated. Refreshes the device
     * information and then rechecks whether we need to display any toasts.
     */
    private onDevicesUpdated = async (users: string[], initialFetch?: boolean): Promise<void> => {
        // If we didn't know about *any* devices before (ie. it's fresh login),
        // then they are all pre-existing devices, so ignore this and set the
        // devicesAtStart list to the devices that we see after the fetch.
        if (initialFetch) return;

        const myUserId = this.client.getSafeUserId();
        if (users.includes(myUserId)) await this.ensureDeviceIdsAtStartPopulated();

        // TODO: maybe we don't need a full DeviceListener check? (Maybe we only
        // need to call this.recheck().)
        this.deviceListener.recheck();
    };

    /**
     * Display a toast if some new other device is unverified, or if we started
     * up and some unverified devices have appeared.
     */
    public async recheck(logSpan: LogSpan): Promise<void> {
        const crypto = this.client.getCrypto();
        if (!crypto) {
            return;
        }

        const userId = this.client.getSafeUserId();

        const crossSigningReady = await crypto.isCrossSigningReady();

        const isCurrentDeviceTrusted = Boolean(
            (await crypto.getDeviceVerificationStatus(userId, this.client.deviceId!))?.crossSigningVerified,
        );

        // This needs to be done after awaiting on getUserDeviceInfo() above, so
        // we make sure we get the devices after the fetch is done.
        await this.ensureDeviceIdsAtStartPopulated();

        // Unverified devices that were there last time the app ran
        // (technically could just be a boolean: we don't actually
        // need to remember the device IDs, but for the sake of
        // symmetry...).
        const oldUnverifiedDeviceIds = new Set<string>();
        // Unverified devices that have appeared since then
        const newUnverifiedDeviceIds = new Set<string>();

        // as long as cross-signing isn't ready,
        // you can't see or dismiss any device toasts
        if (crossSigningReady) {
            const devices = await this.getDeviceIds();
            for (const deviceId of devices) {
                if (deviceId === this.client.deviceId) continue;

                const deviceTrust = await crypto.getDeviceVerificationStatus(userId, deviceId);
                if (!deviceTrust?.crossSigningVerified && !this.dismissed.has(deviceId)) {
                    if (this.ourDeviceIdsAtStart?.has(deviceId)) {
                        oldUnverifiedDeviceIds.add(deviceId);
                    } else {
                        newUnverifiedDeviceIds.add(deviceId);
                    }
                }
            }
        }

        logSpan.debug("Old unverified sessions: " + Array.from(oldUnverifiedDeviceIds).join(","));
        logSpan.debug("New unverified sessions: " + Array.from(newUnverifiedDeviceIds).join(","));
        logSpan.debug("Currently showing toasts for: " + Array.from(this.displayingToastsForDeviceIds).join(","));

        const isBulkUnverifiedSessionsReminderSnoozed = isBulkUnverifiedDeviceReminderSnoozed();

        // Display or hide the batch toast for old unverified sessions
        // don't show the toast if the current device is unverified
        if (oldUnverifiedDeviceIds.size > 0 && isCurrentDeviceTrusted && !isBulkUnverifiedSessionsReminderSnoozed) {
            showBulkUnverifiedSessionsToast(oldUnverifiedDeviceIds);
        } else {
            hideBulkUnverifiedSessionsToast();
        }

        // Show toasts for new unverified devices if they aren't already there
        for (const deviceId of newUnverifiedDeviceIds) {
            showUnverifiedSessionToast(deviceId);
        }

        // ...and hide any we don't need any more
        for (const deviceId of this.displayingToastsForDeviceIds) {
            if (!newUnverifiedDeviceIds.has(deviceId)) {
                logSpan.debug("Hiding unverified session toast for " + deviceId);
                hideUnverifiedSessionToast(deviceId);
            }
        }

        this.displayingToastsForDeviceIds = newUnverifiedDeviceIds;
    }
}
