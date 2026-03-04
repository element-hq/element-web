/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { waitFor } from "jest-matrix-react";

import WidgetUtils from "../../../src/utils/WidgetUtils";
import { setUpCommandTest } from "./utils";
import { WidgetType } from "../../../src/widgets/WidgetType";

describe("/addwidget", () => {
    const roomId = "!room:example.com";

    it("should parse html iframe snippets", async () => {
        jest.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
        const spy = jest.spyOn(WidgetUtils, "setRoomWidget");

        const { client, command } = setUpCommandTest(roomId, `/addwidget`);

        command.run(client, roomId, null, '<iframe src="https://element.io"></iframe>');

        await waitFor(() =>
            expect(spy).toHaveBeenCalledWith(
                client,
                roomId,
                expect.any(String),
                WidgetType.CUSTOM,
                "https://element.io",
                "Custom",
                {},
            ),
        );
    });
});
