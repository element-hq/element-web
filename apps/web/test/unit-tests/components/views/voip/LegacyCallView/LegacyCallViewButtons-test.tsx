/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import LegacyCallViewButtons from "../../../../../../src/components/views/voip/LegacyCallView/LegacyCallViewButtons";
import { createTestClient } from "../../../../../test-utils";

describe("LegacyCallViewButtons", () => {
    const matrixClient = createTestClient();
    const roomId = "test-room-id";

    const renderButtons = () => {
        const call = new MatrixCall({
            client: matrixClient,
            roomId,
        });

        return render(
            <LegacyCallViewButtons
                call={call}
                handlers={{
                    onScreenshareClick: jest.fn(),
                    onToggleSidebarClick: jest.fn(),
                    onHangupClick: jest.fn(),
                    onMicMuteClick: jest.fn(),
                    onVidMuteClick: jest.fn(),
                }}
                buttonsVisibility={{
                    vidMute: true,
                    screensharing: true,
                    sidebar: true,
                    contextMenu: true,
                    dialpad: true,
                }}
                buttonsState={{
                    micMuted: false,
                    vidMuted: false,
                    sidebarShown: false,
                    screensharing: false,
                }}
            />,
        );
    };

    it("should render the buttons", () => {
        const { container } = renderButtons();
        expect(container).toMatchSnapshot();
    });
});
