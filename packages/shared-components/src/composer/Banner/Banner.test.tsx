import React from "react";
import { composeStories } from "@storybook/react-vite";

import * as stories from "./Banner.stories.tsx";
import { render } from "jest-matrix-react";

const { Default, Info, Success, WithAction, WithAvatarImage, Critical } = composeStories(stories);

describe("AvatarWithDetails", () => {
    it("renders a default banner", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("renders a info banner", () => {
        const { container } = render(<Info />);
        expect(container).toMatchSnapshot();
    });
    it("renders a success banner", () => {
        const { container } = render(<Success />);
        expect(container).toMatchSnapshot();
    });
    it("renders a critical banner", () => {
        const { container } = render(<Critical />);
        expect(container).toMatchSnapshot();
    });
    it("renders a banner with an action", () => {
        const { container } = render(<WithAction />);
        expect(container).toMatchSnapshot();
    });
    it("renders a banner with an avatar iamge", () => {
        const { container } = render(<WithAvatarImage />);
        expect(container).toMatchSnapshot();
    });
});
