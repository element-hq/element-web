# Element Web/Desktop code style guide

This code style applies to projects which the element-web team directly maintains or is reasonably
adjacent to. As of writing, these are:

-   element-desktop
-   element-web
-   matrix-react-sdk
-   matrix-js-sdk

Other projects might extend this code style for increased strictness. For example, matrix-events-sdk
has stricter code organization to reduce the maintenance burden. These projects will declare their code
style within their own repos.

Note that some requirements will be layer-specific. Where the requirements don't make sense for the
project, they are used to the best of their ability, used in spirit, or ignored if not applicable,
in that order.

## Guiding principles

1. We want the lint rules to feel natural for most team members. No one should have to think too much
   about the linter.
2. We want to stay relatively close to [industry standards](https://google.github.io/styleguide/tsguide.html)
   to make onboarding easier.
3. We describe what good code looks like rather than point out bad examples. We do this to avoid
   excessively punishing people for writing code which fails the linter.
4. When something isn't covered by the style guide, we come up with a reasonable rule rather than
   claim that it "passes the linter". We update the style guide and linter accordingly.
5. While we aim to improve readability, understanding, and other aspects of the code, we deliberately
   do not let solely our personal preferences drive decisions.
6. We aim to have an understandable guide.

## Coding practices

1. Lint rules enforce decisions made by this guide. The lint rules and this guide are kept in
   perfect sync.
2. Commit messages are descriptive for the changes. When the project supports squash merging,
   only the squashed commit needs to have a descriptive message.
3. When there is disagreement with a code style approved by the linter, a PR is opened against
   the lint rules rather than making exceptions on the responsible code PR.
4. Rules which are intentionally broken (via eslint-ignore, @ts-ignore, etc) have a comment
   included in the immediate vicinity for why. Determination of whether this is valid applies at
   code review time.
5. When editing a file, nearby code is updated to meet the modern standards. "Nearby" is subjective,
   but should be whatever is reasonable at review time. Such an example might be to update the
   class's code style, but not the file's.
    1. These changes should be minor enough to include in the same commit without affecting a code
       reviewer's job.

## All code

Unless otherwise specified, the following applies to all code:

1. Files must be formatted with Prettier.
2. 120 character limit per line. Match existing code in the file if it is using a lower guide.
3. A tab/indentation is 4 spaces.
4. Newlines are Unix.
5. A file has a single empty line at the end.
6. Lines are trimmed of all excess whitespace, including blank lines.
7. Long lines are broken up for readability.

## TypeScript / JavaScript {#typescript-javascript}

1. Write TypeScript. Turn JavaScript into TypeScript when working in the area.
2. Use named exports.
3. Use semicolons for block/line termination.
    1. Except when defining interfaces, classes, and non-arrow functions specifically.
4. When a statement's body is a single line, it must be written without curly braces, so long as the body is placed on
   the same line as the statement.

    ```typescript
    if (x) doThing();
    ```

5. Blocks for `if`, `for`, `switch` and so on must have a space surrounding the condition, but not
   within the condition.

    ```typescript
    if (x) {
        doThing();
    }
    ```

6. lowerCamelCase is used for function and variable naming.
7. UpperCamelCase is used for general naming.
8. Interface names should not be marked with an uppercase `I`.
9. One variable declaration per line.
10. If a variable is not receiving a value on declaration, its type must be defined.

    ```typescript
    let errorMessage: Optional<string>;
    ```

11. Objects can use shorthand declarations, including mixing of types.

    ```typescript
    {
        room,
        prop: this.prop,
    }
    // ... or ...
    { room, prop: this.prop }
    ```

12. Object keys should always be non-strings when possible.

    ```typescript
    {
        property: "value",
        "m.unavoidable": true,
        [EventType.RoomMessage]: true,
    }
    ```

13. Explicitly cast to a boolean.

    ```typescript
    !!stringVar || Boolean(stringVar);
    ```

14. Use `switch` statements when checking against more than a few enum-like values.
15. Use `const` for constants, `let` for mutability.
16. Describe types exhaustively (ensure noImplictAny would pass).
    1. Notable exceptions are arrow functions used as parameters, when a void return type is
       obvious, and when declaring and assigning a variable in the same line.
17. Declare member visibility (public/private/protected).
18. Private members are private and not prefixed unless required for naming conflicts.
    1. Convention is to use an underscore or the word "internal" to denote conflicted member names.
    2. "Conflicted" typically refers to a getter which wants the same name as the underlying variable.
19. Prefer readonly members over getters backed by a variable, unless an internal setter is required.
20. Prefer Interfaces for object definitions, and types for parameter-value-only declarations.

    1. Note that an explicit type is optional if not expected to be used outside of the function call,
       unlike in this example:

        ```typescript
        interface MyObject {
            hasString: boolean;
        }

        type Options = MyObject | string;

        function doThing(arg: Options) {
            // ...
        }
        ```

21. Variables/properties which are `public static` should also be `readonly` when possible.
22. Interface and type properties are terminated with semicolons, not commas.
23. Prefer arrow formatting when declaring functions for interfaces/types:

    ```typescript
    interface Test {
        myCallback: (arg: string) => Promise<void>;
    }
    ```

24. Prefer a type definition over an inline type. For example, define an interface.
25. Always prefer to add types or declare a type over the use of `any`. Prefer inferred types
    when they are not `any`.
    1. When using `any`, a comment explaining why must be present.
26. `import` should be used instead of `require`, as `require` does not have types.
27. Export only what can be reused.
28. Prefer a type like `Optional<X>` (`type Optional<T> = T | null | undefined`) instead
    of truly optional parameters.

    1. A notable exception is when the likelihood of a bug is minimal, such as when a function
       takes an argument that is more often not required than required. An example where the
       `?` operator is inappropriate is when taking a room ID: typically the caller should
       supply the room ID if it knows it, otherwise deliberately acknowledge that it doesn't
       have one with `null`.

        ```typescript
        function doThingWithRoom(
            thing: string,
            room: Optional<string>, // require the caller to specify
        ) {
            // ...
        }
        ```

29. There should be approximately one interface, class, or enum per file unless the file is named
    "types.ts", "global.d.ts", or ends with "-types.ts".
    1. The file name should match the interface, class, or enum name.
30. Bulk functions can be declared in a single file, though named as "foo-utils.ts" or "utils/foo.ts".
31. Imports are grouped by external module imports first, then by internal imports.
32. File ordering is not strict, but should generally follow this sequence:
    1. Licence header
    2. Imports
    3. Constants
    4. Enums
    5. Interfaces
    6. Functions
    7. Classes
        1. Public/protected/private static properties
        2. Public/protected/private properties
        3. Constructors
        4. Public/protected/private getters & setters
        5. Protected and abstract functions
        6. Public/private functions
        7. Public/protected/private static functions
33. Variable names should be noticeably unique from their types. For example, "str: string" instead
    of "string: string".
34. Use double quotes to enclose strings. You may use single quotes if the string contains double quotes.

    ```typescript
    const example1 = "simple string";
    const example2 = 'string containing "double quotes"';
    ```

35. Prefer async-await to promise-chaining

    ```typescript
    async function () {
        const result = await anotherAsyncFunction();
        // ...
    }
    ```

## React

Inheriting all the rules of TypeScript, the following additionally apply:

1. Types for lifecycle functions are not required (render, componentDidMount, and so on).
2. Class components must always have a `Props` interface declared immediately above them. It can be
   empty if the component accepts no props.
3. Class components should have an `State` interface declared immediately above them, but after `Props`.
4. Props and State should not be exported. Use `React.ComponentProps<typeof ComponentNameHere>`
   instead.
5. One component per file, except when a component is a utility component specifically for the "primary"
   component. The utility component should not be exported.
6. Exported constants, enums, interfaces, functions, etc must be separate from files containing components
   or stores.
7. Stores should use a singleton pattern with a static instance property:

    ```typescript
    class FooStore {
        public static readonly instance = new FooStore();

        // or if the instance can't be created eagerly:
        private static _instance: FooStore;
        public static get instance(): FooStore {
            if (!FooStore._instance) {
                FooStore._instance = new FooStore();
            }
            return FooStore._instance;
        }
    }
    ```

8. Stores must support using an alternative MatrixClient and dispatcher instance.
9. Utilities which require JSX must be split out from utilities which do not. This is to prevent import
   cycles during runtime where components accidentally include more of the app than they intended.
10. Interdependence between stores should be kept to a minimum. Break functions and constants out to utilities
    if at all possible.
11. A component should only use CSS class names in line with the component name.

    1. When knowingly using a class name from another component, document it.

12. Curly braces within JSX should be padded with a space, however properties on those components should not.
    See above code example.
13. Functions used as properties should either be defined on the class or stored in a variable. They should not
    be inline unless mocking/short-circuiting the value.
14. Prefer hooks (functional components) over class components. Be consistent with the existing area if unsure
    which should be used.
    1. Unless the component is considered a "structure", in which case use classes.
15. Write more views than structures. Structures are chunks of functionality like MatrixChat while views are
    isolated components.
16. Components should serve a single, or near-single, purpose.
17. Prefer to derive information from component properties rather than establish state.
18. Do not use `React.Component::forceUpdate`.

## Stylesheets (\*.pcss = PostCSS + Plugins)

Note: We use PostCSS + some plugins to process our styles. It looks like SCSS, but actually it is not.

1. Class names must be prefixed with "mx\_".
2. Class names should denote the component which defines them, followed by any context:
    1. mx_MyFoo
    2. mx_MyFoo_avatar
    3. mx_MyFoo_avatar--user
3. Use the `$font` and `$spacing` variables instead of manual values.
4. Keep indentation/nesting to a minimum. Maximum suggested nesting is 5 layers.
5. Use the whole class name instead of shortcuts:

    ```scss
    .mx_MyFoo {
        & .mx_MyFoo_avatar {
            // instead of &_avatar
            // ...
        }
    }
    ```

6. Break multiple selectors over multiple lines this way:

    ```scss
    .mx_MyFoo,
    .mx_MyBar,
    .mx_MyFooBar {
        // ...
    }
    ```

7. Non-shared variables should use $lowerCamelCase. Shared variables use $dashed-naming.
8. Overrides to Z indexes, adjustments of dimensions/padding with pixels, and so on should all be
   documented for what the values mean:

    ```scss
    .mx_MyFoo {
        width: calc(100% - 12px); // 12px for read receipts
        top: -2px; // visually centred vertically
        z-index: 10; // above user avatar, but below dialogs
    }
    ```

9. Avoid the use of `!important`. If necessary, add a comment.

## Tests

1. Tests must be written in TypeScript.
2. Jest mocks are declared below imports, but above everything else.
3. Use the following convention template:

    ```typescript
    // Describe the class, component, or file name.
    describe("FooComponent", () => {
        // all test inspecific variables go here

        beforeEach(() => {
            // exclude if not used.
        });

        afterEach(() => {
            // exclude if not used.
        });

        // Use "it should..." terminology
        it("should call the correct API", async () => {
            // test-specific variables go here
            // function calls/state changes go here
            // expectations go here
        });
    });

    // If the file being tested is a utility class:
    describe("foo-utils", () => {
        describe("firstUtilFunction", () => {
            it("should...", async () => {
                // ...
            });
        });

        describe("secondUtilFunction", () => {
            it("should...", async () => {
                // ...
            });
        });
    });
    ```
