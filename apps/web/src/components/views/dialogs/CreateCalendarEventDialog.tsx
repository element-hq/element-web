/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import {
    CreateCalendarEventView,
    useCreateAutoDisposedViewModel,
    useViewModel,
} from "@element-hq/web-shared-components";

import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { _t } from "../../../languageHandler";
import { getUserTimezone } from "../../../TimezoneHandler";
import { CreateCalendarEventViewModel } from "../../../viewmodels/room/calendar/CreateCalendarEventViewModel";

interface CreateCalendarEventDialogProps {
    /**
     * The room to create the event in.
     */
    room: Room;
    /**
     * Called when the dialog closes.
     * @param created - Whether the event was created.
     */
    onFinished: (created?: boolean) => void;
}

/**
 * Dialog to create an MSC4569 calendar event in a room.
 */
export function CreateCalendarEventDialog({ room, onFinished }: CreateCalendarEventDialogProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new CreateCalendarEventViewModel({
                client: room.client,
                roomId: room.roomId,
                timeZone: getUserTimezone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                onFinished,
            }),
    );
    const { isCreating } = useViewModel(vm);

    return (
        <BaseDialog
            className="mx_CreateCalendarEventDialog"
            onFinished={() => onFinished(false)}
            title={_t("create_calendar_event_dialog|title")}
        >
            <div className="mx_Dialog_content">
                <CreateCalendarEventView vm={vm} />
            </div>
            <DialogButtons
                primaryButton={_t("action|create")}
                primaryDisabled={isCreating}
                onPrimaryButtonClick={vm.create}
                onCancel={() => onFinished(false)}
            />
        </BaseDialog>
    );
}
