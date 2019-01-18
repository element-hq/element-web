/*
Copyright 2017 Travis Ralston
Copyright 2019 New Vector Ltd

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
import {_t, _td} from '../../languageHandler';
import GeminiScrollbar from 'react-gemini-scrollbar';
import PropTypes from "prop-types";
//import scrollSnapPolyfill from 'css-scroll-snap-polyfill';

const DEFAULT_EXIT_STRING = _td("Return to app");

/**
 * Represents a tab for the TabbedView
 */
export class Tab {
    /**
     * Creates a new tab
     * @param {string} tabLabel The untranslated tab label
     * @param {string} tabJsx The JSX for the tab container.
     */
    constructor(tabLabel, tabJsx) {
        this.label = tabLabel;
        this.body = tabJsx;
    }
}

export class TabbedView extends React.Component {
    constructor() {
        super();

        // This is used to track when the user has scrolled all the way up or down so we
        // don't immediately start flipping between tabs.
        this._reachedEndAt = 0;
    }

    getInitialState() {
        return {
            activeTabIndex: 0,
        };
    }

    _getActiveTabIndex() {
        return this.state ? this.state.activeTabIndex : 0;
    }

    /**
     * Shows the given tab
     * @param {Tab} tab the tab to show
     * @private
     */
    _setActiveTab(tab) {
        const idx = this.props.tabs.indexOf(tab);
        if (idx !== -1) {
            this.setState({activeTabIndex: idx});
            this._reachedEndAt = 0; // reset scroll timer
        }
        else console.error("Could not find tab " + tab.label + " in tabs");
    }

    _nextTab() {
        let targetIndex = this._getActiveTabIndex() + 1;
        if (targetIndex < this.props.tabs.length) {
            this.setState({activeTabIndex: targetIndex});
            this._reachedEndAt = 0; // reset scroll timer
        }
    }

    _previousTab() {
        let targetIndex = this._getActiveTabIndex() - 1;
        if (targetIndex >= 0) {
            this.setState({activeTabIndex: targetIndex});
            this._reachedEndAt = 0; // reset scroll timer
        }
    }

    _getTabLabel(tab) {
        let classes = "mx_TabbedView_tabLabel ";

        const idx = this.props.tabs.indexOf(tab);
        if (idx === this._getActiveTabIndex()) classes += "mx_TabbedView_tabLabel_active";

        return (
            <span className={classes} key={"tab_label_ " + tab.label}
                  onClick={() => this._setActiveTab(tab)}>
                {_t(tab.label)}
            </span>
        );
    }

    _getTabPanel(tab) {
        return (
            <div className="mx_TabbedView_tabPanel" key={"mx_tabpanel_" + tab.label}>
                {tab.body}
            </div>
        );
    }

    componentDidUpdate() {
        window.requestAnimationFrame(() => {
            console.log("SCROLL SNAP POLYFILL: UPDATE");
            //scrollSnapPolyfill();
        });
    }

    componentDidMount() {
        window.requestAnimationFrame(() => {
            console.log("SCROLL SNAP POLYFILL: MOUNT");
            //scrollSnapPolyfill();
        });
    }

    render() {
        const labels = [];
        const tabs = [];

        for (const tab of this.props.tabs) {
            labels.push(this._getTabLabel(tab));
            tabs.push(this._getTabPanel(tab));
        }

        const returnToApp = (
            <span className="mx_TabbedView_tabLabel mx_TabbedView_exit" onClick={this.props.onExit}>
                {_t(this.props.exitLabel || DEFAULT_EXIT_STRING)}
            </span>
        );

        return (
            <div className="mx_TabbedView">
                <div className="mx_TabbedView_tabLabels">
                    {returnToApp}
                    {labels}
                </div>
                <div className="mx_TabbedView_tabPanels">
                    {tabs}
                </div>
            </div>
        );
    }
}

TabbedView.PropTypes = {
    // Called when the user clicks the "Exit" or "Return to app" button
    onExit: PropTypes.func.isRequired,

    // The untranslated label for the "Return to app" button.
    // Default: "Return to app"
    exitLabel: PropTypes.string,

    // The tabs to show
    tabs: PropTypes.arrayOf(Tab).isRequired,
};