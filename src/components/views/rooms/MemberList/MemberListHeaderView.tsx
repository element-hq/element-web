/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Search, Text, Button, Tooltip, InlineSpinner } from "@vector-im/compound-web";
import React from "react";
import InviteIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import { UserAddIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { Flex } from "../../../../shared-components/utils/Flex";
import { type MemberListViewState } from "../../../viewmodels/memberlist/MemberListViewModel";
import { _t } from "../../../../languageHandler";

interface TooltipProps {
    canInvite: boolean;
    children: React.ReactNode;
}

const InviteTooltip: React.FC<TooltipProps> = ({ canInvite, children }) => {
    const description: string = canInvite ? _t("action|invite") : _t("member_list|invite_button_no_perms_tooltip");
    // If the user isn't allowed to invite others to this room, wrap with a relevant tooltip.
    return <Tooltip description={description}>{children}</Tooltip>;
};

interface Props {
    vm: MemberListViewState;
}

const InviteButton: React.FC<Props> = ({ vm }) => {
    const shouldShowInvite = vm.shouldShowInvite;
    const shouldShowSearch = vm.shouldShowSearch;
    const disabled = !vm.canInvite;

    if (!shouldShowInvite) {
        // In this case, invite button should not be rendered.
        return null;
    }

    if (shouldShowSearch) {
        /// When rendered alongside a search box, the invite button is just an icon.
        return (
            <InviteTooltip canInvite={vm.canInvite}>
                <Button
                    className="mx_MemberListHeaderView_invite_small"
                    kind="secondary"
                    onClick={vm.onInviteButtonClick}
                    size="sm"
                    iconOnly={true}
                    Icon={InviteIcon}
                    disabled={disabled}
                    aria-label={_t("action|invite")}
                    type="button"
                />
            </InviteTooltip>
        );
    }

    // Without a search box, invite button is a full size button.
    return (
        <InviteTooltip canInvite={vm.canInvite}>
            <Button
                kind="secondary"
                size="sm"
                Icon={UserAddIcon}
                className="mx_MemberListHeaderView_invite_large"
                disabled={!vm.canInvite}
                onClick={vm.onInviteButtonClick}
                type="button"
            >
                {_t("action|invite")}
            </Button>
        </InviteTooltip>
    );
};

/**
 * This should be:
 * A loading text with spinner while the memberlist loads.
 * Member count of the room when there's nothing in the search field.
 * Number of matching members during search or 'No result' if search found nothing.
 */
function getHeaderLabelJSX(vm: MemberListViewState): React.ReactNode {
    if (vm.isLoading) {
        return (
            <Flex align="center" gap="8px">
                <InlineSpinner /> {_t("common|loading")}
            </Flex>
        );
    }
    if (vm.memberCount === 0) {
        return _t("member_list|no_matches");
    }
    return _t("member_list|count", { count: vm.memberCount });
}

export const MemberListHeaderView: React.FC<Props> = (props: Props) => {
    const vm = props.vm;

    let contentJSX: React.ReactNode;

    if (vm.shouldShowSearch) {
        // When we need to show the search box
        contentJSX = (
            <Flex justify="center" className="mx_MemberListHeaderView_container">
                <Search
                    className="mx_MemberListHeaderView_search mx_no_textinput"
                    name="searchMembers"
                    placeholder={_t("member_list|filter_placeholder")}
                    onChange={(e) => vm.search((e as React.ChangeEvent<HTMLInputElement>).target.value)}
                />
                <InviteButton vm={vm} />
            </Flex>
        );
    } else if (!vm.shouldShowSearch && vm.shouldShowInvite) {
        // When we don't need to show the search box but still need an invite button
        contentJSX = (
            <Flex justify="center" className="mx_MemberListHeaderView_container">
                <InviteButton vm={vm} />
            </Flex>
        );
    } else {
        // No search box and no invite icon, so nothing to render!
        contentJSX = null;
    }

    return (
        <Flex className="mx_MemberListHeaderView" as="header" align="center" justify="space-between" direction="column">
            {!vm.isLoading && contentJSX}
            <Text as="div" size="sm" weight="semibold" className="mx_MemberListHeaderView_label">
                {getHeaderLabelJSX(vm)}
            </Text>
        </Flex>
    );
};
