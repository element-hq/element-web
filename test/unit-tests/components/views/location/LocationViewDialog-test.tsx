/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult } from "jest-matrix-react";
import { RoomMember, LocationAssetType } from "matrix-js-sdk/src/matrix";

import LocationViewDialog from "../../../../../src/components/views/location/LocationViewDialog";
import { TILE_SERVER_WK_KEY } from "../../../../../src/utils/WellKnownUtils";
import { getMockClientWithEventEmitter, makeLocationEvent } from "../../../../test-utils";

describe("<LocationViewDialog />", () => {
    const roomId = "!room:server";
    const userId = "@user:server";
    const mockClient = getMockClientWithEventEmitter({
        getClientWellKnown: jest.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        }),
        isGuest: jest.fn().mockReturnValue(false),
    });
    const defaultEvent = makeLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Pin);
    const defaultProps = {
        matrixClient: mockClient,
        mxEvent: defaultEvent,
        onFinished: jest.fn(),
    };
    const getComponent = (props = {}): RenderResult => render(<LocationViewDialog {...defaultProps} {...props} />);

    it("renders map correctly", () => {
        const { container } = getComponent();
        expect(container.querySelector(".mx_Map")).toMatchSnapshot();
    });

    it("renders marker correctly for self share", () => {
        const selfShareEvent = makeLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Self);
        const member = new RoomMember(roomId, userId);
        // @ts-ignore cheat assignment to property
        selfShareEvent.sender = member;
        const { container } = getComponent({ mxEvent: selfShareEvent });
        expect(container.querySelector(".mx_BaseAvatar")?.getAttribute("title")).toEqual(userId);
    });
});
