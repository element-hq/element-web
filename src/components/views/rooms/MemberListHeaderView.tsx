/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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
import { Search, Text, Button, Tooltip, InlineSpinner } from "@vector-im/compound-web";
import React from "react";
import InviteIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add-solid";
import { UserAddIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { Flex } from "../../utils/Flex";
import { MemberListViewState } from "../../viewmodels/MemberListViewModel";
import { _t } from "../../../languageHandler";

interface Props {
    vm: MemberListViewState;
}

interface TooltipProps {
    canInvite: boolean;
    children: React.ReactNode;
}

const OptionalTooltip: React.FC<TooltipProps> = ({ canInvite, children }) => {
    if (canInvite) return children;
    // If the user isn't allowed to invite others to this room, wrap with a relevant tooltip.
    return <Tooltip description={_t("member_list|invite_button_no_perms_tooltip")}>{children}</Tooltip>;
};

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
            <OptionalTooltip canInvite={vm.canInvite}>
                <Button
                    className="mx_MemberListHeaderView_invite_small"
                    kind="primary"
                    onClick={vm.onInviteButtonClick}
                    size="sm"
                    iconOnly={true}
                    Icon={InviteIcon}
                    disabled={disabled}
                    aria-label={_t("action|invite")}
                />
            </OptionalTooltip>
        );
    }

    // Without a search box, invite button is a full size button.
    return (
        <OptionalTooltip canInvite={vm.canInvite}>
            <Button
                kind="secondary"
                size="sm"
                Icon={UserAddIcon}
                className="mx_MemberListHeaderView_invite_large"
                disabled={!vm.canInvite}
                onClick={vm.onInviteButtonClick}
            >
                {_t("action|invite")}
            </Button>
        </OptionalTooltip>
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

    const filteredMemberCount = vm.members.length;
    if (filteredMemberCount === 0) {
        return _t("member_list|no_matches");
    }
    return _t("member_list|count", { count: filteredMemberCount });
}

/**
 * The top section of the memberlist contains:
 * - Just an invite button if the number of members < 20
 * - Search bar + invite button if number of members > 20
 * - A header label, see function above.
 */
const MemberListHeaderView: React.FC<Props> = (props: Props) => {
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

export default MemberListHeaderView;
