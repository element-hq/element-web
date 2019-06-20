/*
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
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const InteractiveTooltipContainerId = "mx_InteractiveTooltip_Container";

function getOrCreateContainer() {
    let container = document.getElementById(InteractiveTooltipContainerId);

    if (!container) {
        container = document.createElement("div");
        container.id = InteractiveTooltipContainerId;
        document.body.appendChild(container);
    }

    return container;
}

export default class InteractiveTooltip extends React.Component {
    propTypes: {
        top: PropTypes.number,
        bottom: PropTypes.number,
        left: PropTypes.number,
        right: PropTypes.number,
        chevronOffset: PropTypes.number,
        chevronFace: PropTypes.string, // top, bottom, left, right or none
        // Function to be called on menu close
        onFinished: PropTypes.func,

        // If true, insert an invisible screen-sized element behind the
        // menu that when clicked will close it.
        hasBackground: PropTypes.bool,

        // The component to render as the context menu
        elementClass: PropTypes.element.isRequired,
        // on resize callback
        windowResize: PropTypes.func,
        // method to close menu
        closeTooltip: PropTypes.func,
    };

    render() {
        const position = {};
        let chevronFace = null;
        const props = this.props;

        if (props.top) {
            position.top = props.top;
        } else {
            position.bottom = props.bottom;
        }

        if (props.left) {
            position.left = props.left;
            chevronFace = 'left';
        } else {
            position.right = props.right;
            chevronFace = 'right';
        }

        const chevronOffset = {};
        if (props.chevronFace) {
            chevronFace = props.chevronFace;
        }
        const hasChevron = chevronFace && chevronFace !== "none";

        if (chevronFace === 'top' || chevronFace === 'bottom') {
            chevronOffset.left = props.chevronOffset;
        } else {
            chevronOffset.top = props.chevronOffset;
        }

        const chevron = hasChevron ?
            <div style={chevronOffset} className={"mx_InteractiveTooltip_chevron_" + chevronFace} /> :
            undefined;
        const className = 'mx_InteractiveTooltip_wrapper';

        const menuClasses = classNames({
            'mx_InteractiveTooltip': true,
            'mx_InteractiveTooltip_left': !hasChevron && position.left,
            'mx_InteractiveTooltip_right': !hasChevron && position.right,
            'mx_InteractiveTooltip_top': !hasChevron && position.top,
            'mx_InteractiveTooltip_bottom': !hasChevron && position.bottom,
            'mx_InteractiveTooltip_withChevron_left': chevronFace === 'left',
            'mx_InteractiveTooltip_withChevron_right': chevronFace === 'right',
            'mx_InteractiveTooltip_withChevron_top': chevronFace === 'top',
            'mx_InteractiveTooltip_withChevron_bottom': chevronFace === 'bottom',
        });

        const ElementClass = props.elementClass;

        return <div className={className} style={{...position}}>
            <div className={menuClasses}>
                { chevron }
                <ElementClass {...props} onFinished={props.closeTooltip} onResize={props.windowResize} />
            </div>
            { props.hasBackground && <div className="mx_InteractiveTooltip_background"
                                          onClick={props.closeTooltip} /> }
        </div>;
    }
}

export function createTooltip(ElementClass, props, hasBackground=true) {
    const closeTooltip = function(...args) {
        ReactDOM.unmountComponentAtNode(getOrCreateContainer());

        if (props && props.onFinished) {
            props.onFinished.apply(null, args);
        }
    };

    // We only reference closeTooltip once per call to createTooltip
    const menu = <InteractiveTooltip
        hasBackground={hasBackground}
        {...props}
        elementClass={ElementClass}
        closeTooltip={closeTooltip} // eslint-disable-line react/jsx-no-bind
        windowResize={closeTooltip} // eslint-disable-line react/jsx-no-bind
    />;

    ReactDOM.render(menu, getOrCreateContainer());

    return {close: closeTooltip};
}
