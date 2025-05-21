/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type JSX,
    type ChangeEvent,
    createRef,
    type CSSProperties,
    type ReactElement,
    type ReactNode,
    type Ref,
} from "react";
import classnames from "classnames";

import AccessibleButton, { type ButtonEvent } from "./AccessibleButton";
import { _t } from "../../../languageHandler";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { objectHasDiff } from "../../../utils/objects";
import { type NonEmptyArray } from "../../../@types/common";

interface IMenuOptionProps {
    children: ReactElement;
    highlighted?: boolean;
    dropdownKey: string;
    id?: string;
    inputRef?: Ref<HTMLLIElement>;
    onClick(dropdownKey: string): void;
    onMouseEnter(dropdownKey: string): void;
}

class MenuOption extends React.Component<IMenuOptionProps> {
    public static defaultProps = {
        disabled: false,
    };

    private onMouseEnter = (): void => {
        this.props.onMouseEnter(this.props.dropdownKey);
    };

    private onClick = (e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        this.props.onClick(this.props.dropdownKey);
    };

    public render(): React.ReactNode {
        const optClasses = classnames({
            mx_Dropdown_option: true,
            mx_Dropdown_option_highlight: this.props.highlighted,
        });

        return (
            <li
                id={this.props.id}
                className={optClasses}
                onClick={this.onClick}
                onMouseEnter={this.onMouseEnter}
                role="option"
                aria-selected={this.props.highlighted}
                ref={this.props.inputRef}
            >
                {this.props.children}
            </li>
        );
    }
}

export interface DropdownProps {
    id: string;
    // ARIA label
    label: string;
    value?: string;
    className?: string;
    autoComplete?: string;
    children: NonEmptyArray<ReactElement & { key: string }>;
    // negative for consistency with HTML
    disabled?: boolean;
    // The width that the dropdown should be. If specified,
    // the dropped-down part of the menu will be set to this
    // width.
    menuWidth?: number;
    searchEnabled?: boolean;
    // Placeholder to show when no value is selected
    placeholder?: string;
    // Called when the selected option changes
    onOptionChange(dropdownKey: string): void;
    // Called when the value of the search field changes
    onSearchChange?(query: string): void;
    // Function that, given the key of an option, returns
    // a node representing that option to be displayed in the
    // box itself as the currently-selected option (ie. as
    // opposed to in the actual dropped-down part). If
    // unspecified, the appropriate child element is used as
    // in the dropped-down menu.
    getShortOption?(value: string): ReactNode;
}

interface IState {
    expanded: boolean;
    highlightedOption: string;
    searchQuery: string;
}

/*
 * Reusable dropdown select control, akin to react-select,
 * but somewhat simpler as react-select is 79KB of minified
 * javascript.
 */
export default class Dropdown extends React.Component<DropdownProps, IState> {
    private readonly buttonRef = createRef<HTMLDivElement>();
    private dropdownRootElement: HTMLDivElement | null = null;
    private ignoreEvent: MouseEvent | null = null;
    private childrenByKey: Record<string, ReactNode> = {};

    public constructor(props: DropdownProps) {
        super(props);

        this.reindexChildren(this.props.children);

        const firstChild = props.children[0];

        this.state = {
            // True if the menu is dropped-down
            expanded: false,
            // The key of the highlighted option
            // (the option that would become selected if you pressed enter)
            highlightedOption: firstChild.key,
            // the current search query
            searchQuery: "",
        };
    }

    public componentDidMount(): void {
        // Listen for all clicks on the document so we can close the
        // menu when the user clicks somewhere else
        document.addEventListener("click", this.onDocumentClick, false);
    }

    public componentDidUpdate(prevProps: Readonly<DropdownProps>): void {
        if (objectHasDiff(this.props, prevProps) && this.props.children?.length) {
            this.reindexChildren(this.props.children);
            const firstChild = this.props.children[0];
            this.setState({
                highlightedOption: firstChild.key,
            });
        }
    }

    public componentWillUnmount(): void {
        document.removeEventListener("click", this.onDocumentClick, false);
    }

    private reindexChildren(children: ReactElement[]): void {
        this.childrenByKey = {};
        React.Children.forEach(children, (child) => {
            this.childrenByKey[(child as DropdownProps["children"][number]).key] = child;
        });
    }

    private onDocumentClick = (ev: MouseEvent): void => {
        // Close the dropdown if the user clicks anywhere that isn't
        // within our root element
        if (ev !== this.ignoreEvent) {
            this.setState({
                expanded: false,
            });
        }
    };

    private onRootClick = (ev: MouseEvent): void => {
        // This captures any clicks that happen within our elements,
        // such that we can then ignore them when they're seen by the
        // click listener on the document handler, ie. not close the
        // dropdown immediately after opening it.
        // NB. We can't just stopPropagation() because then the event
        // doesn't reach the React onClick().
        this.ignoreEvent = ev;
    };

    private onAccessibleButtonClick = (ev: ButtonEvent): void => {
        if (this.props.disabled) return;

        const action = getKeyBindingsManager().getAccessibilityAction(ev as React.KeyboardEvent);

        if (!this.state.expanded) {
            this.setState({ expanded: true });
            ev.preventDefault();
        } else if (action === KeyBindingAction.Enter) {
            // the accessible button consumes enter onKeyDown for firing onClick, so handle it here
            this.props.onOptionChange(this.state.highlightedOption);
            this.close();
        } else if (!(ev as React.KeyboardEvent).key) {
            // collapse on other non-keyboard event activations
            this.setState({ expanded: false });
            ev.preventDefault();
        }
    };

    private close(): void {
        this.setState({
            expanded: false,
        });
        // their focus was on the input, its getting unmounted, move it to the button
        if (this.buttonRef.current) {
            this.buttonRef.current.focus();
        }
    }

    private onMenuOptionClick = (dropdownKey: string): void => {
        this.close();
        this.props.onOptionChange(dropdownKey);
    };

    private onKeyDown = (e: React.KeyboardEvent): void => {
        let handled = true;

        // These keys don't generate keypress events and so needs to be on keyup
        const action = getKeyBindingsManager().getAccessibilityAction(e);
        switch (action) {
            case KeyBindingAction.Enter:
                this.props.onOptionChange(this.state.highlightedOption);
            // fallthrough
            case KeyBindingAction.Escape:
                this.close();
                break;
            case KeyBindingAction.ArrowDown:
                if (this.state.expanded) {
                    this.setState({
                        highlightedOption: this.nextOption(this.state.highlightedOption),
                    });
                } else {
                    this.setState({ expanded: true });
                }
                break;
            case KeyBindingAction.ArrowUp:
                if (this.state.expanded) {
                    this.setState({
                        highlightedOption: this.prevOption(this.state.highlightedOption),
                    });
                } else {
                    this.setState({ expanded: true });
                }
                break;
            default:
                handled = false;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    private onInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            searchQuery: e.currentTarget.value,
        });
        if (this.props.onSearchChange) {
            this.props.onSearchChange(e.currentTarget.value);
        }
    };

    private collectRoot = (e: HTMLDivElement): void => {
        if (this.dropdownRootElement) {
            this.dropdownRootElement.removeEventListener("click", this.onRootClick, false);
        }
        if (e) {
            e.addEventListener("click", this.onRootClick, false);
        }
        this.dropdownRootElement = e;
    };

    private setHighlightedOption = (optionKey: string): void => {
        this.setState({
            highlightedOption: optionKey,
        });
    };

    private nextOption(optionKey: string): string {
        const keys = Object.keys(this.childrenByKey);
        const index = keys.indexOf(optionKey);
        return keys[(index + 1) % keys.length];
    }

    private prevOption(optionKey: string): string {
        const keys = Object.keys(this.childrenByKey);
        const index = keys.indexOf(optionKey);
        return keys[index <= 0 ? keys.length - 1 : (index - 1) % keys.length];
    }

    private scrollIntoView(node: Element | null): void {
        node?.scrollIntoView({
            block: "nearest",
            behavior: "auto",
        });
    }

    private getMenuOptions(): JSX.Element[] {
        const options = React.Children.map(this.props.children, (child: ReactElement) => {
            const highlighted = this.state.highlightedOption === child.key;
            return (
                <MenuOption
                    id={`${this.props.id}__${child.key}`}
                    key={child.key}
                    dropdownKey={child.key as string}
                    highlighted={highlighted}
                    onMouseEnter={this.setHighlightedOption}
                    onClick={this.onMenuOptionClick}
                    inputRef={highlighted ? this.scrollIntoView : undefined}
                >
                    {child}
                </MenuOption>
            );
        });
        if (!options?.length) {
            return [
                <li key="0" className="mx_Dropdown_option" role="option" aria-selected={false}>
                    {_t("common|no_results")}
                </li>,
            ];
        }
        return options;
    }

    public render(): React.ReactNode {
        let currentValue: JSX.Element | undefined;

        const menuStyle: CSSProperties = {};
        if (this.props.menuWidth) menuStyle.width = this.props.menuWidth;

        let menu: JSX.Element | undefined;
        if (this.state.expanded) {
            if (this.props.searchEnabled) {
                currentValue = (
                    <input
                        id={`${this.props.id}_input`}
                        type="text"
                        autoFocus={true}
                        autoComplete={this.props.autoComplete}
                        className="mx_Dropdown_option"
                        onChange={this.onInputChange}
                        value={this.state.searchQuery}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-activedescendant={`${this.props.id}__${this.state.highlightedOption}`}
                        aria-expanded={this.state.expanded}
                        aria-controls={`${this.props.id}_listbox`}
                        aria-disabled={this.props.disabled}
                        aria-label={this.props.label}
                        onKeyDown={this.onKeyDown}
                    />
                );
            }
            menu = (
                <ul className="mx_Dropdown_menu" style={menuStyle} role="listbox" id={`${this.props.id}_listbox`}>
                    {this.getMenuOptions()}
                </ul>
            );
        }

        if (!currentValue) {
            let selectedChild: ReactNode | undefined;
            if (this.props.value) {
                selectedChild = this.props.getShortOption
                    ? this.props.getShortOption(this.props.value)
                    : this.childrenByKey[this.props.value];
            }

            currentValue = (
                <div className="mx_Dropdown_option" id={`${this.props.id}_value`}>
                    {selectedChild || this.props.placeholder}
                </div>
            );
        }

        const dropdownClasses = classnames("mx_Dropdown", this.props.className, {
            mx_Dropdown_disabled: !!this.props.disabled,
        });

        // Note the menu sits inside the AccessibleButton div so it's anchored
        // to the input, but overflows below it. The root contains both.
        return (
            <div className={dropdownClasses} ref={this.collectRoot}>
                <AccessibleButton
                    className="mx_Dropdown_input mx_no_textinput"
                    onClick={this.onAccessibleButtonClick}
                    aria-haspopup="listbox"
                    aria-expanded={this.state.expanded}
                    disabled={this.props.disabled}
                    ref={this.buttonRef}
                    aria-label={this.props.label}
                    aria-describedby={`${this.props.id}_value`}
                    aria-owns={`${this.props.id}_input`}
                    onKeyDown={this.onKeyDown}
                >
                    {currentValue}
                    <span className="mx_Dropdown_arrow" />
                    {menu}
                </AccessibleButton>
            </div>
        );
    }
}
