## Packaging nightlies

Element Desktop nightly builds are build automatically by the [Github Actions workflow](https://github.com/vector-im/element-desktop/blob/develop/.github/workflows/build_and_deploy.yaml).
The schedule is currently set for once a day at 9am UTC. It will deploy to packages.element.io upon completion.

## Triggering a manual nightly build

Simply go to https://github.com/vector-im/element-desktop/actions/workflows/build_and_deploy.yaml

1. Click `Run workflow`
1. Feel free to make changes to the checkboxes depending on the circumstances
1. Click the green `Run workflow`

## Packaging releases

**Don't do this for RCs! We don't build Element Desktop for RCs.**

For releasing Element Desktop, we assume the following prerequisites:

- a tag of `element-desktop` repo with the Element Desktop version to be released set in `package.json`.
- an Element Web tarball published to GitHub with a matching version number.

**Both of these are done automatically when you run the release automation.**

The packaging is kicked off automagically for you when a Github Release for Element Desktop is published.

### More detail on the github actions

We moved to Github Actions for the following reasons:

1. Removing single point of failure
2. Improving reliability
3. Unblocking the packaging on a single individual
4. Improving parallelism

The Windows builds are signed by SSL.com using their Cloud Key Adapter for eSigner.
This allows us to use Microsoft's signtool to interface with eSigner and send them a hash of the exe along with
credentials in exchange for a signed certificate which we attach onto all the relevant files.

The Apple builds are signed using standard code signing means and then notarised to appease GateKeeper.

The Linux builds are distributed via a signed reprepro repository.

The packages.element.io site is a public Cloudflare R2 bucket which is deployed to solely from Github Actions.
The main bucket in R2 is `packages-element-io` which is a direct mapping of packages.element.io,
we have a workflow which generates the index.html files there to imitate a public index which Cloudflare does not currently support.
The reprepro database lives in `packages-element-io-db`.
There is an additional pair of buckets of same name but appended with `-test` which can be used for testing,
these land on https://packages-element-io-test.element.io/.

### Debian/Ubuntu Distributions

We used to add a new distribution to match each Debian and Ubuntu release. As of April 2020, we have created a `default` distribution that everyone can use (since the packages have never differed by distribution anyway).

The distribution configuration lives in https://github.com/vector-im/packages.element.io/blob/master/debian/conf/distributions as a canonical source.
