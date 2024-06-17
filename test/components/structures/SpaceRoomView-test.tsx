/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

/**
 * @todo This test is incomplete and needs to be finished.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { MockedObject, mocked } from "jest-mock";

import SpaceRoomView from "../../../src/components/structures/SpaceRoomView";
import { mkSpace, stubClient } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { RoomPermalinkCreator } from "../../../src/utils/permalinks/Permalinks";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";

describe("SpaceRoomView", () => {
    stubClient();
    const client: MockedObject<MatrixClient> = mocked(MatrixClientPeg.safeGet());
    const sourceRoom = "!111111111111111111:example.org";

    const setupSpace = (client: MatrixClient): Room => {
        const testSpace: Room = mkSpace(client, "!space:server");
        testSpace.name = "Test Space";
        client.getRoom = () => testSpace;
        return testSpace;
    };

    const space = setupSpace(client);

    const context = {
        getSafeUserId: jest.fn().mockReturnValue("@guest:localhost"),
    };

    jest.spyOn(MatrixClientPeg, "get").mockReturnValue(client);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComp = () =>
        render(
            <MatrixClientContext.Provider value={{ ...client, ...context } as unknown as MatrixClient}>
                <SpaceRoomView
                    space={space}
                    resizeNotifier={new ResizeNotifier()}
                    permalinkCreator={new RoomPermalinkCreator(undefined!, sourceRoom)}
                    onJoinButtonClicked={(): void => console.log("Function not implemented.")}
                    onRejectButtonClicked={(): void => console.log("Function not implemented.")}
                />
            </MatrixClientContext.Provider>,
        );

    it("should render a SpaceRoomView", () => {
        renderComp();
        screen.debug();
        expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
    });
});
