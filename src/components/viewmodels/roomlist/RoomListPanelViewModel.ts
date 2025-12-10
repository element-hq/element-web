/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type RoomListPanelSnapshot } from "@element-hq/web-shared-components";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { RoomListSearchViewModel } from "./RoomListSearchViewModel";
import { RoomListHeaderViewModel } from "./RoomListHeaderViewModel";
import { RoomListViewViewModel } from "./RoomListViewViewModel";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";

interface RoomListPanelViewModelProps {
    client: MatrixClient;
}

/**
 * Top-level ViewModel for the RoomListPanel component.
 * Composes search, header, and view ViewModels.
 */
export class RoomListPanelViewModel extends BaseViewModel<RoomListPanelSnapshot, RoomListPanelViewModelProps> {
    private searchVm: RoomListSearchViewModel | undefined;
    private headerVm: RoomListHeaderViewModel;
    private viewVm: RoomListViewViewModel;

    public constructor(props: RoomListPanelViewModelProps) {
        // Initialize child ViewModels
        const displayRoomSearch = shouldShowComponent(UIComponent.FilterContainer);
        const searchVm = displayRoomSearch ? new RoomListSearchViewModel({ client: props.client }) : undefined;
        const headerVm = new RoomListHeaderViewModel({ client: props.client });
        const viewVm = new RoomListViewViewModel({ client: props.client });

        super(props, {
            ariaLabel: _t("room_list|list_title"),
            searchVm,
            headerVm,
            viewVm,
        });

        this.searchVm = searchVm;
        this.headerVm = headerVm;
        this.viewVm = viewVm;

        // Subscribe to child ViewModels to propagate updates
        // Note: We don't need to update our snapshot when children update,
        // because the child VM references stay the same and React will
        // pick up changes from the child VMs directly via their own subscriptions
    }

    public override dispose(): void {
        this.searchVm?.dispose();
        this.headerVm.dispose();
        this.viewVm.dispose();
        super.dispose();
    }
}
