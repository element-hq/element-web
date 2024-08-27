/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

import React from "react";
import { render, screen } from "@testing-library/react";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import {
    CustomComponentLifecycle,
    CustomComponentOpts,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CustomComponentLifecycle";
import { Tooltip } from "@vector-im/compound-web";

import ReactionsRowButtonTooltip from "../../../src/components/views/messages/ReactionsRowButtonTooltip";
import { getMockClientWithEventEmitter } from "../../test-utils";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import { ModuleRunner } from "../../../src/modules/ModuleRunner";

describe("ReactionsRowButtonTooltip", () => {
    const content = "Hello world!";
    const reactionEvents = [] as any;
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
                    customReactionImagesEnabled={customReactionImagesEnabled}
                >
                    <div>Test tooltip</div>
                </ReactionsRowButtonTooltip>
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
                            <Tooltip label="r1, r2" caption="caption" placement="right">
                                <React.Fragment>
                                    <div data-testid="test-header">Header</div>
                                </React.Fragment>
                            </Tooltip>
                        );
                    };
                }
            });

            getComp();
            expect(screen.getByTestId("test-header")).toBeDefined();
        });
    });
});
