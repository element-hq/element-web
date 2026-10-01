/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type FacePileViewSnapshot, FacePileView } from "./FacePileView";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import profileLink1 from "../../../static/profile-pics/profile1.png";
import profileLink2 from "../../../static/profile-pics/profile2.png";
import profileLink3 from "../../../static/profile-pics/profile3.png";
import { MockViewModel, useMockedViewModel } from "../viewmodel";
import { type MemberAvatarViewSnapshot } from "../MemberAvatar/MemberAvatarView";

const FacePileViewWrapperImpl = (snapshot: FacePileViewSnapshot): React.ReactNode => {
    const vm = useMockedViewModel(snapshot, {});
    return <FacePileView vm={vm} />;
};

const FacePileViewWrapper = withViewDocs(FacePileViewWrapperImpl, FacePileView);

type MockProp = { id: string; name: string; url?: string };

export class MockMemberAvatarViewModel extends MockViewModel<MemberAvatarViewSnapshot> {
    public constructor({ id, name, url }: MockProp) {
        super({
            id,
            name,
            size: "20px",
            title: id,
            url,
        });
    }
}

const meta = {
    title: "Core/FacePileView",
    component: FacePileViewWrapper,
    tags: ["autodocs"],
    args: {
        memberAvatarViewModels: [
            new MockMemberAvatarViewModel({ id: "@bob:m.org", name: "Bob", url: profileLink1 }),
            new MockMemberAvatarViewModel({ id: "@riley:m.org", name: "Riley", url: profileLink2 }),
            new MockMemberAvatarViewModel({ id: "@andi:m.org", name: "Andi", url: profileLink3 }),
        ],
    },
} satisfies Meta<typeof FacePileViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
