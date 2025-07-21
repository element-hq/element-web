/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { render, fireEvent } from "jest-matrix-react";
import { Room } from "matrix-js-sdk/src/matrix";

import FileDropTarget from "../../../../src/components/structures/FileDropTarget.tsx";
import { stubClient } from "../../../test-utils";

describe("FileDropTarget", () => {
    let room: Room;
    beforeEach(() => {
        const client = stubClient();
        room = new Room("!roomId:example.com", client, client.getUserId()!);
        room.currentState.maySendMessage = jest.fn().mockReturnValue(true);
    });

    it("should render nothing when idle", () => {
        const element = document.createElement("div");
        const onFileDrop = jest.fn();

        const { asFragment } = render(<FileDropTarget room={room} onFileDrop={onFileDrop} parent={element} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render drop file prompt on mouse over with file if permissions allow", () => {
        const element = document.createElement("div");
        const onFileDrop = jest.fn();
        mocked(room.currentState.maySendMessage).mockReturnValue(true);

        const { asFragment } = render(<FileDropTarget room={room} onFileDrop={onFileDrop} parent={element} />);
        fireEvent.dragEnter(element, {
            dataTransfer: {
                types: ["Files"],
            },
        });
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not render drop file prompt on mouse over with file if permissions do not allow", () => {
        const element = document.createElement("div");
        const onFileDrop = jest.fn();
        mocked(room.currentState.maySendMessage).mockReturnValue(false);

        const { asFragment } = render(<FileDropTarget room={room} onFileDrop={onFileDrop} parent={element} />);
        fireEvent.dragEnter(element, {
            dataTransfer: {
                types: ["Files"],
            },
        });
        expect(asFragment()).toMatchSnapshot();
    });
});
