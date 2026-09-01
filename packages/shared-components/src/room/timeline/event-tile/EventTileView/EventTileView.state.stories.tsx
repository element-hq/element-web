/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import layoutMeta from "./EventTileView.stories";

const {
    bubbleGlobals,
    EventTileViewStory,
    eventTileStoryDefaults,
    groupGlobals,
    ircGlobals,
    StoryDecryptionFailureBody,
    StoryDecryptionFailurePadlock,
    StoryMessageComposer,
    StoryEditedMessageBody,
    StoryEmoteBody,
    StoryHighlightedBody,
    StoryInformationalBody,
    StoryLinkedTimestamp,
    StoryPadlock,
    StoryMediaBody,
    StoryNotificationBadge,
    StoryPreviewBody,
    StoryShortBody,
    StoryReplyChain,
    StoryStickerBody,
    StoryThreadListActionBar,
    StoryThreadListInfo,
} = layoutMeta.storyHelpers;

const meta = {
    title: "Timeline/EventTileView/States",
    component: EventTileViewStory,
    tags: ["autodocs"],
    render: (args) => <EventTileViewStory {...args} />,
    argTypes: {
        shape: { table: { disable: true } },
        containerWidth: {
            control: false,
            description:
                "Initial width in pixels. Use the visible range control in the story: RoomView is 50%–100% of the host; right-panel shapes are 320px–50% of MainSplit.",
            table: { category: "Story host" },
        },
        showSenderAndAvatar: { table: { disable: true } },
        classNames: { table: { disable: true } },
        state: { table: { disable: true } },
        line: { table: { disable: true } },
        roomMessages: { table: { disable: true } },
        slots: { table: { category: "Slots" } },
    },
    args: {
        shape: "Room",
        state: {},
        ...eventTileStoryDefaults,
    },
} satisfies Meta<typeof EventTileViewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

const interactiveTags = ["skip-test", "!snapshot"];
const visualTags = ["!dev", "!autodocs", "snapshot"];

const minimalRoomSlots = {
    body: eventTileStoryDefaults.slots.body,
};

const threadStateSlots = {
    sender: eventTileStoryDefaults.slots.sender,
    avatar: eventTileStoryDefaults.slots.avatar,
    body: eventTileStoryDefaults.slots.body,
    timestamp: <StoryLinkedTimestamp />,
};

const searchStateSlots = {
    sender: eventTileStoryDefaults.slots.sender,
    avatar: eventTileStoryDefaults.slots.avatar,
    body: eventTileStoryDefaults.slots.body,
    timestamp: <StoryLinkedTimestamp />,
};

export const HighlightedThread: Story = {
    tags: interactiveTags,
    args: { shape: "Thread", state: { highlighted: true }, slots: threadStateSlots },
};

export const HighlightedSearch: Story = {
    tags: interactiveTags,
    args: {
        shape: "Search",
        state: { highlighted: true },
        slots: { ...searchStateSlots, body: <StoryHighlightedBody /> },
    },
};

export const SelectedThread: Story = {
    tags: interactiveTags,
    args: { shape: "Thread", state: { selected: true }, slots: threadStateSlots },
};

export const SelectedRoom: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "alice",
        state: { selected: true, hasReply: false },
        slots: { ...minimalRoomSlots, body: <StoryEditedMessageBody /> },
    },
};

export const ContextualSearch: Story = {
    tags: interactiveTags,
    args: {
        shape: "Search",
        state: { contextual: true, hasReply: false },
        slots: searchStateSlots,
    },
};

export const ActionBarFocused: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "alice",
        state: { actionBarFocused: true, hasReply: false },
        slots: {
            sender: eventTileStoryDefaults.slots.sender,
            avatar: eventTileStoryDefaults.slots.avatar,
            body: eventTileStoryDefaults.slots.body,
            timestamp: eventTileStoryDefaults.slots.timestamp,
            actionBar: eventTileStoryDefaults.slots.actionBar,
        },
    },
};

export const PreviewClamped: Story = {
    tags: interactiveTags,
    args: {
        shape: "ThreadsList",
        state: { previewClamped: true },
        slots: {
            sender: eventTileStoryDefaults.slots.sender,
            avatar: eventTileStoryDefaults.slots.avatar,
            body: <StoryPreviewBody />,
            timestamp: <StoryLinkedTimestamp />,
            notificationBadge: <StoryNotificationBadge />,
            threadInfo: <StoryThreadListInfo />,
            actionBar: <StoryThreadListActionBar />,
        },
    },
};

export const Informational: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "informational",
        state: { hasReply: false },
        slots: { body: <StoryInformationalBody /> },
    },
};

export const EncryptionFailure: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "alice",
        state: { encryptionFailure: true, hasReply: false },
        slots: {
            body: <StoryDecryptionFailureBody />,
            padlock: <StoryDecryptionFailurePadlock />,
        },
    },
};

export const ReplyChain: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "alice",
        state: { hasReply: true },
        slots: { ...minimalRoomSlots, padlock: <StoryPadlock />, replyChain: <StoryReplyChain /> },
    },
};

export const BubbleContainer: Story = {
    tags: interactiveTags,
    globals: bubbleGlobals,
    args: {
        shape: "Room",
        roomMessages: "bob",
        showSenderAndAvatar: false,
        state: { bubbleContainer: true, hasReply: false },
        slots: { body: <StoryInformationalBody>Security verification event.</StoryInformationalBody> },
    },
};

export const BubbleBoundaries: Story = {
    tags: interactiveTags,
    globals: bubbleGlobals,
    args: {
        shape: "Room",
        roomMessages: "threeEach",
        state: { hasReply: false },
        slots: { body: <StoryShortBody /> },
    },
};

export const LeftAlignedBubble: Story = {
    tags: interactiveTags,
    globals: bubbleGlobals,
    args: {
        shape: "Room",
        roomMessages: "bob",
        showSenderAndAvatar: false,
        state: { leftAlignedBubble: true, hasReply: false },
        slots: { body: <StoryInformationalBody>Alex started a voice call.</StoryInformationalBody> },
    },
};

export const AlignedBetweenBubbles: Story = {
    tags: interactiveTags,
    globals: bubbleGlobals,
    args: {
        shape: "Room",
        roomMessages: "alignedBetween",
        state: { hasReply: false },
        slots: { body: <StoryShortBody /> },
    },
};

export const NoSender: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "bob",
        state: { noSender: true, hasReply: false },
        slots: minimalRoomSlots,
    },
};

export const Editing: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "alice",
        state: { editing: true, hasReply: false },
        slots: { ...minimalRoomSlots, body: <StoryMessageComposer /> },
    },
};

export const Emote: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "bob",
        line: { emote: true },
        state: { emote: true, noBubble: true, hasReply: false },
        slots: { ...minimalRoomSlots, body: <StoryEmoteBody /> },
    },
};

export const Media: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "media",
        line: { media: true, image: true },
        state: { hasReply: false },
        slots: { ...minimalRoomSlots, body: <StoryMediaBody /> },
    },
};

export const Sticker: Story = {
    tags: interactiveTags,
    args: {
        shape: "Room",
        roomMessages: "alice",
        line: { sticker: true },
        state: { hasReply: false },
        slots: { ...minimalRoomSlots, body: <StoryStickerBody /> },
    },
};

export const HighlightedThreadGroup: Story = {
    name: "Highlighted thread - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: HighlightedThread.args,
};

export const SelectedThreadGroup: Story = {
    name: "Selected thread - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: SelectedThread.args,
};

export const HighlightedSearchGroup: Story = {
    name: "Highlighted search - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: HighlightedSearch.args,
};

export const SelectedRoomGroup: Story = {
    name: "Selected room - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: SelectedRoom.args,
};

export const ContextualSearchGroup: Story = {
    name: "Contextual search - Group - Default",
    tags: ["!dev", "!autodocs", "snapshot", "skip-test"],
    globals: groupGlobals,
    args: ContextualSearch.args,
};

export const ActionBarFocusedGroup: Story = {
    name: "Action bar focused - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: ActionBarFocused.args,
};

export const PreviewClampedGroup: Story = {
    name: "Preview clamped - Group",
    tags: visualTags,
    globals: groupGlobals,
    args: PreviewClamped.args,
};

export const InformationalBubble: Story = {
    name: "Informational - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: Informational.args,
};

export const InformationalGroup: Story = {
    name: "Informational - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: Informational.args,
};

export const InformationalIrc: Story = {
    name: "Informational - IRC - Default",
    tags: visualTags,
    globals: ircGlobals,
    args: Informational.args,
};

export const EncryptionFailureBubble: Story = {
    name: "Encryption failure - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: EncryptionFailure.args,
};

export const EncryptionFailureGroup: Story = {
    name: "Encryption failure - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: EncryptionFailure.args,
};

export const ReplyChainBubble: Story = {
    name: "Reply chain - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: ReplyChain.args,
};

export const ReplyChainGroup: Story = {
    name: "Reply chain - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: ReplyChain.args,
};

export const BubbleContainerBubble: Story = {
    name: "Bubble container - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: BubbleContainer.args,
};

export const BubbleBoundariesBubble: Story = {
    name: "Bubble boundaries - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: BubbleBoundaries.args,
};

export const BubbleContainerGroup: Story = {
    name: "Bubble container - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: BubbleContainer.args,
};

export const BubbleContainerIrc: Story = {
    name: "Bubble container - IRC - Default",
    tags: visualTags,
    globals: ircGlobals,
    args: BubbleContainer.args,
};

export const LeftAlignedBubbleVisual: Story = {
    name: "Left-aligned bubble - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: LeftAlignedBubble.args,
};

export const AlignedBetweenBubblesVisual: Story = {
    name: "Aligned between bubbles - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: AlignedBetweenBubbles.args,
};

export const NoSenderVisual: Story = {
    name: "No sender - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: NoSender.args,
};

export const EditingBubble: Story = {
    name: "Editing - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: Editing.args,
};

export const EditingGroup: Story = {
    name: "Editing - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: Editing.args,
};

export const EditingIrc: Story = {
    name: "Editing - IRC - Default",
    tags: visualTags,
    globals: ircGlobals,
    args: Editing.args,
};

export const EmoteBubble: Story = {
    name: "Emote - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: Emote.args,
};

export const EmoteIrc: Story = {
    name: "Emote - IRC - Default",
    tags: visualTags,
    globals: ircGlobals,
    args: Emote.args,
};

export const MediaBubble: Story = {
    name: "Media - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: Media.args,
};

export const MediaGroup: Story = {
    name: "Media - Group - Default",
    tags: visualTags,
    globals: groupGlobals,
    args: Media.args,
};

export const MediaIrc: Story = {
    name: "Media - IRC - Default",
    tags: visualTags,
    globals: ircGlobals,
    args: Media.args,
};

export const StickerBubble: Story = {
    name: "Sticker - Bubble - Default",
    tags: visualTags,
    globals: bubbleGlobals,
    args: Sticker.args,
};
