/*
 Copyright 2016 Jani Mustonen

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

/**
 * AccessibleButton is a generic wrapper for any element that should be treated
 * as a button.  Identifies the element as a button, setting proper tab
 * indexing and keyboard activation behavior.
 *
 * @param {Object} props  react element properties
 * @returns {Object} rendered react
 */
export default function AccessibleButton(props) {
    const {element, onClick, children, ...restProps} = props;
    restProps.onClick = onClick;
    restProps.onKeyUp = function(e) {
        if (e.keyCode == 13 || e.keyCode == 32) return onClick(e);
    };
    restProps.tabIndex = restProps.tabIndex || "0";
    restProps.role = "button";
    return React.createElement(element, restProps, children);
}

/**
 * children: React's magic prop. Represents all children given to the element.
 * element:  (optional) The base element type. "div" by default.
 * onClick:  (required) Event handler for button activation. Should be
 *           implemented exactly like a normal onClick handler.
 */
AccessibleButton.propTypes = {
    children: React.PropTypes.node,
    element: React.PropTypes.string,
    onClick: React.PropTypes.func.isRequired,
};

AccessibleButton.defaultProps = {
    element: 'div',
};

AccessibleButton.displayName = "AccessibleButton";
