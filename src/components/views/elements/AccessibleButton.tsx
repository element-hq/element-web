/*
Copyright 2024 New Vector Ltd.
Copyright 2016 Jani Mustonen

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
 */

import React, { ComponentProps, forwardRef, FunctionComponent, HTMLAttributes, InputHTMLAttributes, Ref } from "react";
import classnames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";

export type ButtonEvent = React.MouseEvent<Element> | React.KeyboardEvent<Element> | React.FormEvent<Element>;

/**
 * The kind of button, similar to how Bootstrap works.
 */
export type AccessibleButtonKind =
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
    | "icon"
    | "icon_primary"
    | "icon_primary_outline";

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

type TooltipProps = ComponentProps<typeof Tooltip>;

/**
 * Type of props accepted by {@link AccessibleButton}.
 *
 * Extends props accepted by the underlying element specified using the `element` prop.
 */
type Props<T extends keyof JSX.IntrinsicElements> = DynamicHtmlElementProps<T> & {
    /**
     * The base element type. "div" by default.
     */
    element?: T;
    /**
     * The kind of button, similar to how Bootstrap works.
     */
    kind?: AccessibleButtonKind;
    /**
     * Whether the button should be disabled.
     */
    disabled?: boolean;
    /**
     * Whether the button should trigger on mousedown event instead of on click event. Defaults to false (click event).
     */
    triggerOnMouseDown?: boolean;
    /**
     * Event handler for button activation. Should be implemented exactly like a normal `onClick` handler.
     */
    onClick: ((e: ButtonEvent) => void | Promise<void>) | null;
    /**
     * The tooltip to show on hover or focus.
     */
    title?: TooltipProps["label"];
    /**
     * The caption is a secondary text displayed under the `title` of the tooltip.
     * Only valid when used in conjunction with `title`.
     */
    caption?: TooltipProps["caption"];
    /**
     * The placement of the tooltip.
     */
    placement?: TooltipProps["placement"];
    /**
     * Callback for when the tooltip is opened or closed.
     */
    onTooltipOpenChange?: TooltipProps["onOpenChange"];

    /**
     * Whether the tooltip should be disabled.
     */
    disableTooltip?: TooltipProps["disabled"];
};

export type ButtonProps<T extends keyof JSX.IntrinsicElements> = Props<T>;

/**
 * Type of the props passed to the element that is rendered by AccessibleButton.
 */
interface RenderedElementProps extends React.InputHTMLAttributes<Element> {
    ref?: React.Ref<Element>;
}

/**
 * AccessibleButton is a generic wrapper for any element that should be treated
 * as a button.  Identifies the element as a button, setting proper tab
 * indexing and keyboard activation behavior.
 *
 * If a ref is passed, it will be forwarded to the rendered element as specified using the `element` prop.
 *
 * @param {Object} props  react element properties
 * @returns {Object} rendered react
 */
const AccessibleButton = forwardRef(function <T extends keyof JSX.IntrinsicElements>(
    {
        element = "div" as T,
        onClick,
        children,
        kind,
        disabled,
        className,
        onKeyDown,
        onKeyUp,
        triggerOnMouseDown,
        title,
        caption,
        placement = "right",
        onTooltipOpenChange,
        disableTooltip,
        ...restProps
    }: Props<T>,
    ref: Ref<HTMLElement>,
): JSX.Element {
    const newProps: RenderedElementProps = restProps;
    newProps["aria-label"] = newProps["aria-label"] ?? title;
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
    newProps.ref = ref;

    newProps.className = classnames("mx_AccessibleButton", className, {
        mx_AccessibleButton_hasKind: kind,
        [`mx_AccessibleButton_kind_${kind}`]: kind,
        mx_AccessibleButton_disabled: disabled,
    });

    // React.createElement expects InputHTMLAttributes
    const button = React.createElement(element, newProps, children);

    if (title) {
        return (
            <Tooltip
                description={title}
                caption={caption}
                isTriggerInteractive={true}
                placement={placement}
                onOpenChange={onTooltipOpenChange}
                disabled={disableTooltip}
            >
                {button}
            </Tooltip>
        );
    }
    return button;
});

// Type assertion required due to forwardRef type workaround in react.d.ts
(AccessibleButton as FunctionComponent).defaultProps = {
    role: "button",
    tabIndex: 0,
};
(AccessibleButton as FunctionComponent).displayName = "AccessibleButton";

export default AccessibleButton;
