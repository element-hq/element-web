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

import React, { HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import classnames from "classnames";

import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";

export type ButtonEvent = React.MouseEvent<Element> | React.KeyboardEvent<Element> | React.FormEvent<Element>;

type AccessibleButtonKind =
    | "primary"
    | "primary_outline"
    | "primary_sm"
    | "secondary"
    | "secondary_content"
    | "content_inline"
    | "danger"
    | "danger_outline"
    | "danger_sm"
    | "danger_inline"
    | "link"
    | "link_inline"
    | "link_sm"
    | "confirm_sm"
    | "cancel_sm"
    | "icon";

/**
 * This type construct allows us to specifically pass those props down to the element we’re creating that the element
 * actually supports.
 *
 * e.g., if element is set to "a", we’ll support href and target, if it’s set to "input", we support type.
 *
 * To remain compatible with existing code, we’ll continue to support InputHTMLAttributes<Element>
 */
type DynamicHtmlElementProps<T extends keyof JSX.IntrinsicElements> =
    JSX.IntrinsicElements[T] extends HTMLAttributes<{}> ? DynamicElementProps<T> : DynamicElementProps<"div">;
type DynamicElementProps<T extends keyof JSX.IntrinsicElements> = Partial<
    Omit<JSX.IntrinsicElements[T], "ref" | "onClick" | "onMouseDown" | "onKeyUp" | "onKeyDown">
> &
    Omit<InputHTMLAttributes<Element>, "onClick">;

/**
 * children: React's magic prop. Represents all children given to the element.
 * element:  (optional) The base element type. "div" by default.
 * onClick:  (required) Event handler for button activation. Should be
 *           implemented exactly like a normal onClick handler.
 */
type IProps<T extends keyof JSX.IntrinsicElements> = DynamicHtmlElementProps<T> & {
    inputRef?: React.Ref<Element>;
    element?: T;
    children?: ReactNode;
    // The kind of button, similar to how Bootstrap works.
    // See available classes for AccessibleButton for options.
    kind?: AccessibleButtonKind | string;
    // The ARIA role
    role?: string;
    // The tabIndex
    tabIndex?: number;
    disabled?: boolean;
    className?: string;
    triggerOnMouseDown?: boolean;
    onClick: ((e: ButtonEvent) => void | Promise<void>) | null;
};

export interface IAccessibleButtonProps extends React.InputHTMLAttributes<Element> {
    ref?: React.Ref<Element>;
}

/**
 * AccessibleButton is a generic wrapper for any element that should be treated
 * as a button.  Identifies the element as a button, setting proper tab
 * indexing and keyboard activation behavior.
 *
 * @param {Object} props  react element properties
 * @returns {Object} rendered react
 */
export default function AccessibleButton<T extends keyof JSX.IntrinsicElements>({
    element = "div" as T,
    onClick,
    children,
    kind,
    disabled,
    inputRef,
    className,
    onKeyDown,
    onKeyUp,
    triggerOnMouseDown,
    ...restProps
}: IProps<T>): JSX.Element {
    const newProps: IAccessibleButtonProps = restProps;
    if (disabled) {
        newProps["aria-disabled"] = true;
        newProps["disabled"] = true;
    } else {
        if (triggerOnMouseDown) {
            newProps.onMouseDown = onClick ?? undefined;
        } else {
            newProps.onClick = onClick ?? undefined;
        }
        // We need to consume enter onKeyDown and space onKeyUp
        // otherwise we are risking also activating other keyboard focusable elements
        // that might receive focus as a result of the AccessibleButtonClick action
        // It's because we are using html buttons at a few places e.g. inside dialogs
        // And divs which we report as role button to assistive technologies.
        // Browsers handle space and enter key presses differently and we are only adjusting to the
        // inconsistencies here
        newProps.onKeyDown = (e) => {
            const action = getKeyBindingsManager().getAccessibilityAction(e);

            switch (action) {
                case KeyBindingAction.Enter:
                    e.stopPropagation();
                    e.preventDefault();
                    return onClick?.(e);
                case KeyBindingAction.Space:
                    e.stopPropagation();
                    e.preventDefault();
                    break;
                default:
                    onKeyDown?.(e);
            }
        };
        newProps.onKeyUp = (e) => {
            const action = getKeyBindingsManager().getAccessibilityAction(e);

            switch (action) {
                case KeyBindingAction.Enter:
                    e.stopPropagation();
                    e.preventDefault();
                    break;
                case KeyBindingAction.Space:
                    e.stopPropagation();
                    e.preventDefault();
                    return onClick?.(e);
                default:
                    onKeyUp?.(e);
                    break;
            }
        };
    }

    // Pass through the ref - used for keyboard shortcut access to some buttons
    newProps.ref = inputRef;

    newProps.className = classnames("mx_AccessibleButton", className, {
        mx_AccessibleButton_hasKind: kind,
        [`mx_AccessibleButton_kind_${kind}`]: kind,
        mx_AccessibleButton_disabled: disabled,
    });

    // React.createElement expects InputHTMLAttributes
    return React.createElement(element, newProps, children);
}

AccessibleButton.defaultProps = {
    role: "button",
    tabIndex: 0,
};

AccessibleButton.displayName = "AccessibleButton";
