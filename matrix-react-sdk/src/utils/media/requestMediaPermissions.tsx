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

import { logger } from "matrix-js-sdk/src/logger";

import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import { _t } from "../../languageHandler";
import Modal from "../../Modal";
import SdkConfig from "../../SdkConfig";

export const requestMediaPermissions = async (video = true): Promise<MediaStream | undefined> => {
    let stream: MediaStream | undefined;
    let error: any;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video,
        });
    } catch (err: any) {
        // user likely doesn't have a webcam,
        // we should still allow to select a microphone
        if (video && err.name === "NotFoundError") {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (err) {
                error = err;
            }
        } else {
            error = err;
        }
    }
    if (error) {
        logger.log("Failed to list userMedia devices", error);
        const brand = SdkConfig.get().brand;
        Modal.createDialog(ErrorDialog, {
            title: _t("No media permissions"),
            description: _t("You may need to manually permit %(brand)s to access your microphone/webcam", { brand }),
        });
    }

    return stream;
};
