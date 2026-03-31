import { withMermaid } from "vitepress-plugin-mermaid";

function customPathResolver(href: string, currentPath: string) {
    const [link, fragment] = href.split("#", 2);
    if (currentPath === "index.md") {
        if (link.startsWith("./docs/")) {
            return `../docs/${href.slice(7)}`;
        } else if (link.startsWith("docs/")) {
            return `../${href}`;
        }
    }

    switch (link) {
        case "../packages/shared-components/README.md":
            return `../docs/readme-shared-components.md#${fragment}`;
        case "../apps/web/README.md":
            return `../docs/readme-element-web.md#${fragment}`;
        case "../README.md":
            return `../docs/index.md#${fragment}`;

        default:
            return `https://github.com/element-hq/element-web/blob/develop/${href.split("/").pop()}`;
    }
}

// https://vitepress.dev/reference/site-config
export default withMermaid({
    title: "Element Web & Desktop docs",
    description: "Documentation",
    srcExclude: ["changelogs"],
    markdown: {
        config: (md) => {
            // Custom rule to fix links
            const defaultRender =
                md.renderer.rules.link_open ||
                function (tokens, idx, options, env, self) {
                    return self.renderToken(tokens, idx, options);
                };

            md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
                const token = tokens[idx];
                const hrefIndex = token.attrIndex("href");

                if (hrefIndex >= 0) {
                    const href = token.attrs![hrefIndex][1];

                    if (!href.includes("://") && href.split("#", 2)[0].endsWith(".md")) {
                        token.attrs![hrefIndex][1] = customPathResolver(href, env.relativePath);
                    }
                }
                return defaultRender(tokens, idx, options, env, self);
            };
        },
    },
    themeConfig: {
        nav: [
            { text: "Home", link: "/" },
            { text: "Website", link: "https://element.io/en" },
        ],

        search: {
            provider: "local",
        },

        sidebar: [
            {
                text: "README",
                items: [
                    { text: "Introduction", link: "/index" },
                    { text: "Element Web", link: "/readme-element-web" },
                    { text: "Element Desktop", link: "/readme-element-desktop" },
                    { text: "Shared Components", link: "/readme-shared-components" },
                ],
            },
            {
                text: "Usage",
                items: [
                    { text: "Betas", link: "/betas" },
                    { text: "Labs", link: "/labs" },
                ],
            },
            {
                text: "Setup",
                items: [
                    { text: "Install", link: "/install" },
                    { text: "Config", link: "/config" },
                    { text: "Custom home page", link: "/custom-home" },
                    { text: "Kubernetes", link: "/kubernetes" },
                    { text: "Jitsi", link: "/jitsi" },
                    { text: "Encryption", link: "/e2ee" },
                ],
            },
            {
                text: "Build",
                items: [
                    {
                        text: "Web",
                        items: [
                            { text: "Customisations", link: "/customisations" },
                            { text: "Deprecated Modules", link: "/deprecated-modules" },
                        ],
                    },
                    {
                        text: "Desktop",
                        items: [
                            { text: "Native Node modules", link: "/native-node-modules" },
                            { text: "Windows requirements", link: "/windows-requirements" },
                            { text: "Debugging", link: "/debugging" },
                            { text: "Using gdb", link: "/gdb" },
                        ],
                    },
                ],
            },
            {
                text: "Distribution",
                items: [
                    { text: "Updates", link: "/updates" },
                    { text: "Packaging", link: "/packaging" },
                ],
            },
            {
                text: "Contribution",
                items: [
                    { text: "Choosing an issue", link: "/choosing-an-issue" },
                    { text: "Translation", link: "/translating" },
                    { text: "Netlify builds", link: "/pr-previews" },
                    { text: "Code review", link: "/review" },
                ],
            },
            {
                text: "Development",
                items: [
                    { text: "App load order", link: "/app-load.md" },
                    { text: "Translation", link: "/translating-dev.md" },
                    { text: "Theming", link: "/theming.md" },
                    { text: "Playwright end to end tests", link: "/playwright.md" },
                    { text: "Memory profiling", link: "/memory-profiles-and-leaks.md" },
                    { text: "Jitsi", link: "/jitsi-dev.md" },
                    { text: "Feature flags", link: "/feature-flags.md" },
                    { text: "OIDC and delegated authentication", link: "/oidc.md" },
                    { text: "Release Process", link: "/release.md" },
                    { text: "MVVM", link: "/MVVM.md" },
                    { text: "Settings", link: "/settings.md" },
                ],
            },
            {
                text: "Deep dive",
                items: [
                    { text: "Skinning", link: "/skinning" },
                    { text: "Cider editor", link: "/ciderEditor" },
                    { text: "Iconography", link: "/icons" },
                    { text: "Local echo", link: "/local-echo-dev" },
                    { text: "Media", link: "/media-handling" },
                    { text: "Room List Store", link: "/room-list-store" },
                    { text: "Scrolling", link: "/scrolling" },
                    { text: "Usercontent", link: "/usercontent" },
                    { text: "Widget layouts", link: "/widget-layouts" },
                    { text: "Automations", link: "/generated/automations" },
                ],
            },
        ],

        socialLinks: [{ icon: "github", link: "https://github.com/element-hq/element-web" }],
    },
});
