/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "@test-utils";

import * as Stories from "./CallDeclinedTileView.stories";

const { VideoCall, VoiceCall, CallDeclinedByUs } = composeStories(Stories);

describe("CallDeclinedTileView", () => {
    describe("renders the tile", () => {
        it("voice call", () => {
            const { container } = render(<VoiceCall />);
            expect(container).toMatchSnapshot();
        });

        it("video call", () => {
            const { container } = render(<VideoCall />);
            expect(container).toMatchSnapshot();
        });

        it("call declined by us", () => {
            const { container } = render(<CallDeclinedByUs />);
            expect(container).toMatchSnapshot();
        });
    });
});
