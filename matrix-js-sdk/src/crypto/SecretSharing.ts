/*
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

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
import { v4 as uuidv4 } from "uuid";

import { MatrixClient } from "../client";
import { ICryptoCallbacks, IEncryptedContent } from "./index";
import { defer, IDeferred } from "../utils";
import { ToDeviceMessageId } from "../@types/event";
import { logger } from "../logger";
import { MatrixEvent } from "../models/event";
import * as olmlib from "./olmlib";

export interface ISecretRequest {
    requestId: string;
    promise: Promise<string>;
    cancel: (reason: string) => void;
}

interface ISecretRequestInternal {
    name: string;
    devices: string[];
    deferred: IDeferred<string>;
}

export class SecretSharing {
    private requests = new Map<string, ISecretRequestInternal>();

    public constructor(private readonly baseApis: MatrixClient, private readonly cryptoCallbacks: ICryptoCallbacks) {}

    /**
     * Request a secret from another device
     *
     * @param name - the name of the secret to request
     * @param devices - the devices to request the secret from
     */
    public request(name: string, devices: string[]): ISecretRequest {
        const requestId = this.baseApis.makeTxnId();

        const deferred = defer<string>();
        this.requests.set(requestId, { name, devices, deferred });

        const cancel = (reason: string): void => {
            // send cancellation event
            const cancelData = {
                action: "request_cancellation",
                requesting_device_id: this.baseApis.deviceId,
                request_id: requestId,
            };
            const toDevice: Map<string, typeof cancelData> = new Map();
            for (const device of devices) {
                toDevice.set(device, cancelData);
            }
            this.baseApis.sendToDevice("m.secret.request", new Map([[this.baseApis.getUserId()!, toDevice]]));

            // and reject the promise so that anyone waiting on it will be
            // notified
            deferred.reject(new Error(reason || "Cancelled"));
        };

        // send request to devices
        const requestData = {
            name,
            action: "request",
            requesting_device_id: this.baseApis.deviceId,
            request_id: requestId,
            [ToDeviceMessageId]: uuidv4(),
        };
        const toDevice: Map<string, typeof requestData> = new Map();
        for (const device of devices) {
            toDevice.set(device, requestData);
        }
        logger.info(`Request secret ${name} from ${devices}, id ${requestId}`);
        this.baseApis.sendToDevice("m.secret.request", new Map([[this.baseApis.getUserId()!, toDevice]]));

        return {
            requestId,
            promise: deferred.promise,
            cancel,
        };
    }

    public async onRequestReceived(event: MatrixEvent): Promise<void> {
        const sender = event.getSender();
        const content = event.getContent();
        if (
            sender !== this.baseApis.getUserId() ||
            !(content.name && content.action && content.requesting_device_id && content.request_id)
        ) {
            // ignore requests from anyone else, for now
            return;
        }
        const deviceId = content.requesting_device_id;
        // check if it's a cancel
        if (content.action === "request_cancellation") {
            /*
            Looks like we intended to emit events when we got cancelations, but
            we never put anything in the _incomingRequests object, and the request
            itself doesn't use events anyway so if we were to wire up cancellations,
            they probably ought to use the same callback interface. I'm leaving them
            disabled for now while converting this file to typescript.
            if (this._incomingRequests[deviceId]
                && this._incomingRequests[deviceId][content.request_id]) {
                logger.info(
                    "received request cancellation for secret (" + sender +
                    ", " + deviceId + ", " + content.request_id + ")",
                );
                this.baseApis.emit("crypto.secrets.requestCancelled", {
                    user_id: sender,
                    device_id: deviceId,
                    request_id: content.request_id,
                });
            }
            */
        } else if (content.action === "request") {
            if (deviceId === this.baseApis.deviceId) {
                // no point in trying to send ourself the secret
                return;
            }

            // check if we have the secret
            logger.info("received request for secret (" + sender + ", " + deviceId + ", " + content.request_id + ")");
            if (!this.cryptoCallbacks.onSecretRequested) {
                return;
            }
            const secret = await this.cryptoCallbacks.onSecretRequested(
                sender,
                deviceId,
                content.request_id,
                content.name,
                this.baseApis.checkDeviceTrust(sender, deviceId),
            );
            if (secret) {
                logger.info(`Preparing ${content.name} secret for ${deviceId}`);
                const payload = {
                    type: "m.secret.send",
                    content: {
                        request_id: content.request_id,
                        secret: secret,
                    },
                };
                const encryptedContent: IEncryptedContent = {
                    algorithm: olmlib.OLM_ALGORITHM,
                    sender_key: this.baseApis.crypto!.olmDevice.deviceCurve25519Key!,
                    ciphertext: {},
                    [ToDeviceMessageId]: uuidv4(),
                };
                await olmlib.ensureOlmSessionsForDevices(
                    this.baseApis.crypto!.olmDevice,
                    this.baseApis,
                    new Map([[sender, [this.baseApis.getStoredDevice(sender, deviceId)!]]]),
                );
                await olmlib.encryptMessageForDevice(
                    encryptedContent.ciphertext,
                    this.baseApis.getUserId()!,
                    this.baseApis.deviceId!,
                    this.baseApis.crypto!.olmDevice,
                    sender,
                    this.baseApis.getStoredDevice(sender, deviceId)!,
                    payload,
                );
                const contentMap = new Map([[sender, new Map([[deviceId, encryptedContent]])]]);

                logger.info(`Sending ${content.name} secret for ${deviceId}`);
                this.baseApis.sendToDevice("m.room.encrypted", contentMap);
            } else {
                logger.info(`Request denied for ${content.name} secret for ${deviceId}`);
            }
        }
    }

    public onSecretReceived(event: MatrixEvent): void {
        if (event.getSender() !== this.baseApis.getUserId()) {
            // we shouldn't be receiving secrets from anyone else, so ignore
            // because someone could be trying to send us bogus data
            return;
        }

        if (!olmlib.isOlmEncrypted(event)) {
            logger.error("secret event not properly encrypted");
            return;
        }

        const content = event.getContent();

        const senderKeyUser = this.baseApis.crypto!.deviceList.getUserByIdentityKey(
            olmlib.OLM_ALGORITHM,
            event.getSenderKey() || "",
        );
        if (senderKeyUser !== event.getSender()) {
            logger.error("sending device does not belong to the user it claims to be from");
            return;
        }

        logger.log("got secret share for request", content.request_id);
        const requestControl = this.requests.get(content.request_id);
        if (requestControl) {
            // make sure that the device that sent it is one of the devices that
            // we requested from
            const deviceInfo = this.baseApis.crypto!.deviceList.getDeviceByIdentityKey(
                olmlib.OLM_ALGORITHM,
                event.getSenderKey()!,
            );
            if (!deviceInfo) {
                logger.log("secret share from unknown device with key", event.getSenderKey());
                return;
            }
            if (!requestControl.devices.includes(deviceInfo.deviceId)) {
                logger.log("unsolicited secret share from device", deviceInfo.deviceId);
                return;
            }
            // unsure that the sender is trusted.  In theory, this check is
            // unnecessary since we only accept secret shares from devices that
            // we requested from, but it doesn't hurt.
            const deviceTrust = this.baseApis.crypto!.checkDeviceInfoTrust(event.getSender()!, deviceInfo);
            if (!deviceTrust.isVerified()) {
                logger.log("secret share from unverified device");
                return;
            }

            logger.log(`Successfully received secret ${requestControl.name} ` + `from ${deviceInfo.deviceId}`);
            requestControl.deferred.resolve(content.secret);
        }
    }
}
