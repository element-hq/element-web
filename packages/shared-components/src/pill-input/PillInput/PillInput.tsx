/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type PropsWithChildren,
    type JSX,
    useRef,
    type KeyboardEventHandler,
    type HTMLAttributes,
    type HTMLProps,
    Children,
} from "react";
import classNames from "classnames";
import { omit } from "lodash";
import { useMergeRefs } from "react-merge-refs";

import styles from "./PillInput.module.css";
import { Flex } from "../../utils/Flex";

export interface PillInputProps extends HTMLAttributes<HTMLDivElement> {
    /**
     * Callback for when the user presses backspace on an empty input.
     */
    onRemoveChildren?: KeyboardEventHandler;
    /**
     * Props to pass to the input element.
     */
    inputProps?: HTMLProps<HTMLInputElement> & { "data-testid"?: string };
}

/**
 * An input component that can contain multiple child elements and an input field.
 *
 * @example
 * ```tsx
 * <PillInput>
 *   <div>Child 1</div>
 *   <div>Child 2</div>
 * </PillInput>
 * ```
 */
export function PillInput({
    className,
    children,
    onRemoveChildren,
    inputProps,
    ...props
}: PropsWithChildren<PillInputProps>): JSX.Element {
    const inputRef = useRef<HTMLInputElement>(null);
    const inputAttributes = omit(inputProps, ["onKeyDown", "ref"]);
    const ref = useMergeRefs([inputRef, inputProps?.ref]);

    const hasChildren = Children.toArray(children).length > 0;

    return (
        <Flex
            {...props}
            gap="var(--cpd-space-1x)"
            direction="column"
            className={classNames(styles.pillInput, className)}
            onClick={(evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                inputRef.current?.focus();
            }}
        >
            {hasChildren && (
                <Flex gap="var(--cpd-space-1x)" wrap="wrap" align="center">
                    {children}
                </Flex>
            )}
            <input
                ref={ref}
                autoComplete="off"
                className={classNames(styles.input, { [styles.largerInput]: hasChildren })}
                onKeyDown={(evt) => {
                    const value = evt.currentTarget.value.trim();

                    // If the input is empty and the user presses backspace, we call the onRemoveChildren handler
                    if (evt.key === "Backspace" && !value) {
                        evt.preventDefault();
                        onRemoveChildren?.(evt);
                        return;
                    }

                    inputProps?.onKeyDown?.(evt);
                }}
                {...inputAttributes}
            />
        </Flex>
    );
}
