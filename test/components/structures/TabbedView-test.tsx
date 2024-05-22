/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { act, fireEvent, render } from "@testing-library/react";

import TabbedView, { Tab, TabLocation } from "../../../src/components/structures/TabbedView";
import { NonEmptyArray } from "../../../src/@types/common";
import { _t } from "../../../src/languageHandler";

describe("<TabbedView />", () => {
    const generalTab = new Tab("GENERAL", "common|general", "general", <div>general</div>);
    const labsTab = new Tab("LABS", "common|labs", "labs", <div>labs</div>);
    const securityTab = new Tab("SECURITY", "common|security", "security", <div>security</div>);
    const defaultProps = {
        tabLocation: TabLocation.LEFT,
        tabs: [generalTab, labsTab, securityTab] as NonEmptyArray<Tab<any>>,
        onChange: () => {},
    };
    const getComponent = (
        props: {
            activeTabId: "GENERAL" | "LABS" | "SECURITY";
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
        const { container } = render(getComponent({ activeTabId: securityTab.id }));
        expect(getActiveTab(container)?.textContent).toEqual(_t(securityTab.label));
        expect(getActiveTabBody(container)?.textContent).toEqual("security");
    });

    it("calls onchange on on tab click", () => {
        const onChange = jest.fn();
        const { getByTestId } = render(getComponent({ activeTabId: "GENERAL", onChange }));

        act(() => {
            fireEvent.click(getByTestId(getTabTestId(securityTab)));
        });

        expect(onChange).toHaveBeenCalledWith(securityTab.id);
    });

    it("keeps same tab active when order of tabs changes", () => {
        // start with middle tab active
        const { container, rerender } = render(getComponent({ activeTabId: labsTab.id }));

        expect(getActiveTab(container)?.textContent).toEqual(_t(labsTab.label));

        rerender(getComponent({ tabs: [labsTab, generalTab, securityTab], activeTabId: labsTab.id }));

        // labs tab still active
        expect(getActiveTab(container)?.textContent).toEqual(_t(labsTab.label));
    });
});
