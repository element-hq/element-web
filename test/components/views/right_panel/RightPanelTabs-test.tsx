/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, fireEvent } from "@testing-library/react";

import dis from "../../../../src/dispatcher/dispatcher";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import { RightPanelTabs } from "../../../../src/components/views/right_panel/RightPanelTabs";
import { Action } from "../../../../src/dispatcher/actions";

describe("<RightPanelTabs />", () => {
    it("Component renders the correct tabs", () => {
        const { container, getByRole } = render(<RightPanelTabs phase={RightPanelPhases.RoomSummary} />);
        expect(container).toMatchSnapshot();

        // We expect Info, People and Threads as tabs
        expect(getByRole("tab", { name: "Info" })).toBeDefined();
        expect(getByRole("tab", { name: "People" })).toBeDefined();
        expect(getByRole("tab", { name: "Threads" })).toBeDefined();
    });

    it("Correct tab is active", () => {
        const { container } = render(<RightPanelTabs phase={RightPanelPhases.RoomMemberList} />);
        expect(container).toMatchSnapshot();
        // Assert that the active tab is Info
        expect(container.querySelectorAll("[aria-selected='true']").length).toEqual(1);
        expect(container.querySelector("[aria-selected='true']")).toHaveAccessibleName("People");
    });

    it("Renders nothing for some phases, eg: FilePanel", () => {
        const { container } = render(<RightPanelTabs phase={RightPanelPhases.FilePanel} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("onClick behaviors work as expected", () => {
        const spy = jest.spyOn(RightPanelStore.instance, "pushCard");
        const { getByRole } = render(<RightPanelTabs phase={RightPanelPhases.RoomSummary} />);

        // Info -> People
        fireEvent.click(getByRole("tab", { name: "People" }));
        expect(spy).toHaveBeenLastCalledWith({ phase: RightPanelPhases.RoomMemberList }, true);

        // People -> Threads
        fireEvent.click(getByRole("tab", { name: "Threads" }));
        expect(spy).toHaveBeenLastCalledWith({ phase: RightPanelPhases.ThreadPanel }, true);

        // Threads -> Info
        fireEvent.click(getByRole("tab", { name: "Info" }));
        expect(spy).toHaveBeenLastCalledWith({ phase: RightPanelPhases.RoomSummary }, true);
    });

    it("Threads tab is focused on action", () => {
        const { getByRole } = render(<RightPanelTabs phase={RightPanelPhases.ThreadPanel} />);
        dis.dispatch({ action: Action.FocusThreadsPanel }, true);
        expect(getByRole("tab", { name: "Threads" })).toHaveFocus();
    });
});
