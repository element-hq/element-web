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

import { RelationType } from "matrix-js-sdk/src/@types/event";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { makeLocationContent } from "matrix-js-sdk/src/content-helpers";
import { logger } from "matrix-js-sdk/src/logger";
import { IEventRelation } from "matrix-js-sdk/src/models/event";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import QuestionDialog from "../dialogs/QuestionDialog";
import SdkConfig from "../../../SdkConfig";

export const shareLocation = (
    client: MatrixClient,
    roomId: string,
    relation: IEventRelation | undefined,
    openMenu: () => void,
) => async (uri: string, ts: number) => {
    if (!uri) return false;
    try {
        const text = textForLocation(uri, ts, null);
        const threadId = relation?.rel_type === RelationType.Thread ? relation.event_id : null;
        await client.sendMessage(roomId, threadId, makeLocationContent(text, uri, ts, null));
    } catch (e) {
        logger.error("We couldn't send your location", e);

        const analyticsAction = "We couldn't send your location";
        const params = {
            title: _t("We couldn't send your location"),
            description: _t("%(brand)s could not send your location. Please try again later.", {
                brand: SdkConfig.get().brand,
            }),
            button: _t('Try again'),
            cancelButton: _t('Cancel'),
            onFinished: (tryAgain: boolean) => {
                if (tryAgain) {
                    openMenu();
                }
            },
        };
        Modal.createTrackedDialog(analyticsAction, '', QuestionDialog, params);
    }
    return true;
};

export function textForLocation(
    uri: string,
    ts: number,
    description: string | null,
): string {
    const date = new Date(ts).toISOString();
    if (description) {
        return `Location "${description}" ${uri} at ${date}`;
    } else {
        return `Location ${uri} at ${date}`;
    }
}
