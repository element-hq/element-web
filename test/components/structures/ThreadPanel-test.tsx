/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { render, screen, fireEvent } from "@testing-library/react";
import { mocked } from "jest-mock";
import "focus-visible"; // to fix context menus

import ThreadPanel, { ThreadFilterType, ThreadPanelHeader } from "../../../src/components/structures/ThreadPanel";
import { _t } from "../../../src/languageHandler";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { RoomPermalinkCreator } from "../../../src/utils/permalinks/Permalinks";
import { createTestClient, mkStubRoom } from "../../test-utils";
import { shouldShowFeedback } from "../../../src/utils/Feedback";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";

jest.mock("../../../src/utils/Feedback");

describe("ThreadPanel", () => {
    describe("Feedback prompt", () => {
        const cli = createTestClient();
        const room = mkStubRoom("!room:server", "room", cli);
        mocked(cli.getRoom).mockReturnValue(room);

        it("should show feedback prompt if feedback is enabled", () => {
            mocked(shouldShowFeedback).mockReturnValue(true);

            render(
                <MatrixClientContext.Provider value={cli}>
                    <ThreadPanel
                        roomId="!room:server"
                        onClose={jest.fn()}
                        resizeNotifier={new ResizeNotifier()}
                        permalinkCreator={new RoomPermalinkCreator(room)}
                    />
                </MatrixClientContext.Provider>,
            );
            expect(screen.queryByText("Give feedback")).toBeTruthy();
        });

        it("should hide feedback prompt if feedback is disabled", () => {
            mocked(shouldShowFeedback).mockReturnValue(false);

            render(
                <MatrixClientContext.Provider value={cli}>
                    <ThreadPanel
                        roomId="!room:server"
                        onClose={jest.fn()}
                        resizeNotifier={new ResizeNotifier()}
                        permalinkCreator={new RoomPermalinkCreator(room)}
                    />
                </MatrixClientContext.Provider>,
            );
            expect(screen.queryByText("Give feedback")).toBeFalsy();
        });
    });

    describe("Header", () => {
        it("expect that All filter for ThreadPanelHeader properly renders Show: All threads", () => {
            const { asFragment } = render(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined}
                />,
            );
            expect(asFragment()).toMatchSnapshot();
        });

        it("expect that My filter for ThreadPanelHeader properly renders Show: My threads", () => {
            const { asFragment } = render(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.My}
                    setFilterOption={() => undefined}
                />,
            );
            expect(asFragment()).toMatchSnapshot();
        });

        it("expect that ThreadPanelHeader properly opens a context menu when clicked on the button", () => {
            const { container } = render(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined}
                />,
            );
            const found = container.querySelector(".mx_ThreadPanel_dropdown");
            expect(found).toBeTruthy();
            expect(screen.queryByRole("menu")).toBeFalsy();
            fireEvent.click(found);
            expect(screen.queryByRole("menu")).toBeTruthy();
        });

        it("expect that ThreadPanelHeader has the correct option selected in the context menu", () => {
            const { container } = render(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined}
                />,
            );
            fireEvent.click(container.querySelector(".mx_ThreadPanel_dropdown"));
            const found = screen.queryAllByRole("menuitemradio");
            expect(found).toHaveLength(2);
            const foundButton = screen.queryByRole("menuitemradio", { checked: true });
            expect(foundButton.textContent).toEqual(`${_t("All threads")}${_t("Shows all threads from current room")}`);
            expect(foundButton).toMatchSnapshot();
        });
    });
});
