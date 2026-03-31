/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/** The ARIA pattern used to make the virtualized list accessible. */
export type Pattern = "listbox" | "treegrid";

/** ARIA props for a `listbox` container element. */
export type ListboxContainerProps = {
    role: "listbox";
};

/** ARIA props for a `treegrid` container element, including the total row count. */
export type TreegridContainerProps = {
    /** The ARIA role identifying this element as a treegrid. */
    "role": "treegrid";
    /** The total number of rows in the treegrid, used by assistive technologies to announce list size. */
    "aria-rowcount": number;
};

/**
 * Returns the ARIA props to spread onto the virtualized list container element.
 *
 * @param pattern - `"listbox"` — returns {@link ListboxContainerProps}.
 * @returns ARIA props for a `listbox` container.
 */
export function getContainerAccessibleProps(pattern: "listbox"): ListboxContainerProps;
/**
 * Returns the ARIA props to spread onto the virtualized list container element.
 *
 * @param pattern - `"treegrid"` — returns {@link TreegridContainerProps}.
 * @param size - Total number of rows in the treegrid, set as `aria-rowcount`.
 * @returns ARIA props for a `treegrid` container.
 */
export function getContainerAccessibleProps(pattern: "treegrid", size: number): TreegridContainerProps;
export function getContainerAccessibleProps(
    pattern: Pattern,
    size?: number,
): ListboxContainerProps | TreegridContainerProps {
    switch (pattern) {
        case "listbox":
            return {
                role: "listbox",
            };
        case "treegrid":
            return {
                "role": "treegrid",
                "aria-rowcount": size!,
            };
    }
}

/** ARIA props for an item rendered inside a `listbox`. */
export type ListboxItemProps = {
    /** Identifies the element as a selectable option within the listbox. */
    "role": "option";
    /** The 1-based position of this option within the full set, used for virtual lists where not all DOM nodes are mounted. */
    "aria-posinset": number;
    /** The total number of options in the set. */
    "aria-setsize": number;
};

/** ARIA props for an item rendered inside a `treegrid` at depth level 2 (i.e. a child row within a group). */
export type TreegridItemProps = {
    /** Identifies the element as a row within the treegrid. */
    "role": "row";
    /** The depth of this row in the tree hierarchy. Items are always at level 2 (inside a group). */
    "aria-level": 2;
    /** The 1-based index of this row within the full treegrid row sequence (headers + items). */
    "aria-rowindex": number;
    /** The 1-based position of this item within its group, used by assistive technologies to announce position. */
    "aria-posinset": number;
};

/** ARIA props for a virtualized list item, either in a `listbox` or `treegrid`. */
export type ItemAccessibleProps = ListboxItemProps | TreegridItemProps;

/**
 * Returns the ARIA props to spread onto a virtualized list item element.
 *
 * @param pattern - `"listbox"` — returns {@link ListboxItemProps}.
 * @param index - The 0-based index of the item in the full flat list.
 * @param listSize - The total number of items across the entire list.
 * @returns ARIA props for a `listbox` option.
 */
export function getItemAccessibleProps(pattern: "listbox", index: number, listSize: number): ListboxItemProps;
/**
 * Returns the ARIA props to spread onto a virtualized list item element.
 *
 * @param pattern - `"treegrid"` — returns {@link TreegridItemProps}.
 * @param index - The 0-based index of this row in the full flat treegrid row sequence (headers + items).
 * @param indexInGroup - The 0-based index of this item within its group, used to compute `aria-posinset`.
 * @returns ARIA props for a `treegrid` row at level 2.
 */
export function getItemAccessibleProps(pattern: "treegrid", index: number, indexInGroup: number): TreegridItemProps;
export function getItemAccessibleProps(
    pattern: Pattern,
    index: number,
    listSizeOrIndexInGroup: number,
): ListboxItemProps | TreegridItemProps {
    switch (pattern) {
        case "listbox":
            return {
                "role": "option",
                "aria-posinset": index + 1,
                "aria-setsize": listSizeOrIndexInGroup,
            };
        case "treegrid":
            return {
                "role": "row",
                "aria-level": 2,
                "aria-rowindex": index + 1,
                "aria-posinset": listSizeOrIndexInGroup + 1,
            };
    }
}

/** ARIA props for a group header row rendered inside a `treegrid` at depth level 1. */
export type TreegridGroupHeaderProps = {
    /** Identifies the element as a row within the treegrid. */
    "role": "row";
    /** The depth of this row in the tree hierarchy. Group headers are always at the root level (1). */
    "aria-level": 1;
    /** The 1-based position of this group among all groups. */
    "aria-posinset": number;
    /** The 1-based index of this row within the full treegrid row sequence (headers + items). */
    "aria-rowindex": number;
    /** The total number of groups in the treegrid. */
    "aria-setsize": number;
};

/**
 * Returns the ARIA props to spread onto a group header row element inside a `treegrid`.
 *
 * Group headers are rendered at `aria-level="1"` and act as the parent nodes for their
 * child item rows (`aria-level="2"`).
 *
 * @param index - The 0-based index of this row in the full flat treegrid row sequence (headers + items), used to compute `aria-rowindex`.
 * @param groupIndex - The 0-based index of this group among all groups, used to compute `aria-posinset`.
 * @param groupSize - The total number of items in the group, set as `aria-setsize`.
 * @returns ARIA props for a group header `row` at level 1.
 */
export function getGroupHeaderAccessibleProps(
    index: number,
    groupIndex: number,
    groupSize: number,
): TreegridGroupHeaderProps {
    return {
        "role": "row",
        "aria-level": 1,
        "aria-posinset": groupIndex + 1,
        "aria-rowindex": index + 1,
        "aria-setsize": groupSize,
    };
}
