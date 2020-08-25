/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import classNames from 'classnames';
import Analytics from '../../../Analytics';
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";

interface IProps {
    // Whether this button is highlighted
    isHighlighted: boolean;
    // click handler
    onClick: () => void;
    // The badge to display above the icon
    badge?: React.ReactNode;
    // The parameters to track the click event
    analytics: string[];

    // Button name
    name: string;
    // Button title
    title: string;
}

// TODO: replace this, the composer buttons and the right panel buttons with a unified
// representation
export default class HeaderButton extends React.Component<IProps> {
    constructor(props: IProps) {
        super(props);
        this.onClick = this.onClick.bind(this);
    }

    private onClick() {
        Analytics.trackEvent(...this.props.analytics);
        this.props.onClick();
    }

    public render() {
        const classes = classNames({
            mx_RightPanel_headerButton: true,
            mx_RightPanel_headerButton_highlight: this.props.isHighlighted,
            [`mx_RightPanel_${this.props.name}`]: true,
        });

        return <AccessibleTooltipButton
            aria-selected={this.props.isHighlighted}
            role="tab"
            title={this.props.title}
            className={classes}
            onClick={this.onClick}
        />;
    }
}
