/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Layout } from "../../../src/settings/enums/Layout";
import { getEventPresentation } from "../../../src/utils/EventPresentation";

describe("EventPresentation", () => {
    it.each([
        [Layout.Group, false, { layout: "group", density: "default" }],
        [Layout.Group, true, { layout: "group", density: "compact" }],
        [Layout.Bubble, false, { layout: "bubble", density: "default" }],
        [Layout.Bubble, true, { layout: "bubble", density: "default" }],
        [Layout.IRC, false, { layout: "irc", density: "default" }],
        [Layout.IRC, true, { layout: "irc", density: "default" }],
    ])("maps %s with compact=%s", (layout, useCompactLayout, expected) => {
        expect(getEventPresentation(layout, useCompactLayout)).toEqual(expected);
    });
});
