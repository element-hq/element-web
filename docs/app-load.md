# App load order

**Dev note**: As of March 2022, the skin is no longer part of the app load order at all. The document's graphs have
been kept untouched for posterity.

Old slow flow:

```mermaid
flowchart TD
    A1(((load_modernizr))) --> B
    A2((rageshake)) --> B
    B(((skin))) --> C
    C(((olm))) --> D
    D{mobile} --> E
    E((config)) --> F
    F((i18n)) --> G
    style F stroke:lime
    G(((theme))) --> H
    H(((modernizr))) --> app
    style H stroke:red
```

Current more parallel flow:

```mermaid
flowchart TD
    subgraph index.ts
        style index.ts stroke:orange

        A[/rageshake/] --> B{mobile}
        B-- No -->C1(.)
        B-- Yes -->C2((redirect))
        C1 --> D[/olm/] --> R
        C1 --> E[platform] --> F[/config/]
        F --> G1[/skin/]
        F --> R
        G1 --> H
        G1 --> R
        F --> G2[/theme/]
        G2 --> H
        G2 --> R
        F --> G3[/i18n/]
        G3 --> H
        G3 --> R
        H{modernizr}-- No --> J((incompatible))-- user ignore --> R
        H-- Yes --> R

        linkStyle 0,7,9,11,12,14,15 stroke:blue;
        linkStyle 4,8,10,13,16 stroke:red;
    end

    R>ready] --> 2A
    style R stroke:gray

    subgraph init.tsx
        style init.tsx stroke:lime
        2A[loadApp] --> 2B[matrixchat]
    end

```

Key:

- Parallelogram: async/await task
- Box: sync task
- Diamond: conditional branch
- Circle: user interaction
- Blue arrow: async task is allowed to settle but allowed to fail
- Red arrow: async task success is asserted

Notes:

- A task begins when all its dependencies (arrows going into it) are fulfilled.
- The success of setting up rageshake is never asserted, element-web has a fallback path for running without IDB (and thus rageshake).
- Everything is awaited to be settled before the Modernizr check, to allow it to make use of things like i18n if they are successful.

Underlying dependencies:

```mermaid
flowchart TD
    A((rageshake))
    B{mobile}
    C((config))
    D(((olm)))
    E((i18n))
    F(((load_modernizr)))
    G(((modernizr)))
    H(((skin)))
    I(((theme)))
    X[app]

    A --> G
    A --> B
    A-- assert -->X
    F --> G --> X
    G --> H --> X
    C --> I --> X
    C --> E --> X
    E --> G
    B --> C-- assert -->X
    B --> D --> X

    style X stroke:red
    style G stroke:red
    style E stroke:lime
    linkStyle 0,11 stroke:yellow;
    linkStyle 2,13 stroke:red;
```
