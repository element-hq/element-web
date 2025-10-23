/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import { ElementWebBuiltinsApi } from "../../../src/modules/BuiltinsApi";
import { stubClient } from "../../test-utils/test-utils";
import * as utils from "../../../src/modules/common";

jest.mock("../../../src/components/views/avatars/RoomAvatar", () => {
    const Avatar: React.FC<{ room: { roomId: string }; size: string }> = ({ room, size }) => {
        return (
            <div>
                Avatar, {room.roomId}, {size}
            </div>
        );
    };
    return {
        __esModule: true,
        default: Avatar,
    };
});

describe("ElementWebBuiltinsApi", () => {
    it("returns the RoomView component thats been set", () => {
        const builtinsApi = new ElementWebBuiltinsApi();
        const sentinel = {};
        builtinsApi.setRoomViewComponent(sentinel as any);
        expect(builtinsApi.getRoomViewComponent()).toBe(sentinel);
    });

    it("returns rendered RoomView component", () => {
        const builtinsApi = new ElementWebBuiltinsApi();
        const RoomView = () => <div>hello world</div>;
        builtinsApi.setRoomViewComponent(RoomView as any);
        const { container } = render(<> {builtinsApi.renderRoomView("!foo:m.org")}</>);
        expect(container).toHaveTextContent("hello world");
    });

    it("returns rendered RoomAvatar component", () => {
        const cli = stubClient();
        jest.spyOn(utils, "getSafeCli").mockReturnValue(cli);

        const builtinsApi = new ElementWebBuiltinsApi();
        const { container } = render(<> {builtinsApi.renderRoomAvatar("!foo:m.org", "50")}</>);
        expect(container).toHaveTextContent("Avatar");
        expect(container).toHaveTextContent("!foo:m.org");
        expect(container).toHaveTextContent("50");
    });
});
