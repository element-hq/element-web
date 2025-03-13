/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
            title: _t("voip|no_media_perms_title"),
            description: _t("voip|no_media_perms_description", { brand }),
        });
    }

    return stream;
};
