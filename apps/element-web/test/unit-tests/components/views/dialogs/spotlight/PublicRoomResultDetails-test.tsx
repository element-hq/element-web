/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { type IPublicRoomsChunkRoom } from "matrix-js-sdk/src/matrix";

import { PublicRoomResultDetails } from "../../../../../../src/components/views/dialogs/spotlight/PublicRoomResultDetails";

describe("PublicRoomResultDetails", () => {
    it("renders", () => {
        const { asFragment } = render(
            <PublicRoomResultDetails
                room={{
                    room_id: "room-id",
                    name: "hello?",
                    canonical_alias: "canonical-alias",
                    world_readable: true,
                    guest_can_join: false,
                    num_joined_members: 666,
                }}
                labelId="label-id"
                descriptionId="description-id"
                detailsId="details-id"
            />,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    it.each([
        { canonical_alias: "canonical-alias" },
        { aliases: ["alias-from-aliases"] },
        { name: "name over alias", canonical_alias: "canonical-alias" },
        {
            name: "with an overly long name that will be truncated for sure, you can't say anything about it",
            topic: "with a topic!",
        },
        { topic: "Very long topic " + new Array(1337).join("a") },
    ])("Public room results", (partialPublicRoomChunk: Partial<IPublicRoomsChunkRoom>) => {
        const roomChunk: IPublicRoomsChunkRoom = {
            room_id: "room-id",
            world_readable: true,
            guest_can_join: false,
            num_joined_members: 666,
            ...partialPublicRoomChunk,
        };

        const { asFragment } = render(
            <PublicRoomResultDetails
                room={roomChunk}
                labelId="label-id"
                descriptionId="description-id"
                detailsId="details-id"
            />,
        );

        expect(asFragment()).toMatchSnapshot();
    });
});
