/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"navigation": {"disableChildFrameNavigation": true }}}

import { describe, it, expect, vi } from "vitest";
import { waitFor } from "test-utils-rtl";

import WidgetUtils from "../utils/WidgetUtils";
import { setUpCommandTest } from "./__mocks__";
import { WidgetType } from "../widgets/WidgetType";

describe("/addwidget", () => {
    const roomId = "!room:example.com";

    it("should parse html iframe snippets", async () => {
        vi.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
        // This only asserts the call args below -- block the real implementation so it doesn't
        // actually try to set up the widget (which, for a real URL like "https://element.io", ends
        // up making a genuine outbound network request under happy-dom).
        const spy = vi.spyOn(WidgetUtils, "setRoomWidget").mockResolvedValue(undefined);

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
