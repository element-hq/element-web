/*
Copyright 2015, 2016 OpenMarket Ltd
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
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {focusCapturedRef} from "../../utils/Accessibility";
import {Key, KeyCode} from "../../Keyboard";
import {_t} from "../../languageHandler";
import sdk from "../../index";

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
        closeMenu: PropTypes.func.isRequired,
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

        // For screen readers to find the thing
        focusCapturedRef(element);

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

    _onKeyDown = (ev) => {
        if (ev.keyCode === KeyCode.ESCAPE) {
            ev.stopPropagation();
            ev.preventDefault();
            this.props.closeMenu();
        }
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

        const chevron = hasChevron ?
            <div style={chevronOffset} className={"mx_ContextualMenu_chevron_" + chevronFace} /> :
            undefined;
        const className = 'mx_ContextualMenu_wrapper';

        const menuClasses = classNames({
            'mx_ContextualMenu': true,
            'mx_ContextualMenu_left': !hasChevron && position.left,
            'mx_ContextualMenu_right': !hasChevron && position.right,
            'mx_ContextualMenu_top': !hasChevron && position.top,
            'mx_ContextualMenu_bottom': !hasChevron && position.bottom,
            'mx_ContextualMenu_withChevron_left': chevronFace === 'left',
            'mx_ContextualMenu_withChevron_right': chevronFace === 'right',
            'mx_ContextualMenu_withChevron_top': chevronFace === 'top',
            'mx_ContextualMenu_withChevron_bottom': chevronFace === 'bottom',
        });

        const menuStyle = {};
        if (props.menuWidth) {
            menuStyle.width = props.menuWidth;
        }

        if (props.menuHeight) {
            menuStyle.height = props.menuHeight;
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
        return <div className={className} style={{...position, ...wrapperStyle}} onKeyDown={this._onKeyDown}>
            <div className={menuClasses} style={menuStyle} ref={this.collectContextMenuRect} tabIndex={0}>
                { chevron }
                <ElementClass {...props} onFinished={props.closeMenu} onResize={props.windowResize} />
            </div>
            { props.hasBackground && <div className="mx_ContextualMenu_background" style={wrapperStyle}
                                          onClick={props.closeMenu} onContextMenu={this.onContextMenu} /> }
        </div>;
    }
}

const ARIA_MENU_ITEM_ROLES = new Set(["menuitem", "menuitemcheckbox", "menuitemradio"]);

class ContextualMenu2 extends React.Component {
    propTypes: {
        top: PropTypes.number,
        bottom: PropTypes.number,
        left: PropTypes.number,
        right: PropTypes.number,
        menuWidth: PropTypes.number,
        menuHeight: PropTypes.number,
        chevronOffset: PropTypes.number,
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

        // on resize callback
        windowResize: PropTypes.func,
    };

    constructor() {
        super();
        this.state = {
            contextMenuRect: null,
        };

        // persist what had focus when we got initialized so we can return it after
        this.initialFocus = document.activeElement;
    }

    componentWillUnmount() {
        // return focus to the thing which had it before us
        this.initialFocus.focus();
    }

    collectContextMenuRect = (element) => {
        // We don't need to clean up when unmounting, so ignore
        if (!element) return;

        const first = element.querySelector('[role^="menuitem"]');
        if (first) {
            first.focus();
        }

        this.setState({
            contextMenuRect: element.getBoundingClientRect(),
        });
    };

    onContextMenu = (e) => {
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
    };

    _onMoveFocus = (element, up) => {
        let descending = false; // are we currently descending or ascending through the DOM tree?

        do {
            const child = up ? element.lastElementChild : element.firstElementChild;
            const sibling = up ? element.previousElementSibling : element.nextElementSibling;

            if (descending) {
                if (child) {
                    element = child;
                } else if (sibling) {
                    element = sibling;
                } else {
                    descending = false;
                    element = element.parentElement;
                }
            } else {
                if (sibling) {
                    element = sibling;
                    descending = true;
                } else {
                    element = element.parentElement;
                }
            }

            if (element) {
                if (element.classList.contains("mx_ContextualMenu")) { // we hit the top
                    element = up ? element.lastElementChild : element.firstElementChild;
                    descending = true;
                }
            }
        } while (element && !ARIA_MENU_ITEM_ROLES.has(element.getAttribute("role")));

        if (element) {
            element.focus();
        }
    };

    _onKeyDown = (ev) => {
        let handled = true;

        switch (ev.key) {
            case Key.TAB:
            case Key.ESCAPE:
                this.props.closeMenu();
                break;
            case Key.ARROW_UP:
                this._onMoveFocus(ev.target, true);
                break;
            case Key.ARROW_DOWN:
                this._onMoveFocus(ev.target, false);
                break;
            default:
                handled = false;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
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

        let chevron;
        if (hasChevron) {
            chevron = <div style={chevronOffset} className={"mx_ContextualMenu_chevron_" + chevronFace} />;
        }

        const menuClasses = classNames({
            'mx_ContextualMenu': true,
            'mx_ContextualMenu_left': !hasChevron && position.left,
            'mx_ContextualMenu_right': !hasChevron && position.right,
            'mx_ContextualMenu_top': !hasChevron && position.top,
            'mx_ContextualMenu_bottom': !hasChevron && position.bottom,
            'mx_ContextualMenu_withChevron_left': chevronFace === 'left',
            'mx_ContextualMenu_withChevron_right': chevronFace === 'right',
            'mx_ContextualMenu_withChevron_top': chevronFace === 'top',
            'mx_ContextualMenu_withChevron_bottom': chevronFace === 'bottom',
        });

        const menuStyle = {};
        if (props.menuWidth) {
            menuStyle.width = props.menuWidth;
        }

        if (props.menuHeight) {
            menuStyle.height = props.menuHeight;
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

        let background;
        if (props.hasBackground) {
            background = (
                <div className="mx_ContextualMenu_background" style={wrapperStyle} onClick={props.closeMenu} onContextMenu={this.onContextMenu} />
            );
        }

        return (
            <div className="mx_ContextualMenu_wrapper" style={{...position, ...wrapperStyle}} onKeyDown={this._onKeyDown}>
                <div className={menuClasses} style={menuStyle} ref={this.collectContextMenuRect}>
                    { chevron }
                    { props.children }
                </div>
                { background }
            </div>
        );
    }
}

// Generic ContextMenu Portal wrapper
// all options inside the menu should be of role=menuitem/menuitemcheckbox/menuitemradiobutton and have tabIndex={-1}
// this will allow the ContextMenu to manage its own focus using arrow keys as per the ARIA guidelines.

export const ContextMenu = ({children, onFinished, props, hasBackground=true}) => {
    const menu = <ContextualMenu2
        {...props}
        hasBackground={hasBackground}
        closeMenu={onFinished}
        windowResize={onFinished}
    >
        { children }
    </ContextualMenu2>;

    return ReactDOM.createPortal(menu, getOrCreateContainer());
};

// Semantic component for representing a role=menuitem
export const MenuItem = ({children, label, ...props}) => {
    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    return (
        <AccessibleButton {...props} role="menuitem" tabIndex={-1} aria-label={label}>
            { children }
        </AccessibleButton>
    );
};
MenuItem.propTypes = {
    label: PropTypes.string, // optional
    className: PropTypes.string, // optional
    onClick: PropTypes.func.isRequired,
};

// Semantic component for representing a role=group for grouping menu radios/checkboxes
export const MenuGroup = ({children, label, ...props}) => {
    return <div {...props} role="group" aria-label={label}>
        { children }
    </div>;
};
MenuGroup.propTypes = {
    label: PropTypes.string.isRequired,
    className: PropTypes.string, // optional
};

// Semantic component for representing a role=menuitemcheckbox
export const MenuItemCheckbox = ({children, label, active=false, disabled=false, ...props}) => {
    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    return (
        <AccessibleButton {...props} role="menuitemcheckbox" aria-checked={active} aria-disabled={disabled} tabIndex={-1} aria-label={label}>
            { children }
        </AccessibleButton>
    );
};
MenuItemCheckbox.propTypes = {
    label: PropTypes.string, // optional
    active: PropTypes.bool.isRequired,
    disabled: PropTypes.bool, // optional
    className: PropTypes.string, // optional
    onClick: PropTypes.func.isRequired,
};

// Semantic component for representing a role=menuitemradio
export const MenuItemRadio = ({children, label, active=false, disabled=false, ...props}) => {
    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    return (
        <AccessibleButton {...props} role="menuitemradio" aria-checked={active} aria-disabled={disabled} tabIndex={-1} aria-label={label}>
            { children }
        </AccessibleButton>
    );
};
MenuItemRadio.propTypes = {
    label: PropTypes.string, // optional
    active: PropTypes.bool.isRequired,
    disabled: PropTypes.bool, // optional
    className: PropTypes.string, // optional
    onClick: PropTypes.func.isRequired,
};

// Placement method for <ContextMenu /> to position context menu to right of elementRect with chevronOffset
export const toRightOf = (elementRect, chevronOffset=12) => {
    const left = elementRect.right + window.pageXOffset + 3;
    let top = (elementRect.top + (elementRect.height / 2) + window.pageYOffset);
    top = top - (chevronOffset + 8); // where 8 is half the height of the chevron
    return {left, top};
};

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
