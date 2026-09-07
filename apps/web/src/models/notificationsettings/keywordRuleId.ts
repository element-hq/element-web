/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Work out which rule ID a keyword should be stored under.
 *
 * A keyword is normally its own rule ID, but homeservers reserve the IDs beginning with a dot for
 * the rules they define themselves and refuse to store any other, so a keyword such as
 * `...push complete` cannot be one. The ID drops those leading dots; the rule's pattern, which is
 * what messages are actually matched against, keeps the keyword exactly as it was typed. That can
 * leave two keywords wanting the same ID, so one of them is numbered off the end.
 *
 * @param keyword - The keyword as the user typed it.
 * @param existingIds - The rule IDs already in use.
 * @returns A rule ID the homeserver will accept and no other rule is using.
 */
export function keywordRuleId(keyword: string, existingIds: Iterable<string>): string {
    // A keyword of nothing but dots leaves nothing to name the rule after.
    const base = keyword.replace(/^\.+/, "") || "keyword";

    const taken = new Set(existingIds);
    if (!taken.has(base)) return base;

    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) suffix++;
    return `${base}-${suffix}`;
}
