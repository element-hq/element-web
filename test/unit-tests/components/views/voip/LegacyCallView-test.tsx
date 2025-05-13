/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { type MatrixCall } from "matrix-js-sdk/src/matrix";

import LegacyCallView from "../../../../../src/components/views/voip/LegacyCallView";
import { stubClient } from "../../../../test-utils";

describe("LegacyCallView", () => {
    it("should exit full screen on unmount", () => {
        const element = document.createElement("div");
        // @ts-expect-error
        document.fullscreenElement = element;
        document.exitFullscreen = jest.fn();

        stubClient();

        const call = {
            on: jest.fn(),
            removeListener: jest.fn(),
            getFeeds: jest.fn().mockReturnValue([]),
            isLocalOnHold: jest.fn().mockReturnValue(false),
            isRemoteOnHold: jest.fn().mockReturnValue(false),
            isMicrophoneMuted: jest.fn().mockReturnValue(false),
            isLocalVideoMuted: jest.fn().mockReturnValue(false),
            isScreensharing: jest.fn().mockReturnValue(false),
        } as unknown as MatrixCall;

        const { unmount } = render(<LegacyCallView call={call} />);
        expect(document.exitFullscreen).not.toHaveBeenCalled();
        unmount();
        expect(document.exitFullscreen).toHaveBeenCalled();
    });
});
