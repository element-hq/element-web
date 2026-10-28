/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../core/viewmodel";
import { type A2UIRenderNode } from "../A2UIRenderNode";
import {
    A2UISurfaceView,
    type A2UISurfaceViewActions,
    type A2UISurfaceViewModel,
    type A2UISurfaceViewSnapshot,
} from "./A2UISurfaceView";
import * as stories from "./A2UISurfaceView.stories";

const { ContactForm, TemplateList, Tabs, NoRootYet, NoSurfaces, SendFailed } = composeStories(stories);

function mockVm(root: A2UIRenderNode | null, extra: Partial<A2UISurfaceViewSnapshot> = {}) {
    const setInputValue = vi.fn<A2UISurfaceViewActions["setInputValue"]>();
    const triggerAction = vi.fn<A2UISurfaceViewActions["triggerAction"]>();
    const showMedia = vi.fn<A2UISurfaceViewActions["showMedia"]>();
    const openImage = vi.fn<A2UISurfaceViewActions["openImage"]>();
    const vm = Object.assign(
        new MockViewModel<A2UISurfaceViewSnapshot>({
            surfaces: [{ surfaceId: "main", root }],
            sending: false,
            mediaVisible: true,
            ...extra,
        }),
        { setInputValue, triggerAction, showMedia, openImage },
    ) as A2UISurfaceViewModel;
    return { vm, setInputValue, triggerAction, showMedia, openImage };
}

describe("A2UISurfaceView", () => {
    it("renders the contact form story", () => {
        const { container } = render(<ContactForm />);

        expect(screen.getByRole("heading", { name: "Contact us" })).toBeInTheDocument();
        expect(screen.getByLabelText("Name")).toHaveValue("Alice");
        expect(screen.getByRole("checkbox", { name: "Subscribe to the newsletter" })).toBeChecked();
        expect(screen.getByRole("radio", { name: "Free" })).toBeChecked();
        expect(container).toMatchSnapshot();
    });

    it("keeps the data model in sync with edits and reports actions with resolved context", async () => {
        const user = userEvent.setup();
        const onAction = vi.fn();
        render(<ContactForm onAction={(...args) => onAction(...args)} />);

        await user.clear(screen.getByLabelText("Name"));
        await user.type(screen.getByLabelText("Name"), "Bob");
        await user.click(screen.getByRole("radio", { name: "Pro" }));
        await user.click(screen.getByRole("checkbox", { name: "Subscribe to the newsletter" }));
        await user.click(screen.getByRole("button", { name: "Send" }));

        expect(onAction).toHaveBeenCalledWith("submitContactForm", "submit", {
            formId: "contact_form_1",
            contact: { name: "Bob", email: "", plan: ["pro"], subscribe: false },
        });
    });

    it("expands template lists and renders sliders and date inputs", async () => {
        const user = userEvent.setup();
        const onAction = vi.fn();
        render(<TemplateList onAction={(...args) => onAction(...args)} />);

        expect(screen.getByText("Nonna's Kitchen")).toBeInTheDocument();
        expect(screen.getByLabelText("Minimum rating")).toHaveValue("3");
        expect(screen.getByLabelText("When")).toHaveValue("2026-10-24T19:30");

        await user.click(screen.getAllByRole("button", { name: "Choose" })[1]);

        expect(onAction).toHaveBeenCalledWith("pick", "itemPick", { id: "r2" });
    });

    it("switches tabs and flags unsupported components", async () => {
        const user = userEvent.setup();
        render(<Tabs />);

        expect(screen.getByText("An overview.")).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "Details" }));

        expect(screen.getByText("Unsupported component: Gauge")).toBeInTheDocument();
        expect(screen.queryByText("An overview.")).not.toBeInTheDocument();
    });

    it("shows placeholders before a root exists and when there are no surfaces", () => {
        const { unmount } = render(<NoRootYet />);
        expect(screen.getByText("Waiting for content…")).toBeInTheDocument();
        unmount();

        render(<NoSurfaces />);
        expect(
            screen.getByText("This message contains an interactive view that cannot be displayed."),
        ).toBeInTheDocument();
    });

    it("shows the error from the view model", () => {
        render(<SendFailed />);

        expect(screen.getByRole("alert")).toHaveTextContent("Your response could not be sent. Please try again.");
    });

    it("disables buttons while sending and when the action is unsupported", () => {
        const { vm } = mockVm(
            {
                id: "root",
                key: "root",
                component: "Row",
                direction: "row",
                justify: "start",
                align: "stretch",
                children: [
                    { id: "a", key: "a", component: "Button", variant: "default", enabled: true, child: null },
                    { id: "b", key: "b", component: "Button", variant: "default", enabled: false, child: null },
                ],
            },
            { sending: true },
        );
        render(<A2UISurfaceView vm={vm} />);

        for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    });

    it("passes input edits to the view model with the bound path", async () => {
        const user = userEvent.setup();
        const { vm, setInputValue } = mockVm({
            id: "root",
            key: "root",
            component: "Column",
            direction: "column",
            justify: "start",
            align: "stretch",
            children: [
                { id: "note", key: "note", component: "TextField", label: "Note", value: "", variant: "longText" },
                { id: "ok", key: "ok", component: "CheckBox", label: "OK", value: false, path: "/ok" },
                {
                    id: "tags",
                    key: "tags",
                    component: "ChoicePicker",
                    options: [
                        { label: "One", value: "1" },
                        { label: "Two", value: "2" },
                    ],
                    value: ["1"],
                    path: "/tags",
                    variant: "multipleSelection",
                },
                {
                    id: "secret",
                    key: "secret",
                    component: "TextField",
                    label: "Secret",
                    value: "",
                    variant: "obscured",
                    path: "/secret",
                },
            ],
        });
        render(<A2UISurfaceView vm={vm} />);

        await user.type(screen.getByLabelText("Note"), "x");
        expect(setInputValue).toHaveBeenCalledWith("main", "note", undefined, "x");

        await user.click(screen.getByRole("checkbox", { name: "OK" }));
        expect(setInputValue).toHaveBeenCalledWith("main", "ok", "/ok", true);

        await user.click(screen.getByRole("checkbox", { name: "Two" }));
        expect(setInputValue).toHaveBeenCalledWith("main", "tags", "/tags", ["1", "2"]);
        await user.click(screen.getByRole("checkbox", { name: "One" }));
        expect(setInputValue).toHaveBeenCalledWith("main", "tags", "/tags", []);

        expect(screen.getByLabelText("Secret")).toHaveAttribute("type", "password");
    });

    it("renders catalog icons, custom icon paths and a fallback for unknown names", () => {
        const { vm } = mockVm({
            id: "root",
            key: "root",
            component: "Row",
            direction: "row",
            justify: "start",
            align: "center",
            children: [
                { id: "a", key: "a", component: "Icon", name: "check" },
                { id: "b", key: "b", component: "Icon", svgPath: "M0 0h24v24H0z" },
                { id: "c", key: "c", component: "Icon", name: "shoppingCart" },
            ],
        });
        const { container } = render(<A2UISurfaceView vm={vm} />);

        const icons = container.querySelectorAll("svg[data-icon]");
        expect(icons).toHaveLength(3);
        expect(icons[0]).toHaveAttribute("data-icon", "check");
        expect(icons[1].querySelector("path")).toHaveAttribute("d", "M0 0h24v24H0z");
        expect(icons[2]).toHaveAttribute("data-icon", "shoppingCart");
    });

    it("renders a video player only when a URL was resolved", () => {
        const { vm } = mockVm({
            id: "root",
            key: "root",
            component: "Column",
            direction: "column",
            justify: "start",
            align: "stretch",
            children: [
                { id: "clip", key: "clip", component: "Video", url: "https://example.org/clip.mp4" },
                { id: "blocked", key: "blocked", component: "Video" },
            ],
        });
        const { container } = render(<A2UISurfaceView vm={vm} />);

        const video = container.querySelector("video");
        expect(video).toHaveAttribute("src", "https://example.org/clip.mp4");
        expect(video).toHaveAttribute("controls");
        expect(screen.getByText("Media unavailable")).toBeInTheDocument();
    });

    it("hides images and videos behind placeholders until media is revealed", async () => {
        const user = userEvent.setup();
        const { vm, showMedia } = mockVm(
            {
                id: "root",
                key: "root",
                component: "Column",
                direction: "column",
                justify: "start",
                align: "stretch",
                children: [
                    {
                        id: "pic",
                        key: "pic",
                        component: "Image",
                        url: "https://example.org/a.png",
                        description: "A",
                        fit: "fill",
                        variant: "mediumFeature",
                    },
                    { id: "clip", key: "clip", component: "Video", url: "https://example.org/clip.mp4" },
                ],
            },
            { mediaVisible: false },
        );
        const { container } = render(<A2UISurfaceView vm={vm} />);

        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("video")).toBeNull();
        expect(screen.getByRole("button", { name: "Show video" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Show image" }));

        expect(showMedia).toHaveBeenCalled();
    });

    it("opens feature images at full size but not icons or avatars", async () => {
        const user = userEvent.setup();
        const { vm, openImage } = mockVm({
            id: "root",
            key: "root",
            component: "Row",
            direction: "row",
            justify: "start",
            align: "stretch",
            children: [
                {
                    id: "big",
                    key: "big",
                    component: "Image",
                    url: "https://example.org/big.png",
                    description: "Big",
                    fit: "fill",
                    variant: "largeFeature",
                },
                {
                    id: "tiny",
                    key: "tiny",
                    component: "Image",
                    url: "https://example.org/tiny.png",
                    description: "Tiny",
                    fit: "fill",
                    variant: "icon",
                },
            ],
        });
        render(<A2UISurfaceView vm={vm} />);

        await user.click(screen.getByRole("img", { name: "Big" }));
        expect(openImage).toHaveBeenCalledWith("https://example.org/big.png", "Big");

        expect(screen.getByRole("img", { name: "Tiny" }).closest("button")).toBeNull();
    });

    it("renders images only when a URL was resolved", () => {
        const { vm } = mockVm({
            id: "root",
            key: "root",
            component: "Column",
            direction: "column",
            justify: "start",
            align: "stretch",
            children: [
                {
                    id: "pic",
                    key: "pic",
                    component: "Image",
                    url: "https://example.org/a.png",
                    description: "A",
                    fit: "cover",
                    variant: "icon",
                },
                {
                    id: "blocked",
                    key: "blocked",
                    component: "Image",
                    description: "Blocked",
                    fit: "fill",
                    variant: "header",
                },
                { id: "sep", key: "sep", component: "Divider", axis: "vertical" },
            ],
        });
        render(<A2UISurfaceView vm={vm} />);

        expect(screen.getByRole("img", { name: "A" })).toHaveAttribute("src", "https://example.org/a.png");
        expect(screen.getByRole("img", { name: "Blocked" }).tagName).toBe("SPAN");
    });
});
