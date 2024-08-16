/*
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
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventType } from "matrix-js-sdk/src/matrix";

import { UnpinAllDialog } from "../../../../src/components/views/dialogs/UnpinAllDialog";
import { createTestClient } from "../../../test-utils";

describe("<UnpinAllDialog />", () => {
    const client = createTestClient();
    const roomId = "!room:example.org";

    function renderDialog(onFinished = jest.fn()) {
        return render(<UnpinAllDialog matrixClient={client} roomId={roomId} onFinished={onFinished} />);
    }

    it("should render", () => {
        const { asFragment } = renderDialog();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should remove all pinned events when clicked on Continue", async () => {
        const onFinished = jest.fn();
        renderDialog(onFinished);

        await userEvent.click(screen.getByText("Continue"));
        expect(client.sendStateEvent).toHaveBeenCalledWith(roomId, EventType.RoomPinnedEvents, { pinned: [] }, "");
        expect(onFinished).toHaveBeenCalled();
    });
});
