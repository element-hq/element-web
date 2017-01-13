/*
 Copyright 2016 Aviral Dasgupta

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

export default function AccessibleButton(props) {
    const {element, onClick, children, ...restProps} = props;
    restProps.onClick = onClick;
    restProps.onKeyDown = function(e) {
        if (e.keyCode == 13 || e.keyCode == 32) return onClick();
    };
    restProps.tabIndex = restProps.tabIndex || "0"; 
    restProps.role = "button";
    if (Array.isArray(children)) {
        return React.createElement(element, restProps, ...children);
    } else {
        return React.createElement(element, restProps, children);
    }
}

AccessibleButton.propTypes = {
    children: React.PropTypes.node,
    element: React.PropTypes.string,
    onClick: React.PropTypes.func.isRequired,
};

AccessibleButton.defaultProps = {
    element: 'div'
};

AccessibleButton.displayName = "AccessibleButton";
