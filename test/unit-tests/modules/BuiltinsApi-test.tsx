/*
Copyright 2025 Element Creations Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import { ElementWebBuiltinsApi } from "../../../src/modules/BuiltinsApi.tsx";
import { stubClient } from "../../test-utils/test-utils";

const Avatar: React.FC<{ room: { roomId: string }; size: string }> = ({ room, size }) => {
    return (
        <div>
            Avatar, {room.roomId}, {size}
        </div>
    );
};

describe("ElementWebBuiltinsApi", () => {
    it("returns the RoomView component thats been set", () => {
        const builtinsApi = new ElementWebBuiltinsApi();
        const sentinel = {};
        builtinsApi.setComponents({ roomView: sentinel, roomAvatar: Avatar } as any);
        expect(builtinsApi.getRoomViewComponent()).toBe(sentinel);
    });

    it("returns rendered RoomView component", () => {
        const builtinsApi = new ElementWebBuiltinsApi();
        const RoomView = () => <div>hello world</div>;
        builtinsApi.setComponents({ roomView: RoomView, roomAvatar: Avatar } as any);
        const { container } = render(<> {builtinsApi.renderRoomView("!foo:m.org")}</>);
        expect(container).toHaveTextContent("hello world");
    });

    it("returns rendered RoomAvatar component", () => {
        stubClient();
        const builtinsApi = new ElementWebBuiltinsApi();
        builtinsApi.setComponents({ roomView: {}, roomAvatar: Avatar } as any);
        const { container } = render(<> {builtinsApi.renderRoomAvatar("!foo:m.org", "50")}</>);
        expect(container).toHaveTextContent("Avatar");
        expect(container).toHaveTextContent("!foo:m.org");
        expect(container).toHaveTextContent("50");
    });

    it("should throw error if called before components are set", () => {
        stubClient();
        const builtinsApi = new ElementWebBuiltinsApi();
        expect(() => builtinsApi.renderRoomAvatar("!foo:m.org")).toThrow("No RoomAvatar component has been set");
        expect(() => builtinsApi.renderRoomView("!foo:m.org")).toThrow("No RoomView component has been set");
    });
});
