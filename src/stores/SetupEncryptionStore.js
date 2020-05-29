/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import EventEmitter from 'events';
import { MatrixClientPeg } from '../MatrixClientPeg';
import { accessSecretStorage, AccessCancelledError } from '../CrossSigningManager';
import { PHASE_DONE as VERIF_PHASE_DONE } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";

export const PHASE_INTRO = 0;
export const PHASE_BUSY = 1;
export const PHASE_DONE = 2;    //final done stage, but still showing UX
export const PHASE_CONFIRM_SKIP = 3;
export const PHASE_FINISHED = 4; //UX can be closed

export class SetupEncryptionStore extends EventEmitter {
    static sharedInstance() {
        if (!global.mx_SetupEncryptionStore) global.mx_SetupEncryptionStore = new SetupEncryptionStore();
        return global.mx_SetupEncryptionStore;
    }

    start() {
        if (this._started) {
            return;
        }
        this._started = true;
        this.phase = PHASE_INTRO;
        this.verificationRequest = null;
        this.backupInfo = null;
        MatrixClientPeg.get().on("crypto.verification.request", this.onVerificationRequest);
        MatrixClientPeg.get().on('userTrustStatusChanged', this._onUserTrustStatusChanged);
    }

    stop() {
        if (!this._started) {
            return;
        }
        this._started = false;
        if (this.verificationRequest) {
            this.verificationRequest.off("change", this.onVerificationRequestChange);
        }
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("crypto.verification.request", this.onVerificationRequest);
            MatrixClientPeg.get().removeListener('userTrustStatusChanged', this._onUserTrustStatusChanged);
        }
    }

    async usePassPhrase() {
        this.phase = PHASE_BUSY;
        this.emit("update");
        const cli = MatrixClientPeg.get();
        try {
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
            await new Promise((resolve, reject) => {
                try {
                    accessSecretStorage(async () => {
                        await cli.checkOwnCrossSigningTrust();
                        resolve();
                        if (backupInfo) {
                            // A complete restore can take many minutes for large
                            // accounts / slow servers, so we allow the dialog
                            // to advance before this.
                            await cli.restoreKeyBackupWithSecretStorage(backupInfo);
                        }
                    }).catch(reject);
                } catch (e) {
                    console.error(e);
                    reject(e);
                }
            });

            if (cli.getCrossSigningId()) {
                this.phase = PHASE_DONE;
                this.emit("update");
            }
        } catch (e) {
            if (!(e instanceof AccessCancelledError)) {
                console.log(e);
            }
            // this will throw if the user hits cancel, so ignore
            this.phase = PHASE_INTRO;
            this.emit("update");
        }
    }

    _onUserTrustStatusChanged = async (userId) => {
        if (userId !== MatrixClientPeg.get().getUserId()) return;
        const crossSigningReady = await MatrixClientPeg.get().isCrossSigningReady();
        if (crossSigningReady) {
            this.phase = PHASE_DONE;
            this.emit("update");
        }
    }

    onVerificationRequest = async (request) => {
        if (request.otherUserId !== MatrixClientPeg.get().getUserId()) return;

        if (this.verificationRequest) {
            this.verificationRequest.off("change", this.onVerificationRequestChange);
        }
        this.verificationRequest = request;
        await request.accept();
        request.on("change", this.onVerificationRequestChange);
        this.emit("update");
    }

    onVerificationRequestChange = async () => {
        if (this.verificationRequest.cancelled) {
            this.verificationRequest.off("change", this.onVerificationRequestChange);
            this.verificationRequest = null;
            this.emit("update");
        } else if (this.verificationRequest.phase === VERIF_PHASE_DONE) {
            this.verificationRequest.off("change", this.onVerificationRequestChange);
            this.verificationRequest = null;
            // At this point, the verification has finished, we just need to wait for
            // cross signing to be ready to use, so wait for the user trust status to
            // change (or change to DONE if it's already ready).
            const crossSigningReady = await MatrixClientPeg.get().isCrossSigningReady();
            this.phase = crossSigningReady ? PHASE_DONE : PHASE_BUSY;
            this.emit("update");
        }
    }

    skip() {
        this.phase = PHASE_CONFIRM_SKIP;
        this.emit("update");
    }

    skipConfirm() {
        this.phase = PHASE_FINISHED;
        this.emit("update");
    }

    returnAfterSkip() {
        this.phase = PHASE_INTRO;
        this.emit("update");
    }

    done() {
        this.phase = PHASE_FINISHED;
        this.emit("update");
        // async - ask other clients for keys, if necessary
        MatrixClientPeg.get()._crypto.cancelAndResendAllOutgoingKeyRequests();
    }
}
