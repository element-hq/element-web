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

/*
 * This style of tooltip takes a `target` element's rect and centers the tooltip
 * along one edge of the target.
 */
export default class InteractiveTooltip extends React.Component {
    propTypes: {
        // A DOMRect from the target element
        targetRect: PropTypes.object.isRequired,
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

    constructor() {
        super();

        this.state = {
            contentRect: null,
        };
    }

    collectContentRect = (element) => {
        // We don't need to clean up when unmounting, so ignore
        if (!element) return;

        this.setState({
            contentRect: element.getBoundingClientRect(),
        });
    }

    render() {
        const props = this.props;
        const { targetRect } = props;

        // The window X and Y offsets are to adjust position when zoomed in to page
        const targetLeft = targetRect.left + window.pageXOffset;
        const targetBottom = targetRect.bottom + window.pageYOffset;
        const targetTop = targetRect.top + window.pageYOffset;

        // Align the tooltip vertically on whichever side of the target has more
        // space available.
        const position = {};
        let chevronFace = null;
        if (targetBottom < window.innerHeight / 2) {
            position.top = targetBottom;
            chevronFace = "top";
        } else {
            position.bottom = window.innerHeight - targetTop;
            chevronFace = "bottom";
        }

        // Center the tooltip horizontally with the target's center.
        position.left = targetLeft + targetRect.width / 2;

        const chevron = <div className={"mx_InteractiveTooltip_chevron_" + chevronFace} />;

        const menuClasses = classNames({
            'mx_InteractiveTooltip': true,
            'mx_InteractiveTooltip_withChevron_top': chevronFace === 'top',
            'mx_InteractiveTooltip_withChevron_bottom': chevronFace === 'bottom',
        });

        const menuStyle = {};
        if (this.state.contentRect) {
            menuStyle.left = `-${this.state.contentRect.width / 2}px`;
        }

        const ElementClass = props.elementClass;

        return <div className="mx_InteractiveTooltip_wrapper" style={{...position}}>
            <div className={menuClasses} style={menuStyle} ref={this.collectContentRect}>
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
