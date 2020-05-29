/*
Copyright 2017 Vector Creations Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import AccessibleButton from './AccessibleButton';
import { _t } from '../../../languageHandler';
import {Key} from "../../../Keyboard";

class MenuOption extends React.Component {
    constructor(props) {
        super(props);
        this._onMouseEnter = this._onMouseEnter.bind(this);
        this._onClick = this._onClick.bind(this);
    }

    static defaultProps = {
        disabled: false,
    };

    _onMouseEnter() {
        this.props.onMouseEnter(this.props.dropdownKey);
    }

    _onClick(e) {
        e.preventDefault();
        e.stopPropagation();
        this.props.onClick(this.props.dropdownKey);
    }

    render() {
        const optClasses = classnames({
            mx_Dropdown_option: true,
            mx_Dropdown_option_highlight: this.props.highlighted,
        });

        return <div
            id={this.props.id}
            className={optClasses}
            onClick={this._onClick}
            onMouseEnter={this._onMouseEnter}
            role="option"
            aria-selected={this.props.highlighted}
            ref={this.props.inputRef}
        >
            { this.props.children }
        </div>;
    }
}

MenuOption.propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.node),
      PropTypes.node,
    ]),
    highlighted: PropTypes.bool,
    dropdownKey: PropTypes.string,
    onClick: PropTypes.func.isRequired,
    onMouseEnter: PropTypes.func.isRequired,
    inputRef: PropTypes.any,
};

/*
 * Reusable dropdown select control, akin to react-select,
 * but somewhat simpler as react-select is 79KB of minified
 * javascript.
 *
 * TODO: Port NetworkDropdown to use this.
 */
export default class Dropdown extends React.Component {
    constructor(props) {
        super(props);

        this.dropdownRootElement = null;
        this.ignoreEvent = null;

        this._onInputClick = this._onInputClick.bind(this);
        this._onRootClick = this._onRootClick.bind(this);
        this._onDocumentClick = this._onDocumentClick.bind(this);
        this._onMenuOptionClick = this._onMenuOptionClick.bind(this);
        this._onInputChange = this._onInputChange.bind(this);
        this._collectRoot = this._collectRoot.bind(this);
        this._collectInputTextBox = this._collectInputTextBox.bind(this);
        this._setHighlightedOption = this._setHighlightedOption.bind(this);

        this.inputTextBox = null;

        this._reindexChildren(this.props.children);

        const firstChild = React.Children.toArray(props.children)[0];

        this.state = {
            // True if the menu is dropped-down
            expanded: false,
            // The key of the highlighted option
            // (the option that would become selected if you pressed enter)
            highlightedOption: firstChild ? firstChild.key : null,
            // the current search query
            searchQuery: '',
        };
    }

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount() { // eslint-disable-line camelcase
        this._button = createRef();
        // Listen for all clicks on the document so we can close the
        // menu when the user clicks somewhere else
        document.addEventListener('click', this._onDocumentClick, false);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this._onDocumentClick, false);
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(nextProps) { // eslint-disable-line camelcase
        if (!nextProps.children || nextProps.children.length === 0) {
            return;
        }
        this._reindexChildren(nextProps.children);
        const firstChild = nextProps.children[0];
        this.setState({
            highlightedOption: firstChild ? firstChild.key : null,
        });
    }

    _reindexChildren(children) {
        this.childrenByKey = {};
        React.Children.forEach(children, (child) => {
            this.childrenByKey[child.key] = child;
        });
    }

    _onDocumentClick(ev) {
        // Close the dropdown if the user clicks anywhere that isn't
        // within our root element
        if (ev !== this.ignoreEvent) {
            this.setState({
                expanded: false,
            });
        }
    }

    _onRootClick(ev) {
        // This captures any clicks that happen within our elements,
        // such that we can then ignore them when they're seen by the
        // click listener on the document handler, ie. not close the
        // dropdown immediately after opening it.
        // NB. We can't just stopPropagation() because then the event
        // doesn't reach the React onClick().
        this.ignoreEvent = ev;
    }

    _onInputClick(ev) {
        if (this.props.disabled) return;

        if (!this.state.expanded) {
            this.setState({
                expanded: true,
            });
            ev.preventDefault();
        }
    }

    _close() {
        this.setState({
            expanded: false,
        });
        // their focus was on the input, its getting unmounted, move it to the button
        if (this._button.current) {
            this._button.current.focus();
        }
    }

    _onMenuOptionClick(dropdownKey) {
        this._close();
        this.props.onOptionChange(dropdownKey);
    }

    _onInputKeyDown = (e) => {
        let handled = true;

        // These keys don't generate keypress events and so needs to be on keyup
        switch (e.key) {
            case Key.ENTER:
                this.props.onOptionChange(this.state.highlightedOption);
                // fallthrough
            case Key.ESCAPE:
                this._close();
                break;
            case Key.ARROW_DOWN:
                this.setState({
                    highlightedOption: this._nextOption(this.state.highlightedOption),
                });
                break;
            case Key.ARROW_UP:
                this.setState({
                    highlightedOption: this._prevOption(this.state.highlightedOption),
                });
                break;
            default:
                handled = false;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    _onInputChange(e) {
        this.setState({
            searchQuery: e.target.value,
        });
        if (this.props.onSearchChange) {
            this.props.onSearchChange(e.target.value);
        }
    }

    _collectRoot(e) {
        if (this.dropdownRootElement) {
            this.dropdownRootElement.removeEventListener(
                'click', this._onRootClick, false,
            );
        }
        if (e) {
            e.addEventListener('click', this._onRootClick, false);
        }
        this.dropdownRootElement = e;
    }

    _collectInputTextBox(e) {
        this.inputTextBox = e;
        if (e) e.focus();
    }

    _setHighlightedOption(optionKey) {
        this.setState({
            highlightedOption: optionKey,
        });
    }

    _nextOption(optionKey) {
        const keys = Object.keys(this.childrenByKey);
        const index = keys.indexOf(optionKey);
        return keys[(index + 1) % keys.length];
    }

    _prevOption(optionKey) {
        const keys = Object.keys(this.childrenByKey);
        const index = keys.indexOf(optionKey);
        return keys[(index - 1) % keys.length];
    }

    _scrollIntoView(node) {
        if (node) {
            node.scrollIntoView({
                block: "nearest",
                behavior: "auto",
            });
        }
    }

    _getMenuOptions() {
        const options = React.Children.map(this.props.children, (child) => {
            const highlighted = this.state.highlightedOption === child.key;
            return (
                <MenuOption
                    id={`${this.props.id}__${child.key}`}
                    key={child.key}
                    dropdownKey={child.key}
                    highlighted={highlighted}
                    onMouseEnter={this._setHighlightedOption}
                    onClick={this._onMenuOptionClick}
                    inputRef={highlighted ? this._scrollIntoView : undefined}
                >
                    { child }
                </MenuOption>
            );
        });
        if (options.length === 0) {
            return [<div key="0" className="mx_Dropdown_option" role="option">
                { _t("No results") }
            </div>];
        }
        return options;
    }

    render() {
        let currentValue;

        const menuStyle = {};
        if (this.props.menuWidth) menuStyle.width = this.props.menuWidth;

        let menu;
        if (this.state.expanded) {
            if (this.props.searchEnabled) {
                currentValue = (
                    <input
                        type="text"
                        className="mx_Dropdown_option"
                        ref={this._collectInputTextBox}
                        onKeyDown={this._onInputKeyDown}
                        onChange={this._onInputChange}
                        value={this.state.searchQuery}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-activedescendant={`${this.props.id}__${this.state.highlightedOption}`}
                        aria-owns={`${this.props.id}_listbox`}
                        aria-disabled={this.props.disabled}
                        aria-label={this.props.label}
                    />
                );
            }
            menu = (
                <div className="mx_Dropdown_menu" style={menuStyle} role="listbox" id={`${this.props.id}_listbox`}>
                    { this._getMenuOptions() }
                </div>
            );
        }

        if (!currentValue) {
            const selectedChild = this.props.getShortOption ?
                this.props.getShortOption(this.props.value) :
                this.childrenByKey[this.props.value];
            currentValue = <div className="mx_Dropdown_option" id={`${this.props.id}_value`}>
                { selectedChild }
            </div>;
        }

        const dropdownClasses = {
            mx_Dropdown: true,
            mx_Dropdown_disabled: this.props.disabled,
        };
        if (this.props.className) {
            dropdownClasses[this.props.className] = true;
        }

        // Note the menu sits inside the AccessibleButton div so it's anchored
        // to the input, but overflows below it. The root contains both.
        return <div className={classnames(dropdownClasses)} ref={this._collectRoot}>
            <AccessibleButton
                className="mx_Dropdown_input mx_no_textinput"
                onClick={this._onInputClick}
                aria-haspopup="listbox"
                aria-expanded={this.state.expanded}
                disabled={this.props.disabled}
                inputRef={this._button}
                aria-label={this.props.label}
                aria-describedby={`${this.props.id}_value`}
            >
                { currentValue }
                <span className="mx_Dropdown_arrow" />
                { menu }
            </AccessibleButton>
        </div>;
    }
}

Dropdown.propTypes = {
    id: PropTypes.string.isRequired,
    // The width that the dropdown should be. If specified,
    // the dropped-down part of the menu will be set to this
    // width.
    menuWidth: PropTypes.number,
    // Called when the selected option changes
    onOptionChange: PropTypes.func.isRequired,
    // Called when the value of the search field changes
    onSearchChange: PropTypes.func,
    searchEnabled: PropTypes.bool,
    // Function that, given the key of an option, returns
    // a node representing that option to be displayed in the
    // box itself as the currently-selected option (ie. as
    // opposed to in the actual dropped-down part). If
    // unspecified, the appropriate child element is used as
    // in the dropped-down menu.
    getShortOption: PropTypes.func,
    value: PropTypes.string,
    // negative for consistency with HTML
    disabled: PropTypes.bool,
    // ARIA label
    label: PropTypes.string.isRequired,
};
