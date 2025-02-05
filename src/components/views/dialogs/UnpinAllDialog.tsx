/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, Text } from "@vector-im/compound-web";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import BaseDialog from "../dialogs/BaseDialog";
import { _t } from "../../../languageHandler";
import PinningUtils from "../../../utils/PinningUtils.ts";
import PosthogTrackers from "../../../PosthogTrackers.ts";

/**
 * Properties for {@link UnpinAllDialog}.
 */
interface UnpinAllDialogProps {
    /*
     * The matrix client to use.
     */
    matrixClient: MatrixClient;
    /*
     * The room ID to unpin all events in.
     */
    roomId: string;
    /*
     * Callback for when the dialog is closed.
     */
    onFinished: () => void;
}

/**
 * A dialog that asks the user to confirm unpinning all events in a room.
 */
export function UnpinAllDialog({ matrixClient, roomId, onFinished }: UnpinAllDialogProps): JSX.Element {
    return (
        <BaseDialog
            hasCancel={true}
            title={_t("right_panel|pinned_messages|unpin_all|title")}
            titleClass="mx_UnpinAllDialog_title"
            className="mx_UnpinAllDialog"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <Text as="span">{_t("right_panel|pinned_messages|unpin_all|content")}</Text>
            <div className="mx_UnpinAllDialog_buttons">
                <Button
                    destructive={true}
                    onClick={async () => {
                        try {
                            await PinningUtils.unpinAllEvents(matrixClient, roomId);
                            PosthogTrackers.trackPinUnpinMessage("Unpin", "UnpinAll");
                        } catch (e) {
                            logger.error("Failed to unpin all events:", e);
                        }
                        onFinished();
                    }}
                >
                    {_t("action|continue")}
                </Button>
                <Button kind="tertiary" onClick={onFinished}>
                    {_t("action|cancel")}
                </Button>
            </div>
        </BaseDialog>
    );
}
