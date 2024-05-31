/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

import React from "react";
import { render, screen } from "@testing-library/react";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import {
    CustomComponentLifecycle,
    CustomComponentOpts,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CustomComponentLifecycle";

import ReactionsRowButtonTooltip from "../../../src/components/views/messages/ReactionsRowButtonTooltip";
import { getMockClientWithEventEmitter } from "../../test-utils";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import { ModuleRunner } from "../../../src/modules/ModuleRunner";

describe("ReactionsRowButtonTooltip", () => {
    const content = "Hello world!";
    const reactionEvents = [] as any;
    const visible = true;
    const roomId = "myRoomId";
    const mockClient = getMockClientWithEventEmitter({
        mxcUrlToHttp: jest.fn().mockReturnValue("https://not.a.real.url"),
        getRoom: jest.fn(),
    });
    const userId = "@alice:server";
    const room = new Room(roomId, mockClient, userId);

    const customReactionImagesEnabled = true;

    const mxEvent = {
        getRoomId: jest.fn().mockReturnValue(roomId),
        pushDetails: {},
        _replacingEvent: null,
        _localRedactionEvent: null,
        _isCancelled: false,
    } as unknown as MatrixEvent;

    const getComp = () =>
        render(
            <MatrixClientContext.Provider
                value={{ getRoom: jest.fn().mockReturnValue(room) } as unknown as MatrixClient}
            >
                <ReactionsRowButtonTooltip
                    mxEvent={mxEvent}
                    content={content}
                    reactionEvents={reactionEvents}
                    visible={visible}
                    customReactionImagesEnabled={customReactionImagesEnabled}
                />
            </MatrixClientContext.Provider>,
        );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should render", () => {
        const { asFragment } = getComp();
        screen.debug();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("wrap the ReactionsRowButtonTooltip with a React.Fragment", () => {
        it("should wrap the ReactionsRowButtonTooltip with a React.Fragment", () => {
            jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts) => {
                if (lifecycleEvent === CustomComponentLifecycle.ReactionsRowButtonTooltip) {
                    (opts as CustomComponentOpts).CustomComponent = ({ children }) => {
                        return (
                            <>
                                <div data-testid="wrapper-header">Header</div>
                                <div data-testid="wrapper-ReactionsRowButtonTooltip">{children}</div>
                                <div data-testid="wrapper-footer">Footer</div>
                            </>
                        );
                    };
                }
            });

            getComp();
            expect(screen.getByTestId("wrapper-header")).toBeDefined();
            expect(screen.getByTestId("wrapper-ReactionsRowButtonTooltip")).toBeDefined();
            expect(screen.getByTestId("wrapper-footer")).toBeDefined();
            expect(screen.getByTestId("wrapper-header").nextSibling).toBe(
                screen.getByTestId("wrapper-ReactionsRowButtonTooltip"),
            );
            expect(screen.getByTestId("wrapper-ReactionsRowButtonTooltip").nextSibling).toBe(
                screen.getByTestId("wrapper-footer"),
            );
        });
    });
});
