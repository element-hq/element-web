/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VoiceBroadcastControl } from "../../../../src/voice-broadcast";
import { Icon as StopIcon } from "../../../../res/img/compound/stop-16.svg";

describe("VoiceBroadcastControl", () => {
    let result: RenderResult;
    let onClick: () => void;

    beforeEach(() => {
        onClick = jest.fn();
    });

    describe("when rendering it", () => {
        beforeEach(() => {
            const stopIcon = <StopIcon className="mx_Icon mx_Icon_16" />;
            result = render(<VoiceBroadcastControl onClick={onClick} label="test label" icon={stopIcon} />);
        });

        it("should render as expected", () => {
            expect(result.container).toMatchSnapshot();
        });

        describe("when clicking it", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByLabelText("test label"));
            });

            it("should call onClick", () => {
                expect(onClick).toHaveBeenCalled();
            });
        });
    });
});
