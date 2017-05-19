/*
Copyright 2017 Vector Creations Ltd

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

import sdk from './index';
import Modal from './Modal';

export default class KeyRequestHandler {
    constructor(matrixClient) {
        this._matrixClient = matrixClient;

        this._isDialogOpen = false;

        // userId -> deviceId -> [keyRequest]
        this._pendingKeyRequests = {};
    }


    handleKeyRequest(keyRequest) {
        const userId = keyRequest.userId;
        const deviceId = keyRequest.deviceId;

        if (!this._pendingKeyRequests[userId]) {
            this._pendingKeyRequests[userId] = {};
        }
        if (!this._pendingKeyRequests[userId][deviceId]) {
            this._pendingKeyRequests[userId][deviceId] = [];
        }
        this._pendingKeyRequests[userId][deviceId].push(keyRequest);

        if (this._isDialogOpen) {
            // ignore for now
            console.log("Key request, but we already have a dialog open");
            return;
        }

        this._processNextRequest();
    }

    _processNextRequest() {
        const userId = Object.keys(this._pendingKeyRequests)[0];
        if (!userId) {
            return;
        }
        const deviceId = Object.keys(this._pendingKeyRequests[userId])[0];
        if (!deviceId) {
            return;
        }
        console.log(`Starting KeyShareDialog for ${userId}:${deviceId}`);

        const finished = (r) => {
            this._isDialogOpen = false;

            if (r) {
                for (const req of this._pendingKeyRequests[userId][deviceId]) {
                    req.share();
                }
            }
            delete this._pendingKeyRequests[userId][deviceId];
            if (Object.keys(this._pendingKeyRequests[userId]).length === 0) {
                delete this._pendingKeyRequests[userId];
            }

            this._processNextRequest();
        };

        const KeyShareDialog = sdk.getComponent("dialogs.KeyShareDialog");
        Modal.createDialog(KeyShareDialog, {
            matrixClient: this._matrixClient,
            userId: userId,
            deviceId: deviceId,
            onFinished: finished,
        });
        this._isDialogOpen = true;
    }
}

