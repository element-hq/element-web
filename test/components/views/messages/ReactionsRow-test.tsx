/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

import React from "react";
import { render, screen } from "@testing-library/react";
import {
    CustomComponentLifecycle,
    CustomComponentOpts,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CustomComponentLifecycle";
import {
    MatrixEvent,
    Relations,
    RelationsEvent,
    EventType,
    Room,
    RelationType,
    M_BEACON,
    MatrixClient,
} from "matrix-js-sdk/src/matrix";

import ReactionsRow from "../../../../src/components/views/messages/ReactionsRow";
import { createMessageEventContent } from "../../../test-utils/events";
import { getMockClientWithEventEmitter } from "../../../test-utils";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { ModuleRunner } from "../../../../src/modules/ModuleRunner";

describe("ReactionsRow", () => {
    const eventContent = createMessageEventContent("hello");

    const roomId = "myRoomId";
    const mockClient = getMockClientWithEventEmitter({
        mxcUrlToHttp: jest.fn().mockReturnValue("https://not.a.real.url"),
        getRoom: jest.fn(),
    });
    const userId = "@alice:server";
    const room = new Room(roomId, mockClient, userId);

    const mxEvent = new MatrixEvent({ type: EventType.RoomMessage, content: eventContent });
    const reactions = new Relations(RelationType.Reference, M_BEACON.name, room);

    const mockGetSortedAnnotationsByKey = jest.spyOn(reactions, "getSortedAnnotationsByKey");
    const mockContent = "mockContent";
    const mockEvents = new Set([
        {
            getSender: () => "mockSender1",
            isRedacted: () => false,
            getRelation: () => ({ key: mockContent }),
        },
    ]) as never as RelationsEvent[];

    mockGetSortedAnnotationsByKey.mockReturnValue([[mockContent, mockEvents as never]]);

    const renderComp = () => {
        render(
            <MatrixClientContext.Provider
                value={{ getRoom: jest.fn().mockReturnValue(room) } as unknown as MatrixClient}
            >
                <ReactionsRow mxEvent={mxEvent} reactions={reactions} />
                );
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should render", () => {
        renderComp();
        expect(screen.getByText(mockContent)).toBeDefined();
    });

    describe("wrap the ReactionsRow with a React.Fragment", () => {
        it("should wrap the ReactionsRow with a React.Fragment", () => {
            jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts) => {
                if (lifecycleEvent === CustomComponentLifecycle.ReactionsRow) {
                    (opts as CustomComponentOpts).CustomComponent = ({ children }) => {
                        return (
                            <>
                                <div data-testid="wrapper-header">Header</div>
                                <div data-testid="wrapper-ReactionsRow">{children}</div>
                                <div data-testid="wrapper-footer">Footer</div>
                            </>
                        );
                    };
                }
            });

            renderComp();
            expect(screen.getByTestId("wrapper-header")).toBeDefined();
            expect(screen.getByTestId("wrapper-ReactionsRow")).toBeDefined();
            expect(screen.getByTestId("wrapper-footer")).toBeDefined();
            expect(screen.getByTestId("wrapper-header").nextSibling).toBe(screen.getByTestId("wrapper-ReactionsRow"));
            expect(screen.getByTestId("wrapper-ReactionsRow").nextSibling).toBe(screen.getByTestId("wrapper-footer"));
        });
    });
});
