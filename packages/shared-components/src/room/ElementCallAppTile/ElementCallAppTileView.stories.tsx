/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryFn } from "@storybook/react-vite";
import React, { type FC, type JSX, type ReactNode } from "react";

import { useMockedViewModel } from "../../core/viewmodel";
import {
    ElementCallAppTileView,
    type ElementCallAppTileViewActions,
    type ElementCallAppTileViewSnapshot,
} from "./ElementCallAppTileView";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type ElementCallAppTileViewProps = ElementCallAppTileViewSnapshot &
    ElementCallAppTileViewActions & { overlay?: ReactNode };

/**
 * Stands in for Element Web's `PersistedElement`, which renders its children in a React tree
 * appended to `document.body`. Here they are rendered in place so that the story shows something.
 */
const PersistedElementMock: FC<{ children: ReactNode }> = ({ children }) => <>{children}</>;

/** Stands in for Element Call, which cannot be loaded outside Element Web. */
const ElementCallMock: FC = () => (
    <div style={{ height: "100%", minHeight: 240, backgroundColor: "grey", borderRadius: "8px" }} />
);

const ElementCallAppTileViewWrapperImpl = ({
    PersistedElement,
    ElementCall,
    overlay,
    ...rest
}: ElementCallAppTileViewProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { PersistedElement, ElementCall });
    return <ElementCallAppTileView vm={vm} overlay={overlay} />;
};

const ElementCallAppTileViewWrapper = withViewDocs(ElementCallAppTileViewWrapperImpl, ElementCallAppTileView);

/**
 * Note that the tile has no styling of its own: the `mx_AppTile*` class names it renders are styled
 * by app/web's `_AppsDrawer.pcss`, which stories deliberately do not load. These stories therefore
 * show the structure and the injected components, not the tile's final box.
 */
export default {
    title: "Room/ElementCallAppTileView",
    component: ElementCallAppTileViewWrapper,
    // No visual snapshots: the tile's box is styled entirely by app/web's `_AppsDrawer.pcss`,
    // which stories do not load, so a screenshot would only show the injected placeholders. The
    // structure and class names are covered by the DOM snapshots in ElementCallAppTileView.test.tsx.
    tags: ["autodocs", "!snapshot"],
    argTypes: {},
    args: {
        hidden: false,
        miniMode: false,
        fullWidth: false,
        persistKey: "widget_element-call-widget",
        zIndex: 9,
        PersistedElement: PersistedElementMock,
        ElementCall: ElementCallMock,
    },
} satisfies Meta<typeof ElementCallAppTileViewWrapper>;

const Template: StoryFn<typeof ElementCallAppTileViewWrapper> = (args) => <ElementCallAppTileViewWrapper {...args} />;

/**
 * The call docked into a container, sharing the width with other widgets.
 */
export const Docked = Template.bind({});
Docked.args = {};

/**
 * The call docked into a container on its own, filling its width.
 */
export const FullWidth = Template.bind({});
FullWidth.args = { fullWidth: true };

/**
 * The floating picture-in-picture window, which draws above other persisted apps.
 */
export const MiniMode = Template.bind({});
MiniMode.args = { miniMode: true, fullWidth: true, zIndex: 101 };

/**
 * An overlay rendered over the call, inside the persisted root.
 */
export const WithOverlay = Template.bind({});
WithOverlay.args = {
    overlay: <div data-testid="overlay">Overlay</div>,
};

/**
 * There is no Element Call in this room: the tile renders nothing at all.
 */
export const Hidden = Template.bind({});
Hidden.args = { hidden: true };
