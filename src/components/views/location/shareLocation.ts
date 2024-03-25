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

import {
    MatrixClient,
    IEventRelation,
    MatrixError,
    THREAD_RELATION_TYPE,
    ContentHelpers,
    LocationAssetType,
} from "matrix-js-sdk/src/matrix";
import { RoomMessageEventContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import QuestionDialog, { IQuestionDialogProps } from "../dialogs/QuestionDialog";
import SdkConfig from "../../../SdkConfig";
import { OwnBeaconStore } from "../../../stores/OwnBeaconStore";
import { doMaybeLocalRoomAction } from "../../../utils/local-room";

export enum LocationShareType {
    Own = "Own",
    Pin = "Pin",
    Live = "Live",
}

export type LocationShareProps = {
    timeout?: number;
    uri?: string;
    timestamp?: number;
};

// default duration to 5min for now
const DEFAULT_LIVE_DURATION = 300000;

export type ShareLocationFn = (props: LocationShareProps) => Promise<void>;

const getPermissionsErrorParams = (
    shareType: LocationShareType,
): {
    errorMessage: string;
    modalParams: IQuestionDialogProps;
} => {
    const errorMessage =
        shareType === LocationShareType.Live
            ? "Insufficient permissions to start sharing your live location"
            : "Insufficient permissions to send your location";

    const modalParams = {
        title: _t("location_sharing|error_no_perms_title"),
        description: _t("location_sharing|error_no_perms_description"),
        button: _t("action|ok"),
        hasCancelButton: false,
        onFinished: () => {}, // NOOP
    };
    return { modalParams, errorMessage };
};

const getDefaultErrorParams = (
    shareType: LocationShareType,
    openMenu: () => void,
): {
    errorMessage: string;
    modalParams: IQuestionDialogProps;
} => {
    const errorMessage =
        shareType === LocationShareType.Live
            ? "We couldn't start sharing your live location"
            : "We couldn't send your location";
    const modalParams = {
        title: _t("location_sharing|error_send_title"),
        description: _t("location_sharing|error_send_description", {
            brand: SdkConfig.get().brand,
        }),
        button: _t("action|try_again"),
        cancelButton: _t("action|cancel"),
        onFinished: (tryAgain: boolean) => {
            if (tryAgain) {
                openMenu();
            }
        },
    };
    return { modalParams, errorMessage };
};

const handleShareError = (error: unknown, openMenu: () => void, shareType: LocationShareType): void => {
    const { modalParams, errorMessage } =
        (error as MatrixError).errcode === "M_FORBIDDEN"
            ? getPermissionsErrorParams(shareType)
            : getDefaultErrorParams(shareType, openMenu);

    logger.error(errorMessage, error);

    Modal.createDialog(QuestionDialog, modalParams);
};

export const shareLiveLocation =
    (client: MatrixClient, roomId: string, displayName: string, openMenu: () => void): ShareLocationFn =>
    async ({ timeout }): Promise<void> => {
        const description = _t("location_sharing|live_description", { displayName });
        try {
            await OwnBeaconStore.instance.createLiveBeacon(
                roomId,
                ContentHelpers.makeBeaconInfoContent(
                    timeout ?? DEFAULT_LIVE_DURATION,
                    true /* isLive */,
                    description,
                    LocationAssetType.Self,
                ),
            );
        } catch (error) {
            handleShareError(error, openMenu, LocationShareType.Live);
        }
    };

export const shareLocation =
    (
        client: MatrixClient,
        roomId: string,
        shareType: LocationShareType,
        relation: IEventRelation | undefined,
        openMenu: () => void,
    ): ShareLocationFn =>
    async ({ uri, timestamp }): Promise<void> => {
        if (!uri) return;
        try {
            const threadId = (relation?.rel_type === THREAD_RELATION_TYPE.name && relation?.event_id) || null;
            const assetType = shareType === LocationShareType.Pin ? LocationAssetType.Pin : LocationAssetType.Self;
            const content = ContentHelpers.makeLocationContent(
                undefined,
                uri,
                timestamp,
                undefined,
                assetType,
            ) as RoomMessageEventContent;
            await doMaybeLocalRoomAction(
                roomId,
                (actualRoomId: string) => client.sendMessage(actualRoomId, threadId, content),
                client,
            );
        } catch (error) {
            handleShareError(error, openMenu, shareType);
        }
    };
