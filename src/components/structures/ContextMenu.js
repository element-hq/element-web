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

import React, {useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Key} from "../../Keyboard";
import * as sdk from "../../index";
import AccessibleButton from "../views/elements/AccessibleButton";
import StyledCheckbox from "../views/elements/StyledCheckbox";
import StyledRadioButton from "../views/elements/StyledRadioButton";

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

const ARIA_MENU_ITEM_ROLES = new Set(["menuitem", "menuitemcheckbox", "menuitemradio"]);
// Generic ContextMenu Portal wrapper
// all options inside the menu should be of role=menuitem/menuitemcheckbox/menuitemradiobutton and have tabIndex={-1}
// this will allow the ContextMenu to manage its own focus using arrow keys as per the ARIA guidelines.
export class ContextMenu extends React.Component {
    static propTypes = {
        top: PropTypes.number,
        bottom: PropTypes.number,
        left: PropTypes.number,
        right: PropTypes.number,
        menuWidth: PropTypes.number,
        menuHeight: PropTypes.number,
        chevronOffset: PropTypes.number,
        chevronFace: PropTypes.string, // top, bottom, left, right or none
        // Function to be called on menu close
        onFinished: PropTypes.func.isRequired,
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

        managed: PropTypes.bool, // whether this context menu should be focus managed. If false it must handle itself
    };

    static defaultProps = {
        hasBackground: true,
        managed: true,
    };

    constructor() {
        super();
        this.state = {
            contextMenuElem: null,
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

        let first = element.querySelector('[role^="menuitem"]');
        if (!first) {
            first = element.querySelector('[tab-index]');
        }
        if (first) {
            first.focus();
        }

        this.setState({
            contextMenuElem: element,
        });
    };

    onContextMenu = (e) => {
        if (this.props.onFinished) {
            this.props.onFinished();

            e.preventDefault();
            e.stopPropagation();
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

    onContextMenuPreventBubbling = (e) => {
        // stop propagation so that any context menu handlers don't leak out of this context menu
        // but do not inhibit the default browser menu
        e.stopPropagation();
    };

    // Prevent clicks on the background from going through to the component which opened the menu.
    _onFinished = (ev: InputEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (this.props.onFinished) this.props.onFinished();
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

    _onMoveFocusHomeEnd = (element, up) => {
        let results = element.querySelectorAll('[role^="menuitem"]');
        if (!results) {
            results = element.querySelectorAll('[tab-index]');
        }
        if (results && results.length) {
            if (up) {
                results[0].focus();
            } else {
                results[results.length - 1].focus();
            }
        }
    };

    _onKeyDown = (ev) => {
        if (!this.props.managed) {
            if (ev.key === Key.ESCAPE) {
                this.props.onFinished();
                ev.stopPropagation();
                ev.preventDefault();
            }
            return;
        }

        let handled = true;

        switch (ev.key) {
            case Key.TAB:
            case Key.ESCAPE:
                this.props.onFinished();
                break;
            case Key.ARROW_UP:
                this._onMoveFocus(ev.target, true);
                break;
            case Key.ARROW_DOWN:
                this._onMoveFocus(ev.target, false);
                break;
            case Key.HOME:
                this._onMoveFocusHomeEnd(this.state.contextMenuElem, true);
                break;
            case Key.END:
                this._onMoveFocusHomeEnd(this.state.contextMenuElem, false);
                break;
            default:
                handled = false;
        }

        if (handled) {
            // consume all other keys in context menu
            ev.stopPropagation();
            ev.preventDefault();
        }
    };

    renderMenu(hasBackground=this.props.hasBackground) {
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

        const contextMenuRect = this.state.contextMenuElem ? this.state.contextMenuElem.getBoundingClientRect() : null;

        const chevronOffset = {};
        if (props.chevronFace) {
            chevronFace = props.chevronFace;
        }
        const hasChevron = chevronFace && chevronFace !== "none";

        if (chevronFace === 'top' || chevronFace === 'bottom') {
            chevronOffset.left = props.chevronOffset;
        } else if (position.top !== undefined) {
            const target = position.top;

            // By default, no adjustment is made
            let adjusted = target;

            // If we know the dimensions of the context menu, adjust its position
            // such that it does not leave the (padded) window.
            if (contextMenuRect) {
                const padding = 10;
                adjusted = Math.min(position.top, document.body.clientHeight - contextMenuRect.height + padding);
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
        if (hasBackground) {
            background = (
                <div className="mx_ContextualMenu_background" style={wrapperStyle} onClick={this._onFinished} onContextMenu={this.onContextMenu} />
            );
        }

        return (
            <div className="mx_ContextualMenu_wrapper" style={{...position, ...wrapperStyle}} onKeyDown={this._onKeyDown} onContextMenu={this.onContextMenuPreventBubbling}>
                <div className={menuClasses} style={menuStyle} ref={this.collectContextMenuRect} role={this.props.managed ? "menu" : undefined}>
                    { chevron }
                    { props.children }
                </div>
                { background }
            </div>
        );
    }

    render() {
        return ReactDOM.createPortal(this.renderMenu(), getOrCreateContainer());
    }
}

// Semantic component for representing the AccessibleButton which launches a <ContextMenu />
export const ContextMenuButton = ({ label, isExpanded, children, onClick, onContextMenu, ...props }) => {
    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    return (
        <AccessibleButton
            {...props}
            onClick={onClick}
            onContextMenu={onContextMenu || onClick}
            title={label}
            aria-label={label}
            aria-haspopup={true}
            aria-expanded={isExpanded}
        >
            { children }
        </AccessibleButton>
    );
};
ContextMenuButton.propTypes = {
    ...AccessibleButton.propTypes,
    label: PropTypes.string,
    isExpanded: PropTypes.bool.isRequired, // whether or not the context menu is currently open
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
    ...AccessibleButton.propTypes,
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
    ...AccessibleButton.propTypes,
    label: PropTypes.string, // optional
    active: PropTypes.bool.isRequired,
    disabled: PropTypes.bool, // optional
    className: PropTypes.string, // optional
    onClick: PropTypes.func.isRequired,
};

// Semantic component for representing a styled role=menuitemcheckbox
export const StyledMenuItemCheckbox = ({children, label, onChange, onClose, checked, disabled=false, ...props}) => {
    const onKeyDown = (e) => {
        if (e.key === Key.ENTER || e.key === Key.SPACE) {
            e.stopPropagation();
            e.preventDefault();
            onChange();
            // Implements https://www.w3.org/TR/wai-aria-practices/#keyboard-interaction-12
            if (e.key === Key.ENTER) {
                onClose();
            }
        }
    };
    const onKeyUp = (e) => {
        // prevent the input default handler as we handle it on keydown to match
        // https://www.w3.org/TR/wai-aria-practices/examples/menubar/menubar-2/menubar-2.html
        if (e.key === Key.SPACE || e.key === Key.ENTER) {
            e.stopPropagation();
            e.preventDefault();
        }
    };
    return (
        <StyledCheckbox
            {...props}
            role="menuitemcheckbox"
            aria-checked={checked}
            checked={checked}
            aria-disabled={disabled}
            tabIndex={-1}
            aria-label={label}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
        >
            { children }
        </StyledCheckbox>
    );
};
StyledMenuItemCheckbox.propTypes = {
    ...StyledCheckbox.propTypes,
    label: PropTypes.string, // optional
    checked: PropTypes.bool.isRequired,
    disabled: PropTypes.bool, // optional
    className: PropTypes.string, // optional
    onChange: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired, // gets called after onChange on Key.ENTER
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
    ...AccessibleButton.propTypes,
    label: PropTypes.string, // optional
    active: PropTypes.bool.isRequired,
    disabled: PropTypes.bool, // optional
    className: PropTypes.string, // optional
    onClick: PropTypes.func.isRequired,
};

// Semantic component for representing a styled role=menuitemradio
export const StyledMenuItemRadio = ({children, label, onChange, onClose, checked=false, disabled=false, ...props}) => {
    const onKeyDown = (e) => {
        if (e.key === Key.ENTER || e.key === Key.SPACE) {
            e.stopPropagation();
            e.preventDefault();
            onChange();
            // Implements https://www.w3.org/TR/wai-aria-practices/#keyboard-interaction-12
            if (e.key === Key.ENTER) {
                onClose();
            }
        }
    };
    const onKeyUp = (e) => {
        // prevent the input default handler as we handle it on keydown to match
        // https://www.w3.org/TR/wai-aria-practices/examples/menubar/menubar-2/menubar-2.html
        if (e.key === Key.SPACE || e.key === Key.ENTER) {
            e.stopPropagation();
            e.preventDefault();
        }
    };
    return (
        <StyledRadioButton
            {...props}
            role="menuitemradio"
            aria-checked={checked}
            checked={checked}
            aria-disabled={disabled}
            tabIndex={-1}
            aria-label={label}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
        >
            { children }
        </StyledRadioButton>
    );
};
StyledMenuItemRadio.propTypes = {
    ...StyledMenuItemRadio.propTypes,
    label: PropTypes.string, // optional
    checked: PropTypes.bool.isRequired,
    disabled: PropTypes.bool, // optional
    className: PropTypes.string, // optional
    onChange: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired, // gets called after onChange on Key.ENTER
};

// Placement method for <ContextMenu /> to position context menu to right of elementRect with chevronOffset
export const toRightOf = (elementRect, chevronOffset=12) => {
    const left = elementRect.right + window.pageXOffset + 3;
    let top = elementRect.top + (elementRect.height / 2) + window.pageYOffset;
    top -= chevronOffset + 8; // where 8 is half the height of the chevron
    return {left, top, chevronOffset};
};

// Placement method for <ContextMenu /> to position context menu right-aligned and flowing to the left of elementRect
export const aboveLeftOf = (elementRect, chevronFace="none") => {
    const menuOptions = { chevronFace };

    const buttonRight = elementRect.right + window.pageXOffset;
    const buttonBottom = elementRect.bottom + window.pageYOffset;
    const buttonTop = elementRect.top + window.pageYOffset;
    // Align the right edge of the menu to the right edge of the button
    menuOptions.right = window.innerWidth - buttonRight;
    // Align the menu vertically on whichever side of the button has more space available.
    if (buttonBottom < window.innerHeight / 2) {
        menuOptions.top = buttonBottom;
    } else {
        menuOptions.bottom = window.innerHeight - buttonTop;
    }

    return menuOptions;
};

export const useContextMenu = () => {
    const button = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const open = () => {
        setIsOpen(true);
    };
    const close = () => {
        setIsOpen(false);
    };

    return [isOpen, button, open, close, setIsOpen];
};

export default class LegacyContextMenu extends ContextMenu {
    render() {
        return this.renderMenu(false);
    }
}

// XXX: Deprecated, used only for dynamic Tooltips. Avoid using at all costs.
export function createMenu(ElementClass, props) {
    const onFinished = function(...args) {
        ReactDOM.unmountComponentAtNode(getOrCreateContainer());

        if (props && props.onFinished) {
            props.onFinished.apply(null, args);
        }
    };

    const menu = <LegacyContextMenu
        {...props}
        onFinished={onFinished} // eslint-disable-line react/jsx-no-bind
        windowResize={onFinished} // eslint-disable-line react/jsx-no-bind
    >
        <ElementClass {...props} onFinished={onFinished} />
    </LegacyContextMenu>;

    ReactDOM.render(menu, getOrCreateContainer());

    return {close: onFinished};
}
