/*
Copyright 2020, 2024 The Matrix.org Foundation C.I.C.

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

import EventEmitter from "events";
import { VerificationPhase, VerificationRequest, VerificationRequestEvent } from "matrix-js-sdk/src/crypto-api";
import { IKeyBackupInfo } from "matrix-js-sdk/src/crypto/keybackup";
import { logger } from "matrix-js-sdk/src/logger";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { Device, SecretStorage } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { AccessCancelledError, accessSecretStorage } from "../SecurityManager";
import Modal from "../Modal";
import InteractiveAuthDialog from "../components/views/dialogs/InteractiveAuthDialog";
import { _t } from "../languageHandler";
import { SdkContextClass } from "../contexts/SDKContext";
import { asyncSome } from "../utils/arrays";
import { initialiseDehydration } from "../utils/device/dehydration";

export enum Phase {
    Loading = 0,
    Intro = 1,
    Busy = 2,
    Done = 3, // final done stage, but still showing UX
    ConfirmSkip = 4,
    Finished = 5, // UX can be closed
    ConfirmReset = 6,
}

export class SetupEncryptionStore extends EventEmitter {
    private started?: boolean;
    public phase?: Phase;
    public verificationRequest: VerificationRequest | null = null;
    public backupInfo: IKeyBackupInfo | null = null;
    // ID of the key that the secrets we want are encrypted with
    public keyId: string | null = null;
    // Descriptor of the key that the secrets we want are encrypted with
    public keyInfo: SecretStorage.SecretStorageKeyDescription | null = null;
    public hasDevicesToVerifyAgainst?: boolean;

    public static sharedInstance(): SetupEncryptionStore {
        if (!window.mxSetupEncryptionStore) window.mxSetupEncryptionStore = new SetupEncryptionStore();
        return window.mxSetupEncryptionStore;
    }

    public start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        this.phase = Phase.Loading;

        const cli = MatrixClientPeg.safeGet();
        cli.on(CryptoEvent.VerificationRequestReceived, this.onVerificationRequest);
        cli.on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);

        const requestsInProgress = cli.getCrypto()!.getVerificationRequestsToDeviceInProgress(cli.getUserId()!);
        if (requestsInProgress.length) {
            // If there are multiple, we take the most recent. Equally if the user sends another request from
            // another device after this screen has been shown, we'll switch to the new one, so this
            // generally doesn't support multiple requests.
            this.setActiveVerificationRequest(requestsInProgress[requestsInProgress.length - 1]);
        }

        this.fetchKeyInfo();
    }

    public stop(): void {
        if (!this.started) {
            return;
        }
        this.started = false;
        this.verificationRequest?.off(VerificationRequestEvent.Change, this.onVerificationRequestChange);

        const cli = MatrixClientPeg.get();
        if (!!cli) {
            cli.removeListener(CryptoEvent.VerificationRequestReceived, this.onVerificationRequest);
            cli.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
        }
    }

    public async fetchKeyInfo(): Promise<void> {
        if (!this.started) return; // bail if we were stopped
        const cli = MatrixClientPeg.safeGet();
        const keys = await cli.secretStorage.isStored("m.cross_signing.master");
        if (keys === null || Object.keys(keys).length === 0) {
            this.keyId = null;
            this.keyInfo = null;
        } else {
            // If the secret is stored under more than one key, we just pick an arbitrary one
            this.keyId = Object.keys(keys)[0];
            this.keyInfo = keys[this.keyId];
        }

        // do we have any other verified devices which are E2EE which we can verify against?
        const dehydratedDevice = await cli.getDehydratedDevice();
        const ownUserId = cli.getUserId()!;
        const crypto = cli.getCrypto()!;
        const userDevices: Iterable<Device> =
            (await crypto.getUserDeviceInfo([ownUserId])).get(ownUserId)?.values() ?? [];
        this.hasDevicesToVerifyAgainst = await asyncSome(userDevices, async (device) => {
            // Ignore dehydrated devices.  `dehydratedDevice` is set by the
            // implementation of MSC2697, whereas MSC3814 proposes that devices
            // should set a `dehydrated` flag in the device key.  We ignore
            // both types of dehydrated devices.
            if (dehydratedDevice && device.deviceId == dehydratedDevice?.device_id) return false;
            if (device.dehydrated) return false;

            // ignore devices without an identity key
            if (!device.getIdentityKey()) return false;

            const verificationStatus = await crypto.getDeviceVerificationStatus(ownUserId, device.deviceId);
            return !!verificationStatus?.signedByOwner;
        });

        this.phase = Phase.Intro;
        this.emit("update");
    }

    public async usePassPhrase(): Promise<void> {
        this.phase = Phase.Busy;
        this.emit("update");
        try {
            const cli = MatrixClientPeg.safeGet();
            const backupInfo = await cli.getKeyBackupVersion();
            this.backupInfo = backupInfo;
            this.emit("update");
            // The control flow is fairly twisted here...
            // For the purposes of completing security, we only wait on getting
            // as far as the trust check and then show a green shield.
            // We also begin the key backup restore as well, which we're
            // awaiting inside `accessSecretStorage` only so that it keeps your
            // passphase cached for that work. This dialog itself will only wait
            // on the first trust check, and the key backup restore will happen
            // in the background.
            await new Promise((resolve: (value?: unknown) => void, reject: (reason?: any) => void) => {
                accessSecretStorage(async (): Promise<void> => {
                    await cli.checkOwnCrossSigningTrust();

                    // The remaining tasks (device dehydration and restoring
                    // key backup) may take some time due to processing many
                    // to-device messages in the case of device dehydration, or
                    // having many keys to restore in the case of key backups,
                    // so we allow the dialog to advance before this.
                    resolve();

                    await initialiseDehydration();

                    if (backupInfo) {
                        await cli.restoreKeyBackupWithSecretStorage(backupInfo);
                    }
                }).catch(reject);
            });

            if (await cli.getCrypto()?.getCrossSigningKeyId()) {
                this.phase = Phase.Done;
                this.emit("update");
            }
        } catch (e) {
            if (!(e instanceof AccessCancelledError)) {
                logger.log(e);
            }
            // this will throw if the user hits cancel, so ignore
            this.phase = Phase.Intro;
            this.emit("update");
        }
    }

    private onUserTrustStatusChanged = async (userId: string): Promise<void> => {
        if (userId !== MatrixClientPeg.safeGet().getSafeUserId()) return;
        const publicKeysTrusted = await MatrixClientPeg.safeGet().getCrypto()?.getCrossSigningKeyId();
        if (publicKeysTrusted) {
            this.phase = Phase.Done;
            this.emit("update");
        }
    };

    public onVerificationRequest = (request: VerificationRequest): void => {
        this.setActiveVerificationRequest(request);
    };

    public onVerificationRequestChange = async (): Promise<void> => {
        if (this.verificationRequest?.phase === VerificationPhase.Cancelled) {
            this.verificationRequest.off(VerificationRequestEvent.Change, this.onVerificationRequestChange);
            this.verificationRequest = null;
            this.emit("update");
        } else if (this.verificationRequest?.phase === VerificationPhase.Done) {
            this.verificationRequest.off(VerificationRequestEvent.Change, this.onVerificationRequestChange);
            this.verificationRequest = null;
            // At this point, the verification has finished, we just need to wait for
            // cross signing to be ready to use, so wait for the user trust status to
            // change (or change to DONE if it's already ready).
            const publicKeysTrusted = await MatrixClientPeg.safeGet().getCrypto()?.getCrossSigningKeyId();
            this.phase = publicKeysTrusted ? Phase.Done : Phase.Busy;
            this.emit("update");
        }
    };

    public skip(): void {
        this.phase = Phase.ConfirmSkip;
        this.emit("update");
    }

    public skipConfirm(): void {
        this.phase = Phase.Finished;
        this.emit("update");
    }

    public returnAfterSkip(): void {
        this.phase = Phase.Intro;
        this.emit("update");
    }

    public reset(): void {
        this.phase = Phase.ConfirmReset;
        this.emit("update");
    }

    public async resetConfirm(): Promise<void> {
        try {
            // If we've gotten here, the user presumably lost their
            // secret storage key if they had one. Start by resetting
            // secret storage and setting up a new recovery key, then
            // create new cross-signing keys once that succeeds.
            await accessSecretStorage(async (): Promise<void> => {
                const cli = MatrixClientPeg.safeGet();
                await cli.getCrypto()?.bootstrapCrossSigning({
                    authUploadDeviceSigningKeys: async (makeRequest): Promise<void> => {
                        const cachedPassword = SdkContextClass.instance.accountPasswordStore.getPassword();

                        if (cachedPassword) {
                            await makeRequest({
                                type: "m.login.password",
                                identifier: {
                                    type: "m.id.user",
                                    user: cli.getSafeUserId(),
                                },
                                user: cli.getSafeUserId(),
                                password: cachedPassword,
                            });
                            return;
                        }

                        const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                            title: _t("encryption|bootstrap_title"),
                            matrixClient: cli,
                            makeRequest,
                        });
                        const [confirmed] = await finished;
                        if (!confirmed) {
                            throw new Error("Cross-signing key upload auth canceled");
                        }
                    },
                    setupNewCrossSigning: true,
                });

                await initialiseDehydration(true);

                this.phase = Phase.Finished;
            }, true);
        } catch (e) {
            logger.error("Error resetting cross-signing", e);
            this.phase = Phase.Intro;
        }
        this.emit("update");
    }

    public returnAfterReset(): void {
        this.phase = Phase.Intro;
        this.emit("update");
    }

    public done(): void {
        this.phase = Phase.Finished;
        this.emit("update");
        // async - ask other clients for keys, if necessary
        MatrixClientPeg.safeGet().crypto?.cancelAndResendAllOutgoingKeyRequests();
    }

    private async setActiveVerificationRequest(request: VerificationRequest): Promise<void> {
        if (!this.started) return; // bail if we were stopped
        if (request.otherUserId !== MatrixClientPeg.safeGet().getUserId()) return;

        if (this.verificationRequest) {
            this.verificationRequest.off(VerificationRequestEvent.Change, this.onVerificationRequestChange);
        }
        this.verificationRequest = request;
        await request.accept();
        request.on(VerificationRequestEvent.Change, this.onVerificationRequestChange);
        this.emit("update");
    }

    public lostKeys(): boolean {
        return !this.hasDevicesToVerifyAgainst && !this.keyInfo;
    }
}
