/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render } from "jest-matrix-react";

import TabbedView, { Tab, TabLocation } from "../../../../src/components/structures/TabbedView";
import { type NonEmptyArray } from "../../../../src/@types/common";
import { _t } from "../../../../src/languageHandler";

describe("<TabbedView />", () => {
    const generalTab = new Tab("GENERAL", "common|general", "general", <div>general</div>);
    const labsTab = new Tab("LABS", "common|labs", "labs", <div>labs</div>);
    const appearanceTab = new Tab("APPEARANCE", "common|appearance", "appearance", <div>appearance</div>);
    const defaultProps = {
        tabLocation: TabLocation.LEFT,
        tabs: [generalTab, labsTab, appearanceTab] as NonEmptyArray<Tab<any>>,
        onChange: () => {},
    };
    const getComponent = (
        props: {
            activeTabId: "GENERAL" | "LABS" | "APPEARANCE";
            onChange?: () => any;
            tabs?: NonEmptyArray<Tab<any>>;
        } = {
            activeTabId: "GENERAL",
        },
    ): React.ReactElement => <TabbedView {...defaultProps} {...props} />;

    const getTabTestId = (tab: Tab<string>): string => `settings-tab-${tab.id}`;
    const getActiveTab = (container: HTMLElement): Element | undefined =>
        container.getElementsByClassName("mx_TabbedView_tabLabel_active")[0];
    const getActiveTabBody = (container: HTMLElement): Element | undefined =>
        container.getElementsByClassName("mx_TabbedView_tabPanel")[0];

    it("renders tabs", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders activeTabId tab as active when valid", () => {
        const { container } = render(getComponent({ activeTabId: appearanceTab.id }));
        expect(getActiveTab(container)?.textContent).toEqual(_t(appearanceTab.label));
        expect(getActiveTabBody(container)?.textContent).toEqual("appearance");
    });

    it("calls onchange on on tab click", () => {
        const onChange = jest.fn();
        const { getByTestId } = render(getComponent({ activeTabId: "GENERAL", onChange }));

        act(() => {
            fireEvent.click(getByTestId(getTabTestId(appearanceTab)));
        });

        expect(onChange).toHaveBeenCalledWith(appearanceTab.id);
    });

    it("keeps same tab active when order of tabs changes", () => {
        // start with middle tab active
        const { container, rerender } = render(getComponent({ activeTabId: labsTab.id }));

        expect(getActiveTab(container)?.textContent).toEqual(_t(labsTab.label));

        rerender(getComponent({ tabs: [labsTab, generalTab, appearanceTab], activeTabId: labsTab.id }));

        // labs tab still active
        expect(getActiveTab(container)?.textContent).toEqual(_t(labsTab.label));
    });
});
