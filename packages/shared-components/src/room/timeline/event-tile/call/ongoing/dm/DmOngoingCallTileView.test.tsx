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

import * as Stories from "./DmOngoingCallTileView.stories";

const {
    IncomingVideoCall,
    IncomingVoiceCall,
    OutgoingVideoCall,
    OutgoingVoiceCall,
    VideoCallInProgress,
    VoiceCallInProgress,
} = composeStories(Stories);

describe("DmOngoingCallTileView", () => {
    describe("renders the tile", () => {
        it("IncomingVideoCall", () => {
            const { container } = render(<IncomingVideoCall />);
            expect(container).toMatchSnapshot();
        });

        it("IncomingVoiceCall", () => {
            const { container } = render(<IncomingVoiceCall />);
            expect(container).toMatchSnapshot();
        });

        it("OutgoingVideoCall", () => {
            const { container } = render(<OutgoingVideoCall />);
            expect(container).toMatchSnapshot();
        });

        it("OutgoingVoiceCall", () => {
            const { container } = render(<OutgoingVoiceCall />);
            expect(container).toMatchSnapshot();
        });

        it("VoiceCallInProgress", () => {
            const { container } = render(<VoiceCallInProgress />);
            expect(container).toMatchSnapshot();
        });

        it("VideoCallInProgress", () => {
            const { container } = render(<VideoCallInProgress />);
            expect(container).toMatchSnapshot();
        });
    });
});
