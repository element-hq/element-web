/*
Copyright 2026 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useMemo } from "react";

import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import { _t } from "../../../../languageHandler";
import CopyableText from "../../elements/CopyableText";

interface MemberInfoRow {
    stableId: string;
    /** The user ID the stable ID resolves to, or `null` when the server names nobody. */
    userId: string | null | undefined;
    membership?: string;
    displayName?: string;
    /** True if the room's `member_info` mapping holds an entry for this member. */
    mapped: boolean;
}

/**
 * Shows the room's MSC4428 `member_info` mapping: which user each member's stable ID
 * resolves to.
 *
 * In a room with member keys (MSC4430) the stable ID is the member's key, and this is
 * the only thing that connects it to a user. In an ordinary room there is no mapping at
 * all and every stable ID is its own user ID, which this shows as "implicit".
 */
const MemberInfoExplorer: React.FC<IDevtoolsProps> = ({ onBack }) => {
    const context = useContext(DevtoolsContext);
    const room = context.room;

    const rows = useMemo<MemberInfoRow[]>(() => {
        const mapping = room.memberInfo.serialise();
        const byStableId = new Map<string, MemberInfoRow>();

        // Every member we have state for, mapped or not.
        for (const member of room.currentState.getMembers()) {
            byStableId.set(member.stableId, {
                stableId: member.stableId,
                userId: member.resolvedUserId,
                membership: member.membership,
                displayName: member.rawDisplayName,
                mapped: member.stableId in mapping,
            });
        }

        // Plus any mapping entry with no member event loaded, e.g. learnt from
        // /joined_members before lazy-loaded members arrived.
        for (const [stableId, entry] of Object.entries(mapping)) {
            if (byStableId.has(stableId)) continue;
            byStableId.set(stableId, { stableId, userId: entry.user_id, mapped: true });
        }

        return [...byStableId.values()].sort((a, b) => a.stableId.localeCompare(b.stableId));
    }, [room]);

    const myStableId = room.getMyStableId();

    return (
        <BaseTool onBack={onBack}>
            <table className="mx_DevTools_MemberInfo">
                <thead>
                    <tr>
                        <th>{_t("devtools|member_info|stable_id")}</th>
                        <th>{_t("devtools|member_info|user_id")}</th>
                        <th>{_t("devtools|member_info|source")}</th>
                        <th>{_t("devtools|member_info|membership")}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.stableId}>
                            <td>
                                <CopyableText getTextToCopy={() => row.stableId} border={false}>
                                    <code>{row.stableId}</code>
                                </CopyableText>
                                {row.stableId === myStableId && ` ${_t("devtools|member_info|this_is_you")}`}
                            </td>
                            <td>
                                {row.userId === null ? (
                                    <i>{_t("devtools|member_info|unresolvable")}</i>
                                ) : (
                                    <code>{row.userId ?? row.stableId}</code>
                                )}
                                {row.displayName ? ` (${row.displayName})` : null}
                            </td>
                            <td>
                                {row.mapped
                                    ? _t("devtools|member_info|source_member_info")
                                    : _t("devtools|member_info|source_implicit")}
                            </td>
                            <td>{row.membership ?? "-"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length === 0 && <div>{_t("devtools|member_info|no_members")}</div>}
        </BaseTool>
    );
};

export default MemberInfoExplorer;
