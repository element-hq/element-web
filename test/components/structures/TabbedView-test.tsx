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

describe("<TabbedView />", () => {
    const generalTab = new Tab("GENERAL", "General", "general", <div>general</div>);
    const labsTab = new Tab("LABS", "Labs", "labs", <div>labs</div>);
    const securityTab = new Tab("SECURITY", "Security", "security", <div>security</div>);
    const defaultProps = {
        tabLocation: TabLocation.LEFT,
        tabs: [generalTab, labsTab, securityTab] as NonEmptyArray<Tab<any>>,
    };
    const getComponent = (props = {}): React.ReactElement => <TabbedView {...defaultProps} {...props} />;

    const getTabTestId = (tab: Tab<string>): string => `settings-tab-${tab.id}`;
    const getActiveTab = (container: HTMLElement): Element | undefined =>
        container.getElementsByClassName("mx_TabbedView_tabLabel_active")[0];
    const getActiveTabBody = (container: HTMLElement): Element | undefined =>
        container.getElementsByClassName("mx_TabbedView_tabPanel")[0];

    it("renders tabs", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders first tab as active tab when no initialTabId", () => {
        const { container } = render(getComponent());
        expect(getActiveTab(container)?.textContent).toEqual(generalTab.label);
        expect(getActiveTabBody(container)?.textContent).toEqual("general");
    });

    it("renders first tab as active tab when initialTabId is not valid", () => {
        const { container } = render(getComponent({ initialTabId: "bad-tab-id" }));
        expect(getActiveTab(container)?.textContent).toEqual(generalTab.label);
        expect(getActiveTabBody(container)?.textContent).toEqual("general");
    });

    it("renders initialTabId tab as active when valid", () => {
        const { container } = render(getComponent({ initialTabId: securityTab.id }));
        expect(getActiveTab(container)?.textContent).toEqual(securityTab.label);
        expect(getActiveTabBody(container)?.textContent).toEqual("security");
    });

    it("sets active tab on tab click", () => {
        const { container, getByTestId } = render(getComponent());

        act(() => {
            fireEvent.click(getByTestId(getTabTestId(securityTab)));
        });

        expect(getActiveTab(container)?.textContent).toEqual(securityTab.label);
        expect(getActiveTabBody(container)?.textContent).toEqual("security");
    });

    it("calls onchange on on tab click", () => {
        const onChange = jest.fn();
        const { getByTestId } = render(getComponent({ onChange }));

        act(() => {
            fireEvent.click(getByTestId(getTabTestId(securityTab)));
        });

        expect(onChange).toHaveBeenCalledWith(securityTab.id);
    });

    it("keeps same tab active when order of tabs changes", () => {
        // start with middle tab active
        const { container, rerender } = render(getComponent({ initialTabId: labsTab.id }));

        expect(getActiveTab(container)?.textContent).toEqual(labsTab.label);

        rerender(getComponent({ tabs: [labsTab, generalTab, securityTab] }));

        // labs tab still active
        expect(getActiveTab(container)?.textContent).toEqual(labsTab.label);
    });

    it("does not reactivate inititalTabId on rerender", () => {
        const { container, getByTestId, rerender } = render(getComponent());

        expect(getActiveTab(container)?.textContent).toEqual(generalTab.label);

        // make security tab active
        act(() => {
            fireEvent.click(getByTestId(getTabTestId(securityTab)));
        });
        expect(getActiveTab(container)?.textContent).toEqual(securityTab.label);

        // rerender with new tab location
        rerender(getComponent({ tabLocation: TabLocation.TOP }));

        // still security tab
        expect(getActiveTab(container)?.textContent).toEqual(securityTab.label);
    });
});
