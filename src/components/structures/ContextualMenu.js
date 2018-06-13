/*
Copyright 2015, 2016 OpenMarket Ltd
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
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Shamelessly ripped off Modal.js.  There's probably a better way
// of doing reusable widgets like dialog boxes & menus where we go and
// pass in a custom control as the actual body.

const ContextualMenuContainerId = "mx_ContextualMenu_Container";

function getOrCreateContainer() {
    let container = document.getElementById(ContextualMenuContainerId);

    if (!container) {
        container = document.createElement("div");
        container.id = ContextualMenuContainerId;
        document.body.appendChild(container);
    }

    return container;
}

export default class ContextualMenu extends React.Component {
    propTypes: {
        top: PropTypes.number,
        bottom: PropTypes.number,
        left: PropTypes.number,
        right: PropTypes.number,
        menuWidth: PropTypes.number,
        menuHeight: PropTypes.number,
        chevronOffset: PropTypes.number,
        menuColour: PropTypes.string,
        chevronFace: PropTypes.string, // top, bottom, left, right
        // Function to be called on menu close
        onFinished: PropTypes.func,
        menuPaddingTop: PropTypes.number,
        menuPaddingRight: PropTypes.number,
        menuPaddingBottom: PropTypes.number,
        menuPaddingLeft: PropTypes.number,

        // If true, insert an invisible screen-sized element behind the
        // menu that when clicked will close it.
        hasBackground: PropTypes.bool,

        // The component to render as the context menu
        elementClass: PropTypes.element.isRequired,
        // on resize callback
        windowResize: PropTypes.func
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
        if (chevronFace === 'top' || chevronFace === 'bottom') {
            chevronOffset.left = props.chevronOffset;
        } else {
            chevronOffset.top = props.chevronOffset;
        }

        // To override the default chevron colour, if it's been set
        let chevronCSS = "";
        if (props.menuColour) {
            chevronCSS = `
                .mx_ContextualMenu_chevron_left:after {
                    border-right-color: ${props.menuColour};
                }
                .mx_ContextualMenu_chevron_right:after {
                    border-left-color: ${props.menuColour};
                }
                .mx_ContextualMenu_chevron_top:after {
                    border-left-color: ${props.menuColour};
                }
                .mx_ContextualMenu_chevron_bottom:after {
                    border-left-color: ${props.menuColour};
                }
            `;
        }

        const chevron = <div style={chevronOffset} className={"mx_ContextualMenu_chevron_" + chevronFace} />;
        const className = 'mx_ContextualMenu_wrapper';

        const menuClasses = classNames({
            'mx_ContextualMenu': true,
            'mx_ContextualMenu_left': chevronFace === 'left',
            'mx_ContextualMenu_right': chevronFace === 'right',
            'mx_ContextualMenu_top': chevronFace === 'top',
            'mx_ContextualMenu_bottom': chevronFace === 'bottom',
        });

        const menuStyle = {};
        if (props.menuWidth) {
            menuStyle.width = props.menuWidth;
        }

        if (props.menuHeight) {
            menuStyle.height = props.menuHeight;
        }

        if (props.menuColour) {
            menuStyle["backgroundColor"] = props.menuColour;
        }

        if (!isNaN(Number(props.menuPaddingTop))) {
            menuStyle["paddingTop"] = props.menuPaddingTop;
        }
        if (!isNaN(Number(props.menuPaddingLeft))) {
            menuStyle["paddingLeft"] = props.menuPaddingLeft;
        }
        if (!isNaN(Number(props.menuPaddingBottom))) {
            menuStyle["paddingBottom"] = props.menuPaddingBottom;
        }
        if (!isNaN(Number(props.menuPaddingRight))) {
            menuStyle["paddingRight"] = props.menuPaddingRight;
        }

        const ElementClass = props.elementClass;

        // FIXME: If a menu uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the menu from a button click!
        return <div className={className} style={position}>
            <div className={menuClasses} style={menuStyle}>
                { chevron }
                <ElementClass {...props} onFinished={props.closeMenu} onResize={props.windowResize} />
            </div>
            { props.hasBackground && <div className="mx_ContextualMenu_background" onClick={props.closeMenu} /> }
            <style>{ chevronCSS }</style>
        </div>;
    }
}

export function createMenu(ElementClass, props, hasBackground=true) {
    const closeMenu = function(...args) {
        ReactDOM.unmountComponentAtNode(getOrCreateContainer());

        if (props && props.onFinished) {
            props.onFinished.apply(null, args);
        }
    };

    // We only reference closeMenu once per call to createMenu
    const menu = <ContextualMenu
        hasBackground={hasBackground}
        {...props}
        elementClass={ElementClass}
        closeMenu={closeMenu} // eslint-disable-line react/jsx-no-bind
        windowResize={closeMenu} // eslint-disable-line react/jsx-no-bind
    />;

    ReactDOM.render(menu, getOrCreateContainer());

    return {close: closeMenu};
}
