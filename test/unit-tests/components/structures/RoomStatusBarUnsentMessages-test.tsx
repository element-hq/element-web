/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import { RoomStatusBarUnsentMessages } from "../../../../src/components/structures/RoomStatusBarUnsentMessages";
import { StaticNotificationState } from "../../../../src/stores/notifications/StaticNotificationState";

describe("RoomStatusBarUnsentMessages", () => {
    const title = "test title";
    const description = "test description";
    const buttonsText = "test buttons";
    const buttons = <div>{buttonsText}</div>;

    beforeEach(() => {
        render(
            <RoomStatusBarUnsentMessages
                title={title}
                description={description}
                buttons={buttons}
                notificationState={StaticNotificationState.RED_EXCLAMATION}
            />,
        );
    });

    it("should render the values passed as props", () => {
        screen.getByText(title);
        screen.getByText(description);
        screen.getByText(buttonsText);
        // notification state
        screen.getByText("!");
    });
});
