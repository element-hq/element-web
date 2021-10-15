/*
Copyright 2017 Travis Ralston
Copyright 2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import * as React from "react";
import { _t } from '../../languageHandler';
import AutoHideScrollbar from './AutoHideScrollbar';
import { replaceableComponent } from "../../utils/replaceableComponent";
import classNames from "classnames";
import AccessibleButton from "../views/elements/AccessibleButton";

import { logger } from "matrix-js-sdk/src/logger";

/**
 * Represents a tab for the TabbedView.
 */
export class Tab {
    /**
     * Creates a new tab.
     * @param {string} id The tab's ID.
     * @param {string} label The untranslated tab label.
     * @param {string} icon The class for the tab icon. This should be a simple mask.
     * @param {React.ReactNode} body The JSX for the tab container.
     */
    constructor(public id: string, public label: string, public icon: string, public body: React.ReactNode) {
    }
}

export enum TabLocation {
    LEFT = 'left',
    TOP = 'top',
}

interface IProps {
    tabs: Tab[];
    initialTabId?: string;
    tabLocation: TabLocation;
    onChange?: (tabId: string) => void;
}

interface IState {
    activeTabIndex: number;
}

@replaceableComponent("structures.TabbedView")
export default class TabbedView extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        let activeTabIndex = 0;
        if (props.initialTabId) {
            const tabIndex = props.tabs.findIndex(t => t.id === props.initialTabId);
            if (tabIndex >= 0) activeTabIndex = tabIndex;
        }

        this.state = {
            activeTabIndex,
        };
    }

    static defaultProps = {
        tabLocation: TabLocation.LEFT,
    };

    private getActiveTabIndex() {
        if (!this.state || !this.state.activeTabIndex) return 0;
        return this.state.activeTabIndex;
    }

    /**
     * Shows the given tab
     * @param {Tab} tab the tab to show
     * @private
     */
    private setActiveTab(tab: Tab) {
        const idx = this.props.tabs.indexOf(tab);
        if (idx !== -1) {
            if (this.props.onChange) this.props.onChange(tab.id);
            this.setState({ activeTabIndex: idx });
        } else {
            logger.error("Could not find tab " + tab.label + " in tabs");
        }
    }

    private renderTabLabel(tab: Tab) {
        let classes = "mx_TabbedView_tabLabel ";

        const idx = this.props.tabs.indexOf(tab);
        if (idx === this.getActiveTabIndex()) classes += "mx_TabbedView_tabLabel_active";

        let tabIcon = null;
        if (tab.icon) {
            tabIcon = <span className={`mx_TabbedView_maskedIcon ${tab.icon}`} />;
        }

        const onClickHandler = () => this.setActiveTab(tab);

        const label = _t(tab.label);
        return (
            <AccessibleButton className={classes} key={"tab_label_" + tab.label} onClick={onClickHandler}>
                { tabIcon }
                <span className="mx_TabbedView_tabLabel_text">
                    { label }
                </span>
            </AccessibleButton>
        );
    }

    private renderTabPanel(tab: Tab): React.ReactNode {
        return (
            <div className="mx_TabbedView_tabPanel" key={"mx_tabpanel_" + tab.label}>
                <AutoHideScrollbar className='mx_TabbedView_tabPanelContent'>
                    { tab.body }
                </AutoHideScrollbar>
            </div>
        );
    }

    public render(): React.ReactNode {
        const labels = this.props.tabs.map(tab => this.renderTabLabel(tab));
        const panel = this.renderTabPanel(this.props.tabs[this.getActiveTabIndex()]);

        const tabbedViewClasses = classNames({
            'mx_TabbedView': true,
            'mx_TabbedView_tabsOnLeft': this.props.tabLocation == TabLocation.LEFT,
            'mx_TabbedView_tabsOnTop': this.props.tabLocation == TabLocation.TOP,
        });

        return (
            <div className={tabbedViewClasses}>
                <div className="mx_TabbedView_tabLabels">
                    { labels }
                </div>
                { panel }
            </div>
        );
    }
}
