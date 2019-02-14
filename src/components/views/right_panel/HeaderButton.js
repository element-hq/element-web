/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd

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
import PropTypes from 'prop-types';
import classNames from 'classnames';
import dis from '../../../dispatcher';
import Analytics from '../../../Analytics';
import AccessibleButton from '../elements/AccessibleButton';

export default class HeaderButton extends React.Component {
    constructor() {
        super();
        this.onClick = this.onClick.bind(this);
    }

    onClick(ev) {
        Analytics.trackEvent(...this.props.analytics);
        dis.dispatch({
            action: 'view_right_panel_phase',
            phase: this.props.clickPhase,
            fromHeader: true,
        });
    }

    render() {
        const classes = classNames({
            mx_RightPanel_headerButton: true,
            mx_RightPanel_headerButton_highlight: this.props.isHighlighted,
            [`mx_RightPanel_${this.props.name}`]: true,
        });

        return <AccessibleButton
            aria-label={this.props.title}
            aria-expanded={this.props.isHighlighted}
            title={this.props.title}
            className={classes}
            onClick={this.onClick}>
        </AccessibleButton>;
    }
}

HeaderButton.propTypes = {
    // Whether this button is highlighted
    isHighlighted: PropTypes.bool.isRequired,
    // The phase to swap to when the button is clicked
    clickPhase: PropTypes.string.isRequired,

    // The badge to display above the icon
    badge: PropTypes.node,
    // The parameters to track the click event
    analytics: PropTypes.arrayOf(PropTypes.string).isRequired,

    // Button name
    name: PropTypes.string.isRequired,
    // Button title
    title: PropTypes.string.isRequired,
};
