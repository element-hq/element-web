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
        chevronFace: PropTypes.string, // top, bottom, left, right or none
        // Function to be called on menu close
        onFinished: PropTypes.func,
        menuPaddingTop: PropTypes.number,
        menuPaddingRight: PropTypes.number,
        menuPaddingBottom: PropTypes.number,
        menuPaddingLeft: PropTypes.number,
        zIndex: PropTypes.number,

        // If true, insert an invisible screen-sized element behind the
        // menu that when clicked will close it.
        hasBackground: PropTypes.bool,

        // The component to render as the context menu
        elementClass: PropTypes.element.isRequired,
        // on resize callback
        windowResize: PropTypes.func,
        // method to close menu
        closeMenu: PropTypes.func,
    };

    constructor() {
        super();
        this.state = {
            contextMenuRect: null,
        };

        this.onContextMenu = this.onContextMenu.bind(this);
        this.collectContextMenuRect = this.collectContextMenuRect.bind(this);
    }

    collectContextMenuRect(element) {
        // We don't need to clean up when unmounting, so ignore
        if (!element) return;

        this.setState({
            contextMenuRect: element.getBoundingClientRect(),
        });
    }

    onContextMenu(e) {
        if (this.props.closeMenu) {
            this.props.closeMenu();

            e.preventDefault();
            const x = e.clientX;
            const y = e.clientY;

            // XXX: This isn't pretty but the only way to allow opening a different context menu on right click whilst
            // a context menu and its click-guard are up without completely rewriting how the context menus work.
            setImmediate(() => {
                const clickEvent = document.createEvent('MouseEvents');
                clickEvent.initMouseEvent(
                    'contextmenu', true, true, window, 0,
                    0, 0, x, y, false, false,
                    false, false, 0, null,
                );
                document.elementFromPoint(x, y).dispatchEvent(clickEvent);
            });
        }
    }

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

        const contextMenuRect = this.state.contextMenuRect || null;
        const padding = 10;

        const chevronOffset = {};
        if (props.chevronFace) {
            chevronFace = props.chevronFace;
        }
        const hasChevron = chevronFace && chevronFace !== "none";

        if (chevronFace === 'top' || chevronFace === 'bottom') {
            chevronOffset.left = props.chevronOffset;
        } else {
            const target = position.top;

            // By default, no adjustment is made
            let adjusted = target;

            // If we know the dimensions of the context menu, adjust its position
            // such that it does not leave the (padded) window.
            if (contextMenuRect) {
                adjusted = Math.min(position.top, document.body.clientHeight - contextMenuRect.height - padding);
            }

            position.top = adjusted;
            chevronOffset.top = Math.max(props.chevronOffset, props.chevronOffset + target - adjusted);
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

        const chevron = hasChevron ?
            <div style={chevronOffset} className={"mx_ContextualMenu_chevron_" + chevronFace} /> :
            undefined;
        const className = 'mx_ContextualMenu_wrapper';

        const menuClasses = classNames({
            'mx_ContextualMenu': true,
            'mx_ContextualMenu_noChevron': chevronFace === 'none',
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

        const wrapperStyle = {};
        if (!isNaN(Number(props.zIndex))) {
            menuStyle["zIndex"] = props.zIndex + 1;
            wrapperStyle["zIndex"] = props.zIndex;
        }

        const ElementClass = props.elementClass;

        // FIXME: If a menu uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the menu from a button click!
        return <div className={className} style={{...position, ...wrapperStyle}}>
            <div className={menuClasses} style={menuStyle} ref={this.collectContextMenuRect}>
                { chevron }
                <ElementClass {...props} onFinished={props.closeMenu} onResize={props.windowResize} />
            </div>
            { props.hasBackground && <div className="mx_ContextualMenu_background" style={wrapperStyle}
                                          onClick={props.closeMenu} onContextMenu={this.onContextMenu} /> }
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
