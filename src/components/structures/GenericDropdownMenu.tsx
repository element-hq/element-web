/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import classNames from "classnames";
import React, { FunctionComponent, Key, PropsWithChildren, ReactNode } from "react";

import { MenuItemRadio } from "../../accessibility/context_menu/MenuItemRadio";
import { ButtonEvent } from "../views/elements/AccessibleButton";
import ContextMenu, { aboveLeftOf, ChevronFace, ContextMenuButton, useContextMenu } from "./ContextMenu";

export type GenericDropdownMenuOption<T> = {
    key: T;
    label: ReactNode;
    description?: ReactNode;
    adornment?: ReactNode;
};

export type GenericDropdownMenuGroup<T> = GenericDropdownMenuOption<T> & {
    options: GenericDropdownMenuOption<T>[];
};

export type GenericDropdownMenuItem<T> = GenericDropdownMenuGroup<T> | GenericDropdownMenuOption<T>;

export function GenericDropdownMenuOption<T extends Key>({
    label,
    description,
    onClick,
    isSelected,
    adornment,
}: GenericDropdownMenuOption<T> & {
    onClick: (ev: ButtonEvent) => void;
    isSelected: boolean;
}): JSX.Element {
    return (
        <MenuItemRadio
            active={isSelected}
            className="mx_GenericDropdownMenu_Option mx_GenericDropdownMenu_Option--item"
            onClick={onClick}
        >
            <div className="mx_GenericDropdownMenu_Option--label">
                <span>{label}</span>
                <span>{description}</span>
            </div>
            {adornment}
        </MenuItemRadio>
    );
}

export function GenericDropdownMenuGroup<T extends Key>({
    label,
    description,
    adornment,
    children,
}: PropsWithChildren<GenericDropdownMenuOption<T>>): JSX.Element {
    return (
        <>
            <div className="mx_GenericDropdownMenu_Option mx_GenericDropdownMenu_Option--header">
                <div className="mx_GenericDropdownMenu_Option--label">
                    <span>{label}</span>
                    <span>{description}</span>
                </div>
                {adornment}
            </div>
            {children}
        </>
    );
}

function isGenericDropdownMenuGroupArray<T>(
    items: readonly GenericDropdownMenuItem<T>[],
): items is GenericDropdownMenuGroup<T>[] {
    return isGenericDropdownMenuGroup(items[0]);
}

function isGenericDropdownMenuGroup<T>(item: GenericDropdownMenuItem<T>): item is GenericDropdownMenuGroup<T> {
    return "options" in item;
}

type WithKeyFunction<T> = T extends Key
    ? {
          toKey?: (key: T) => Key;
      }
    : {
          toKey: (key: T) => Key;
      };

type IProps<T> = WithKeyFunction<T> & {
    value: T;
    options: readonly GenericDropdownMenuOption<T>[] | readonly GenericDropdownMenuGroup<T>[];
    onChange: (option: T) => void;
    selectedLabel: (option: GenericDropdownMenuItem<T> | null | undefined) => ReactNode;
    onOpen?: (ev: ButtonEvent) => void;
    onClose?: (ev: ButtonEvent) => void;
    className?: string;
    AdditionalOptions?: FunctionComponent<{
        menuDisplayed: boolean;
        closeMenu: () => void;
        openMenu: () => void;
    }>;
};

export function GenericDropdownMenu<T>({
    value,
    onChange,
    options,
    selectedLabel,
    onOpen,
    onClose,
    toKey,
    className,
    AdditionalOptions,
}: IProps<T>): JSX.Element {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu<HTMLElement>();

    const selected: GenericDropdownMenuItem<T> | undefined = options
        .flatMap((it) => (isGenericDropdownMenuGroup(it) ? [it, ...it.options] : [it]))
        .find((option) => (toKey ? toKey(option.key) === toKey(value) : option.key === value));
    let contextMenuOptions: JSX.Element;
    if (options && isGenericDropdownMenuGroupArray(options)) {
        contextMenuOptions = (
            <>
                {options.map((group) => (
                    <GenericDropdownMenuGroup
                        key={toKey?.(group.key) ?? (group.key as Key)}
                        label={group.label}
                        description={group.description}
                        adornment={group.adornment}
                    >
                        {group.options.map((option) => (
                            <GenericDropdownMenuOption
                                key={toKey?.(option.key) ?? (option.key as Key)}
                                label={option.label}
                                description={option.description}
                                onClick={(ev: ButtonEvent) => {
                                    onChange(option.key);
                                    closeMenu();
                                    onClose?.(ev);
                                }}
                                adornment={option.adornment}
                                isSelected={option === selected}
                            />
                        ))}
                    </GenericDropdownMenuGroup>
                ))}
            </>
        );
    } else {
        contextMenuOptions = (
            <>
                {options.map((option) => (
                    <GenericDropdownMenuOption
                        key={toKey?.(option.key) ?? (option.key as Key)}
                        label={option.label}
                        description={option.description}
                        onClick={(ev: ButtonEvent) => {
                            onChange(option.key);
                            closeMenu();
                            onClose?.(ev);
                        }}
                        adornment={option.adornment}
                        isSelected={option === selected}
                    />
                ))}
            </>
        );
    }
    const contextMenu =
        menuDisplayed && button.current ? (
            <ContextMenu
                onFinished={closeMenu}
                chevronFace={ChevronFace.Top}
                wrapperClassName={classNames("mx_GenericDropdownMenu_wrapper", className)}
                {...aboveLeftOf(button.current.getBoundingClientRect())}
            >
                {contextMenuOptions}
                {AdditionalOptions && (
                    <AdditionalOptions menuDisplayed={menuDisplayed} openMenu={openMenu} closeMenu={closeMenu} />
                )}
            </ContextMenu>
        ) : null;
    return (
        <>
            <ContextMenuButton
                className="mx_GenericDropdownMenu_button"
                inputRef={button}
                isExpanded={menuDisplayed}
                onClick={(ev: ButtonEvent) => {
                    openMenu();
                    onOpen?.(ev);
                }}
            >
                {selectedLabel(selected)}
            </ContextMenuButton>
            {contextMenu}
        </>
    );
}
