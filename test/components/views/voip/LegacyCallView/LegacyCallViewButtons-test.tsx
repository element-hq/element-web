/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import React from "react";
import { render } from "@testing-library/react";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import LegacyCallViewButtons from "../../../../../src/components/views/voip/LegacyCallView/LegacyCallViewButtons";
import { createTestClient } from "../../../../test-utils";

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
