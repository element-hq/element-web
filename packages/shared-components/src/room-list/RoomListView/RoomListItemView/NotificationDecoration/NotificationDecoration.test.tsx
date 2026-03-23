/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";

import * as stories from "./NotificationDecoration.stories";

const {
    NoNotification,
    UnsentMessage,
    VideoCall,
    VoiceCall,
    Invited,
    Mention,
    MentionWithCount,
    NotificationWithCount,
    ActivityIndicator,
    Muted,
} = composeStories(stories);

describe("<NotificationDecoration />", () => {
    describe("snapshots", () => {
        it("renders NoNotification story", () => {
            const { container } = render(<NoNotification />);
            expect(container).toMatchSnapshot();
        });

        it("renders UnsentMessage story", () => {
            const { container } = render(<UnsentMessage />);
            expect(container).toMatchSnapshot();
        });

        it("renders VideoCall story", () => {
            const { container } = render(<VideoCall />);
            expect(container).toMatchSnapshot();
        });

        it("renders VoiceCall story", () => {
            const { container } = render(<VoiceCall />);
            expect(container).toMatchSnapshot();
        });

        it("renders Invited story", () => {
            const { container } = render(<Invited />);
            expect(container).toMatchSnapshot();
        });

        it("renders Mention story", () => {
            const { container } = render(<Mention />);
            expect(container).toMatchSnapshot();
        });

        it("renders MentionWithCount story", () => {
            const { container } = render(<MentionWithCount />);
            expect(container).toMatchSnapshot();
        });

        it("renders NotificationWithCount story", () => {
            const { container } = render(<NotificationWithCount />);
            expect(container).toMatchSnapshot();
        });

        it("renders ActivityIndicator story", () => {
            const { container } = render(<ActivityIndicator />);
            expect(container).toMatchSnapshot();
        });

        it("renders Muted story", () => {
            const { container } = render(<Muted />);
            expect(container).toMatchSnapshot();
        });
    });
});
