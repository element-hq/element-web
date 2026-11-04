/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import {
    MediaPreviewGroupPreview,
    type MediaPreviewGroupEntry,
    type MediaPreviewGroupSnapshot,
} from "./MediaPreviewGroupView";
import { MockViewModel } from "../../../../core/viewmodel/MockViewModel";

/**
 * What the timeline shows beside a link preview, built from real sites' images: a thumbnail of the
 * page's image, the site's logo, or nothing. The images load from the network, so none of these
 * stories are screenshot-tested.
 */

const linkPreview = (
    url: string,
    header: string,
    body: string,
    picture?: { thumbnail: string } | { logo: string },
): MediaPreviewGroupEntry => {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const common = {
        id: url,
        layout: "side" as const,
        header,
        headerUrl: url,
        body,
        footer: host,
        onDismiss: () => ({}),
    };
    if (picture === undefined) return { ...common, type: "text" };
    if ("thumbnail" in picture) {
        return { ...common, type: "image", image: picture.thumbnail, imageAlt: header, imageSize: "thumbnail" };
    }
    return { ...common, type: "image", image: picture.logo, imageAlt: host, imageSize: "logo" };
};

const withEntries = (entries: Array<MediaPreviewGroupEntry>): { vm: MockViewModel<MediaPreviewGroupSnapshot> } => ({
    vm: new MockViewModel<MediaPreviewGroupSnapshot>({ entries }),
});

// YouTube keeps its 16:9 video still as the thumbnail although the site has a logo.
const youtube: MediaPreviewGroupEntry[] = [
    ["dQw4w9WgXcQ", "Rick Astley - Never Gonna Give You Up (Official Video)", "Rick Astley"],
    ["OPf0YbXqDm0", "Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars", "Mark Ronson"],
    ["9bZkp7q19f0", "PSY - GANGNAM STYLE(강남스타일) M/V", "officialpsy"],
].map(([id, title, channel]) =>
    linkPreview(`https://www.youtube.com/watch?v=${id}`, title, `${channel} · YouTube`, {
        thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    }),
);

// Square and portrait og:images fit the thumbnail, so they are shown.
const siteImages: MediaPreviewGroupEntry[] = [
    linkPreview(
        "https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv",
        "Listen to The Dark Side of the Moon - Album by Pink Floyd | Spotify",
        "Pink Floyd · album · 1973 · 10 songs",
        { thumbnail: "https://i.scdn.co/image/ab67616d0000b273db216ca805faf5fe35df4ee6" },
    ),
    linkPreview(
        "https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc",
        "Listen to Discovery - Album by Daft Punk | Spotify",
        "Daft Punk · album · 2001 · 14 songs",
        { thumbnail: "https://i.scdn.co/image/ab67616d0000b2731e81bff9807a9e629fce5ade" },
    ),
    linkPreview(
        "https://en.wikipedia.org/wiki/Cat",
        "Cat - Wikipedia",
        "The cat is a small domesticated carnivorous mammal.",
        { thumbnail: "https://upload.wikimedia.org/wikipedia/commons/2/25/Siam_lilacpoint.jpg" },
    ),
];

// A wide og:image would be cropped, so the site's logo (MSC4448) is shown instead.
const siteLogos: MediaPreviewGroupEntry[] = [
    linkPreview(
        "https://github.com/element-hq/synapse",
        "GitHub - element-hq/synapse: Synapse: Matrix homeserver written in Python/Twisted.",
        "Synapse: Matrix homeserver written in Python/Twisted. Contribute to element-hq/synapse.",
        { logo: "https://github.githubassets.com/favicons/favicon.png" },
    ),
    linkPreview(
        "https://www.theguardian.com/uk",
        "Latest news, sport and opinion from the Guardian",
        "Latest news, sport, business, comment, analysis and reviews from the Guardian.",
        { logo: "https://assets.guim.co.uk/static/frontend/icons/homescreen/apple-touch-icon-512.png" },
    ),
    linkPreview(
        "https://element.io/",
        "Element | Secure collaboration and messaging",
        "Element is a Matrix-based end-to-end encrypted messenger and secure collaboration app.",
        {
            logo: "https://element.io/assets-32bb636196f91ed59d7a49190e26b42c/5ef25c0d30ee3108da4c25e9/5f0e1775cd41ebe29c04cac1_webclip.png",
        },
    ),
];

// Neither an og:image nor a logo: text only.
const textOnly: MediaPreviewGroupEntry[] = [
    linkPreview(
        "https://example.com/",
        "Example Domain",
        "This domain is for use in documentation examples without needing permission.",
    ),
    linkPreview("https://www.reddit.com/r/matrix/", "r/matrix", "A subreddit for the Matrix protocol."),
    linkPreview(
        "https://docs.python.org/3/",
        "Python 3.15 documentation",
        "Welcome! This is the official documentation.",
    ),
];

// Three photos at an exact size, served by Lorem Picsum.
const photos = (ratio: string, width: number, height: number, note: string): MediaPreviewGroupEntry[] =>
    [1, 2, 3].map((n) => {
        const url = `https://picsum.photos/seed/${ratio}-${n}/${width}/${height}`;
        return linkPreview(url, `${ratio} · ${width}×${height}`, `${note}, photo ${n}`, { thumbnail: url });
    });

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/Link Preview Examples",
    component: MediaPreviewGroupPreview,
    tags: ["!snapshot", "!autodocs"],
} satisfies Meta<typeof MediaPreviewGroupPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const YouTube: Story = {
    name: "YouTube videos",
    args: withEntries(youtube),
};

export const SiteImages: Story = {
    name: "Sites showing their image",
    args: withEntries(siteImages),
};

export const SiteLogos: Story = {
    name: "Sites showing their logo",
    args: withEntries(siteLogos),
};

export const TextOnly: Story = {
    name: "Sites with neither",
    args: withEntries(textOnly),
};

export const Everything: Story = {
    name: "All of the above",
    args: withEntries([...youtube, ...siteImages, ...siteLogos, ...textOnly]),
};

export const Ratio16x9: Story = {
    name: "Ratio 16:9, video still",
    args: withEntries(photos("16:9", 1280, 720, "Video still")),
};

export const Ratio21x9: Story = {
    name: "Ratio 21:9, ultrawide",
    args: withEntries(photos("21:9", 1260, 540, "Ultrawide")),
};

export const RatioOpenGraph: Story = {
    name: "Ratio 1.91:1, Open Graph banner",
    args: withEntries(photos("1.91:1", 1200, 630, "The usual Open Graph banner")),
};

export const Ratio3x2: Story = {
    name: "Ratio 3:2, camera photo",
    args: withEntries(photos("3:2", 1200, 800, "Camera photo")),
};

export const Ratio4x3: Story = {
    name: "Ratio 4:3, older photo or screen",
    args: withEntries(photos("4:3", 1024, 768, "Older photo or screen")),
};

export const Ratio1x1: Story = {
    name: "Ratio 1:1, album art",
    args: withEntries(photos("1:1", 800, 800, "Album art")),
};

export const Ratio3x4: Story = {
    name: "Ratio 3:4, portrait photo",
    args: withEntries(photos("3:4", 768, 1024, "Portrait photo")),
};

export const Ratio9x16: Story = {
    name: "Ratio 9:16, phone screenshot",
    args: withEntries(photos("9:16", 720, 1280, "Phone screenshot or short")),
};
