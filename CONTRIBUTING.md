# How to Contribute

## Publishing to npm

To update the [npm package](https://www.npmjs.com/package/attractors)

Run the following:

* `npm version minor`
* `git push --follow-tags`

Then create a GitHub release for the tag you just pushed, either from the
[releases page](https://github.com/steren/attractors/releases/new) or with:

* `gh release create "v$(node -p "require('./package.json').version")" --generate-notes`

Creating the release is what triggers the
[GitHub Action](https://github.com/steren/attractors/blob/main/.github/workflows/npm-publish.yml)
that publishes to npm. Pushing the tag on its own does not publish anything.

### Authentication

The workflow authenticates to npm with
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC), so there
is no npm token stored in this repository and nothing to rotate. The trust
relationship is configured once on npmjs.com, under the package's
*Settings -> Trusted publisher*:

* Publisher: GitHub Actions
* Organization or user: `steren`
* Repository: `attractors`
* Workflow filename: `npm-publish.yml`
* Environment: (leave empty)

As a side effect, published versions also carry
[provenance attestations](https://docs.npmjs.com/generating-provenance-statements).