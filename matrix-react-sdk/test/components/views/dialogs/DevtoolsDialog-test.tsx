/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { getByLabelText, render } from "@testing-library/react";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient } from "matrix-js-sdk/src/client";
import userEvent from "@testing-library/user-event";

import { stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import DevtoolsDialog from "../../../../src/components/views/dialogs/DevtoolsDialog";

describe("DevtoolsDialog", () => {
    let cli: MatrixClient;
    let room: Room;

    function getComponent(roomId: string, onFinished = () => true) {
        return render(
            <MatrixClientContext.Provider value={cli}>
                <DevtoolsDialog roomId={roomId} onFinished={onFinished} />
            </MatrixClientContext.Provider>,
        );
    }

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = new Room("!id", cli, "@alice:matrix.org");

        jest.spyOn(cli, "getRoom").mockReturnValue(room);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("renders the devtools dialog", () => {
        const { asFragment } = getComponent(room.roomId);
        expect(asFragment()).toMatchSnapshot();
    });

    it("copies the roomid", async () => {
        const user = userEvent.setup();
        jest.spyOn(navigator.clipboard, "writeText");

        const { container } = getComponent(room.roomId);

        const copyBtn = getByLabelText(container, "Copy");
        await user.click(copyBtn);
        const copiedBtn = getByLabelText(container, "Copied!");

        expect(copiedBtn).toBeInTheDocument();
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        expect(navigator.clipboard.readText()).resolves.toBe(room.roomId);
    });
});
