## Publishing to npm

To update the [npm package](https://www.npmjs.com/package/attractors)

Run the following:

* `npm test`
* `npm run test:integration`
* `npm version minor`
* `git push --follow-tags`

Then a [GitHub Action](https://github.com/steren/attractors/blob/main/.github/workflows/release.yml) automatically publishes to npm.