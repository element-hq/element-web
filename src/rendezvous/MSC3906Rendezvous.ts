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

import { UnstableValue } from "matrix-events-sdk";

import { RendezvousChannel, RendezvousFailureListener, RendezvousFailureReason, RendezvousIntent } from ".";
import { IMSC3882GetLoginTokenCapability, MatrixClient, UNSTABLE_MSC3882_CAPABILITY } from "../client";
import { CrossSigningInfo } from "../crypto/CrossSigning";
import { DeviceInfo } from "../crypto/deviceinfo";
import { buildFeatureSupportMap, Feature, ServerSupport } from "../feature";
import { logger } from "../logger";
import { sleep } from "../utils";

enum PayloadType {
    Start = "m.login.start",
    Finish = "m.login.finish",
    Progress = "m.login.progress",
}

enum Outcome {
    Success = "success",
    Failure = "failure",
    Verified = "verified",
    Declined = "declined",
    Unsupported = "unsupported",
}

export interface MSC3906RendezvousPayload {
    type: PayloadType;
    intent?: RendezvousIntent;
    outcome?: Outcome;
    device_id?: string;
    device_key?: string;
    verifying_device_id?: string;
    verifying_device_key?: string;
    master_key?: string;
    protocols?: string[];
    protocol?: string;
    login_token?: string;
    homeserver?: string;
}

const LOGIN_TOKEN_PROTOCOL = new UnstableValue("login_token", "org.matrix.msc3906.login_token");

/**
 * Implements MSC3906 to allow a user to sign in on a new device using QR code.
 * This implementation only supports generating a QR code on a device that is already signed in.
 * Note that this is UNSTABLE and may have breaking changes without notice.
 */
export class MSC3906Rendezvous {
    private newDeviceId?: string;
    private newDeviceKey?: string;
    private ourIntent: RendezvousIntent = RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE;
    private _code?: string;

    /**
     * @param channel - The secure channel used for communication
     * @param client - The Matrix client in used on the device already logged in
     * @param onFailure - Callback for when the rendezvous fails
     */
    public constructor(
        private channel: RendezvousChannel<MSC3906RendezvousPayload>,
        private client: MatrixClient,
        public onFailure?: RendezvousFailureListener,
    ) {}

    /**
     * Returns the code representing the rendezvous suitable for rendering in a QR code or undefined if not generated yet.
     */
    public get code(): string | undefined {
        return this._code;
    }

    /**
     * Generate the code including doing partial set up of the channel where required.
     */
    public async generateCode(): Promise<void> {
        if (this._code) {
            return;
        }

        this._code = JSON.stringify(await this.channel.generateCode(this.ourIntent));
    }

    public async startAfterShowingCode(): Promise<string | undefined> {
        const checksum = await this.channel.connect();

        logger.info(`Connected to secure channel with checksum: ${checksum} our intent is ${this.ourIntent}`);

        // in r1 of MSC3882 the availability is exposed as a capability
        const capabilities = await this.client.getCapabilities();
        // in r0 of MSC3882 the availability is exposed as a feature flag
        const features = await buildFeatureSupportMap(await this.client.getVersions());
        const capability = UNSTABLE_MSC3882_CAPABILITY.findIn<IMSC3882GetLoginTokenCapability>(capabilities);

        // determine available protocols
        if (!capability?.enabled && features.get(Feature.LoginTokenRequest) === ServerSupport.Unsupported) {
            logger.info("Server doesn't support MSC3882");
            await this.send({ type: PayloadType.Finish, outcome: Outcome.Unsupported });
            await this.cancel(RendezvousFailureReason.HomeserverLacksSupport);
            return undefined;
        }

        await this.send({ type: PayloadType.Progress, protocols: [LOGIN_TOKEN_PROTOCOL.name] });

        logger.info("Waiting for other device to chose protocol");
        const { type, protocol, outcome } = await this.receive();

        if (type === PayloadType.Finish) {
            // new device decided not to complete
            switch (outcome ?? "") {
                case "unsupported":
                    await this.cancel(RendezvousFailureReason.UnsupportedAlgorithm);
                    break;
                default:
                    await this.cancel(RendezvousFailureReason.Unknown);
            }
            return undefined;
        }

        if (type !== PayloadType.Progress) {
            await this.cancel(RendezvousFailureReason.Unknown);
            return undefined;
        }

        if (!protocol || !LOGIN_TOKEN_PROTOCOL.matches(protocol)) {
            await this.cancel(RendezvousFailureReason.UnsupportedAlgorithm);
            return undefined;
        }

        return checksum;
    }

    private async receive(): Promise<MSC3906RendezvousPayload> {
        return (await this.channel.receive()) as MSC3906RendezvousPayload;
    }

    private async send(payload: MSC3906RendezvousPayload): Promise<void> {
        await this.channel.send(payload);
    }

    public async declineLoginOnExistingDevice(): Promise<void> {
        logger.info("User declined sign in");
        await this.send({ type: PayloadType.Finish, outcome: Outcome.Declined });
    }

    public async approveLoginOnExistingDevice(loginToken: string): Promise<string | undefined> {
        // eslint-disable-next-line camelcase
        await this.send({ type: PayloadType.Progress, login_token: loginToken, homeserver: this.client.baseUrl });

        logger.info("Waiting for outcome");
        const res = await this.receive();
        if (!res) {
            return undefined;
        }
        const { outcome, device_id: deviceId, device_key: deviceKey } = res;

        if (outcome !== "success") {
            throw new Error("Linking failed");
        }

        this.newDeviceId = deviceId;
        this.newDeviceKey = deviceKey;

        return deviceId;
    }

    private async verifyAndCrossSignDevice(deviceInfo: DeviceInfo): Promise<CrossSigningInfo | DeviceInfo> {
        if (!this.client.crypto) {
            throw new Error("Crypto not available on client");
        }

        if (!this.newDeviceId) {
            throw new Error("No new device ID set");
        }

        // check that keys received from the server for the new device match those received from the device itself
        if (deviceInfo.getFingerprint() !== this.newDeviceKey) {
            throw new Error(
                `New device has different keys than expected: ${this.newDeviceKey} vs ${deviceInfo.getFingerprint()}`,
            );
        }

        const userId = this.client.getUserId();

        if (!userId) {
            throw new Error("No user ID set");
        }
        // mark the device as verified locally + cross sign
        logger.info(`Marking device ${this.newDeviceId} as verified`);
        const info = await this.client.crypto.setDeviceVerification(userId, this.newDeviceId, true, false, true);

        const masterPublicKey = this.client.crypto.crossSigningInfo.getId("master")!;

        await this.send({
            type: PayloadType.Finish,
            outcome: Outcome.Verified,
            verifying_device_id: this.client.getDeviceId()!,
            verifying_device_key: this.client.getDeviceEd25519Key()!,
            master_key: masterPublicKey,
        });

        return info;
    }

    /**
     * Verify the device and cross-sign it.
     * @param timeout - time in milliseconds to wait for device to come online
     * @returns the new device info if the device was verified
     */
    public async verifyNewDeviceOnExistingDevice(
        timeout = 10 * 1000,
    ): Promise<DeviceInfo | CrossSigningInfo | undefined> {
        if (!this.newDeviceId) {
            throw new Error("No new device to sign");
        }

        if (!this.newDeviceKey) {
            logger.info("No new device key to sign");
            return undefined;
        }

        if (!this.client.crypto) {
            throw new Error("Crypto not available on client");
        }

        const userId = this.client.getUserId();

        if (!userId) {
            throw new Error("No user ID set");
        }

        let deviceInfo = this.client.crypto.getStoredDevice(userId, this.newDeviceId);

        if (!deviceInfo) {
            logger.info("Going to wait for new device to be online");
            await sleep(timeout);
            deviceInfo = this.client.crypto.getStoredDevice(userId, this.newDeviceId);
        }

        if (deviceInfo) {
            return await this.verifyAndCrossSignDevice(deviceInfo);
        }

        throw new Error("Device not online within timeout");
    }

    public async cancel(reason: RendezvousFailureReason): Promise<void> {
        this.onFailure?.(reason);
        await this.channel.cancel(reason);
    }

    public async close(): Promise<void> {
        await this.channel.close();
    }
}
