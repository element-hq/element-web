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

import * as Stories from "./DmTombstoneCallTileView.stories";

const { IncomingVideoDeclined, OutgoingVideoDeclined, VideoEnded, VoiceEnded } = composeStories(Stories);

describe("DmTombstoneCallTileView", () => {
    describe("renders the tile", () => {
        it("IncomingVideoDeclined", () => {
            const { container } = render(<IncomingVideoDeclined />);
            expect(container).toMatchSnapshot();
        });

        it("OutgoingVideoDeclined", () => {
            const { container } = render(<OutgoingVideoDeclined />);
            expect(container).toMatchSnapshot();
        });

        it("VideoEnded", () => {
            const { container } = render(<VideoEnded />);
            expect(container).toMatchSnapshot();
        });

        it("VoiceEnded", () => {
            const { container } = render(<VoiceEnded />);
            expect(container).toMatchSnapshot();
        });
    });
});
