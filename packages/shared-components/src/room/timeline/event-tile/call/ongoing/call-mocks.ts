/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type FacePileViewSnapshot } from "../../../../../core/FacePile/FacePileView";
import { type MemberAvatarViewSnapshot } from "../../../../../core/MemberAvatar/MemberAvatarView";
import { MockViewModel } from "../../../../../core/viewmodel";

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

export class MockFacePileViewModel extends MockViewModel<FacePileViewSnapshot> {
    public constructor(items: MockProp[]) {
        const memberAvatarViewModels = items.slice(0, 3).map((item) => new MockMemberAvatarViewModel(item));
        super({ memberAvatarViewModels });
    }
}
