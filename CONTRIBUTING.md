# Contributing code to Element Web

Everyone is welcome to contribute code to Element Web, provided that they are
willing to license their contributions under the same license as the project
itself. We follow a simple 'inbound=outbound' model for contributions: the act
of submitting an 'inbound' contribution means that the contributor agrees to
license the code under the same terms as the project's overall 'outbound'
license - in this case, Apache Software License v2 (see
[LICENSE](LICENSE)).

## How to contribute

The preferred and easiest way to contribute changes to the project is to fork
it on github, and then create a pull request to ask us to pull your changes
into our repo (https://help.github.com/articles/using-pull-requests/)

We use GitHub's pull request workflow to review the contribution, and either
ask you to make any refinements needed or merge it and make them ourselves.

Things that should go into your PR description:

-   A changelog entry in the `Notes` section (see below)
-   References to any bugs fixed by the change (in GitHub's `Fixes` notation)
-   Describe the why and what is changing in the PR description so it's easy for
    onlookers and reviewers to onboard and context switch. This information is
    also helpful when we come back to look at this in 6 months and ask "why did
    we do it like that?" we have a chance of finding out.
    -   Why didn't it work before? Why does it work now? What use cases does it
        unlock?
    -   If you find yourself adding information on how the code works or why you
        chose to do it the way you did, make sure this information is instead
        written as comments in the code itself.
    -   Sometimes a PR can change considerably as it is developed. In this case,
        the description should be updated to reflect the most recent state of
        the PR. (It can be helpful to retain the old content under a suitable
        heading, for additional context.)
-   Include both **before** and **after** screenshots to easily compare and discuss
    what's changing.
-   Include a step-by-step testing strategy so that a reviewer can check out the
    code locally and easily get to the point of testing your change.
-   Add comments to the diff for the reviewer that might help them to understand
    why the change is necessary or how they might better understand and review it.

We rely on information in pull request to populate the information that goes into
the changelogs our users see, both for Element Web itself and other projects on
which it is based. This is picked up from both labels on the pull request and
the `Notes:` annotation in the description. By default, the PR title will be
used for the changelog entry, but you can specify more options, as follows.

To add a longer, more detailed description of the change for the changelog:

_Fix llama herding bug_

```
Notes: Fix a bug (https://github.com/matrix-org/notaproject/issues/123) where the 'Herd' button would not herd more than 8 Llamas if the moon was in the waxing gibbous phase
```

For some PRs, it's not useful to have an entry in the user-facing changelog (this is
the default for PRs labelled with `T-Task`):

_Remove outdated comment from `Ungulates.ts`_

```
Notes: none
```

Sometimes, you're fixing a bug in a downstream project, in which case you want
an entry in that project's changelog. You can do that too:

_Fix another herding bug_

```
Notes: Fix a bug where the `herd()` function would only work on Tuesdays
element-web notes: Fix a bug where the 'Herd' button only worked on Tuesdays
```

This example is for Element Web. You can specify:

-   matrix-react-sdk
-   element-web
-   element-desktop

If your PR introduces a breaking change, use the `Notes` section in the same
way, additionally adding the `X-Breaking-Change` label (see below). There's no need
to specify in the notes that it's a breaking change - this will be added
automatically based on the label - but remember to tell the developer how to
migrate:

_Remove legacy class_

```
Notes: Remove legacy `Camelopard` class. `Giraffe` should be used instead.
```

Other metadata can be added using labels.

-   `X-Breaking-Change`: A breaking change - adding this label will mean the change causes a _major_ version bump.
-   `T-Enhancement`: A new feature - adding this label will mean the change causes a _minor_ version bump.
-   `T-Defect`: A bug fix (in either code or docs).
-   `T-Task`: No user-facing changes, eg. code comments, CI fixes, refactors or tests. Won't have a changelog entry unless you specify one.

If you don't have permission to add labels, your PR reviewer(s) can work with you
to add them: ask in the PR description or comments.

We use continuous integration, and all pull requests get automatically tested:
if your change breaks the build, then the PR will show that there are failed
checks, so please check back after a few minutes.

## Tests

Your PR should include tests.

For new user facing features in `matrix-js-sdk`, `matrix-react-sdk` or `element-web`, you
must include:

1. Comprehensive unit tests written in Jest. These are located in `/test`.
2. "happy path" end-to-end tests.
   These are located in `/cypress/e2e` in `matrix-react-sdk`, and
   are run using `element-web`. Ideally, you would also include tests for edge
   and error cases.

Unit tests are expected even when the feature is in labs. It's good practice
to write tests alongside the code as it ensures the code is testable from
the start, and gives you a fast feedback loop while you're developing the
functionality. End-to-end tests should be added prior to the feature
leaving labs, but don't have to be present from the start (although it might
be beneficial to have some running early, so you can test things faster).

For bugs in those repos, your change must include at least one unit test or
end-to-end test; which is best depends on what sort of test most concisely
exercises the area.

Changes to must be accompanied by unit tests written in Jest.
These are located in `/spec/` in `matrix-js-sdk` or `/test/` in `element-web`
and `matrix-react-sdk`.

When writing unit tests, please aim for a high level of test coverage
for new code - 80% or greater. If you cannot achieve that, please document
why it's not possible in your PR.

Some sections of code are not sensible to add coverage for, such as those
which explicitly inhibit noisy logging for tests. Which can be hidden using
an istanbul magic comment as [documented here][1]. See example:

```javascript
/* istanbul ignore if */
if (process.env.NODE_ENV !== "test") {
    logger.error("Log line that is noisy enough in tests to want to skip");
}
```

Tests validate that your change works as intended and also document
concisely what is being changed. Ideally, your new tests fail
prior to your change, and succeed once it has been applied. You may
find this simpler to achieve if you write the tests first.

If you're spiking some code that's experimental and not being used to support
production features, exceptions can be made to requirements for tests.
Note that tests will still be required in order to ship the feature, and it's
strongly encouraged to think about tests early in the process, as adding
tests later will become progressively more difficult.

If you're not sure how to approach writing tests for your change, ask for help
in [#element-dev](https://matrix.to/#/#element-dev:matrix.org).

## Code style

Element Web aims to target TypeScript/ES6. All new files should be written in
TypeScript and existing files should use ES6 principles where possible.

Members should not be exported as a default export in general - it causes problems
with the architecture of the SDK (index file becomes less clear) and could
introduce naming problems (as default exports get aliased upon import). In
general, avoid using `export default`.

The remaining code style is documented in [code_style.md](./code_style.md).
Contributors are encouraged to it and follow the principles set out there.

Please ensure your changes match the cosmetic style of the existing project,
and **_never_** mix cosmetic and functional changes in the same commit, as it
makes it horribly hard to review otherwise.

## Attribution

Everyone who contributes anything to Matrix is welcome to be listed in the
AUTHORS.rst file for the project in question. Please feel free to include a
change to AUTHORS.rst in your pull request to list yourself and a short
description of the area(s) you've worked on. Also, we sometimes have swag to
give away to contributors - if you feel that Matrix-branded apparel is missing
from your life, please mail us your shipping address to matrix at matrix.org
and we'll try to fix it :)

## Sign off

In order to have a concrete record that your contribution is intentional
and you agree to license it under the same terms as the project's license, we've
adopted the same lightweight approach that the Linux Kernel
(https://www.kernel.org/doc/Documentation/SubmittingPatches), Docker
(https://github.com/docker/docker/blob/master/CONTRIBUTING.md), and many other
projects use: the DCO (Developer Certificate of Origin:
http://developercertificate.org/). This is a simple declaration that you wrote
the contribution or otherwise have the right to contribute it to Matrix:

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
660 York Street, Suite 102,
San Francisco, CA 94110 USA

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

If you agree to this for your contribution, then all that's needed is to
include the line in your commit or pull request comment:

```
Signed-off-by: Your Name <your@email.example.org>
```

We accept contributions under a legally identifiable name, such as your name on
government documentation or common-law names (names claimed by legitimate usage
or repute). Unfortunately, we cannot accept anonymous contributions at this
time.

Git allows you to add this signoff automatically when using the `-s` flag to
`git commit`, which uses the name and email set in your `user.name` and
`user.email` git configs.

If you forgot to sign off your commits before making your pull request and are
on Git 2.17+ you can mass signoff using rebase:

```
git rebase --signoff origin/develop
```

# Review expectations

See https://github.com/vector-im/element-meta/wiki/Review-process

# Merge Strategy

The preferred method for merging pull requests is squash merging to keep the
commit history trim, but it is up to the discretion of the team member merging
the change. We do not support rebase merges due to `allchange` being unable to
handle them. When merging make sure to leave the default commit title, or
at least leave the PR number at the end in brackets like by default.
When stacking pull requests, you may wish to do the following:

1. Branch from develop to your branch (branch1), push commits onto it and open a pull request
2. Branch from your base branch (branch1) to your work branch (branch2), push commits and open a pull request configuring the base to be branch1, saying in the description that it is based on your other PR.
3. Merge the first PR using a merge commit otherwise your stacked PR will need a rebase. Github will automatically adjust the base branch of your other PR to be develop.

[1]: https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md
